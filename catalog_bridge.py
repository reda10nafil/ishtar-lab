"""Ponte same-origin del solo pannello locale al backend isolato autenticato.
Le credenziali rimangono sul server. Nessun proxy aperto verso URL arbitrari.
"""
import json
import threading
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent
API = "http://127.0.0.1:9273"
ORIGIN = "http://127.0.0.1:4273"
_lock = threading.Lock()
_token = ""
_until = 0

def env(path):
    return dict(line.strip().split("=", 1) for line in path.read_text(encoding="utf-8-sig").splitlines()
                if "=" in line and not line.lstrip().startswith("#"))

def credentials():
    config = env(ROOT / "backend/piattaforma/packages/api/.env")
    if config.get("ISHTAR_INSTANCE_ID") != "ishtar-lab-redx" or ":55730/ishtar_lab_redx" not in config.get("DATABASE_URL", ""):
        raise ValueError("Il backend non appartiene alla copia Ishtar Lab")
    return env(ROOT / "backend/.credenziali-locali.env")

def token():
    global _token, _until
    with _lock:
        if _token and time.time() < _until:
            return _token
        c = credentials()
        request = Request(API + "/auth/user/emailpass", data=json.dumps({"email": c["ADMIN_EMAIL"], "password": c["ADMIN_PASSWORD"]}).encode(), headers={"Content-Type":"application/json"})
        with urlopen(request, timeout=15) as response:
            _token = json.load(response)["token"]
        _until = time.time() + 1800
        return _token

def risposta_json(handler, codice, corpo):
    # Solo ASCII (accenti come \u00e0): qualunque testo arrivato dal backend resta codificabile.
    dati = json.dumps(corpo).encode()
    handler.send_response(codice)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(dati)))
    handler.end_headers()
    handler.wfile.write(dati)

def errore(handler, codice, messaggio):
    """Errori del ponte sempre in JSON: il pannello mostra il motivo invece di un codice generico."""
    risposta_json(handler, codice, {"message": messaggio})

def dimentica_token():
    global _token, _until
    with _lock:
        _token, _until = "", 0

def inoltra(metodo, destinazione, corpo, tipo):
    request = Request(API + destinazione, data=corpo, method=metodo,
                      headers={"Authorization": "Bearer " + token(), "Content-Type": tipo})
    with urlopen(request, timeout=180) as response:
        return response.status, response.read()

def handle(handler):
    if handler.headers.get("Host") != "127.0.0.1:4273" or handler.headers.get("Origin", ORIGIN) != ORIGIN or handler.headers.get("Sec-Fetch-Site", "same-origin") not in ("same-origin", "none"):
        errore(handler, 403, "Accesso solo dal pannello locale")
        return
    if handler.headers.get("X-Ishtar-Local") != "1":
        errore(handler, 403, "Aprire il catalogo dal pannello Ishtar Lab")
        return
    targets = {"/api/catalogo": "/admin/ishtar/catalogo", "/api/foto": "/admin/uploads"}
    if handler.path not in targets or handler.command not in ("GET", "POST") or (handler.path == "/api/foto" and handler.command != "POST"):
        errore(handler, 404, "Indirizzo del ponte non riconosciuto")
        return
    try:
        length = int(handler.headers.get("Content-Length", "0"))
        if length < 0 or length > 25 * 1024 * 1024:
            errore(handler, 413, "Il caricamento supera 25 MB")
            return
        body = handler.rfile.read(length) if handler.command == "POST" else None
        content_type = handler.headers.get("Content-Type", "application/json")
        if handler.path == "/api/catalogo" and handler.command == "POST" and not content_type.startswith("application/json"):
            errore(handler, 415, "Il catalogo accetta solo dati JSON")
            return
        try:
            stato, payload = inoltra(handler.command, targets[handler.path], body, content_type)
        except HTTPError as scaduto:
            # Accesso scaduto o revocato: si rinnova il token una sola volta e si ripete la richiesta.
            if scaduto.code != 401:
                raise
            dimentica_token()
            stato, payload = inoltra(handler.command, targets[handler.path], body, content_type)
        handler.send_response(stato)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.end_headers()
        handler.wfile.write(payload)
    except HTTPError as error:
        dati = error.read()
        try:
            corpo = json.loads(dati or b"{}")
            if not isinstance(corpo, dict) or not corpo.get("message"):
                raise ValueError
        except ValueError:
            corpo = {"message": f"Il backend ha risposto con l'errore {error.code}"}
        risposta_json(handler, error.code, corpo)
    except (URLError, TimeoutError, OSError):
        errore(handler, 503, "Backend Ishtar Lab non disponibile. Avviare Ishtar Lab (Avvia Ishtar Lab.bat su Windows, ./avvia-ishtar-lab.sh su Linux/macOS) e riprovare.")
    except (ValueError, KeyError):
        errore(handler, 503, "Configurazione locale non valida")
