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

def handle(handler):
    if handler.headers.get("Host") != "127.0.0.1:4273" or handler.headers.get("Origin", ORIGIN) != ORIGIN or handler.headers.get("Sec-Fetch-Site", "same-origin") not in ("same-origin", "none"):
        handler.send_error(403, "Accesso solo dal pannello locale")
        return
    if handler.headers.get("X-Ishtar-Local") != "1":
        handler.send_error(403, "Aprire il catalogo dal pannello Ishtar Lab")
        return
    targets = {"/api/catalogo": "/admin/ishtar/catalogo", "/api/foto": "/admin/uploads"}
    if handler.path not in targets or handler.command not in ("GET", "POST") or (handler.path == "/api/foto" and handler.command != "POST"):
        handler.send_error(404)
        return
    try:
        length = int(handler.headers.get("Content-Length", "0"))
        if length < 0 or length > 25 * 1024 * 1024:
            handler.send_error(413, "Il caricamento supera 25 MB")
            return
        body = handler.rfile.read(length) if handler.command == "POST" else None
        content_type = handler.headers.get("Content-Type", "application/json")
        if handler.path == "/api/catalogo" and handler.command == "POST" and not content_type.startswith("application/json"):
            handler.send_error(415)
            return
        request = Request(API + targets[handler.path], data=body, method=handler.command,
                          headers={"Authorization": "Bearer " + token(), "Content-Type": content_type})
        with urlopen(request, timeout=180) as response:
            payload = response.read()
            handler.send_response(response.status)
            handler.send_header("Content-Type", "application/json; charset=utf-8")
            handler.end_headers()
            handler.wfile.write(payload)
    except HTTPError as error:
        handler.send_response(error.code)
        handler.send_header("Content-Type", "application/json")
        handler.end_headers()
        handler.wfile.write(error.read())
    except (URLError, TimeoutError, OSError):
        handler.send_response(503)
        handler.send_header("Content-Type", "application/json")
        handler.end_headers()
        handler.wfile.write(json.dumps({"message":"Backend Ishtar Lab non disponibile. Avviare Ishtar Lab (Avvia Ishtar Lab.bat su Windows, ./avvia-ishtar-lab.sh su Linux/macOS) e riprovare."}).encode())
    except (ValueError, KeyError):
        handler.send_error(503, "Configurazione locale non valida")
