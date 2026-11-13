"""Ponte same-origin del solo pannello locale al backend isolato autenticato.
Le credenziali rimangono sul server. Nessun proxy aperto verso URL arbitrari.
"""
import json
import re
import threading
import time
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent
API = "http://127.0.0.1:9273"
ORIGIN = "http://127.0.0.1:4273"
_lock = threading.Lock()
_token = ""
_until = 0

CATALOGO = {"/api/catalogo": "/admin/ishtar/catalogo", "/api/foto": "/admin/uploads"}
_ID = "[0-9A-Za-z]{8,64}"
# Casella dei clienti (pagina Chats): metodi, percorso del pannello, destinazione nell'API, parametri ammessi.
# Gli id si riconoscono dal prefisso: un percorso con «..», caratteri codificati o un id di un altro tipo non passa.
CASELLA = [
    ({"GET"}, re.compile(r"/api/conversazioni"), "/admin/conversazioni", {"stato", "canale", "q", "limit", "offset"}),
    ({"GET"}, re.compile(rf"/api/conversazioni/(conv_{_ID})"), "/admin/conversazioni/{0}", set()),
    ({"POST"}, re.compile(rf"/api/conversazioni/(conv_{_ID})/(messaggi|stato|letta|cliente)"), "/admin/conversazioni/{0}/{1}", set()),
    ({"GET", "POST"}, re.compile(r"/api/risposte-rapide"), "/admin/risposte-rapide", set()),
    ({"POST", "DELETE"}, re.compile(rf"/api/risposte-rapide/(rrap_{_ID})"), "/admin/risposte-rapide/{0}", set()),
    ({"GET"}, re.compile(r"/api/clienti"), "/admin/clienti", {"q", "limit"}),
    ({"GET"}, re.compile(rf"/api/clienti/(cus_{_ID})"), "/admin/clienti/{0}", set()),
]
LIMITE_CATALOGO = 25 * 1024 * 1024
LIMITE_CASELLA = 64 * 1024
NON_RICONOSCIUTO = "Indirizzo del ponte non riconosciuto"


class Rifiuto(Exception):
    def __init__(self, codice, messaggio):
        super().__init__(messaggio)
        self.codice = codice


def instrada(metodo, indirizzo):
    """Destinazione nell'API e limite del corpo per un indirizzo previsto; Rifiuto per tutto il resto."""
    parti = urlsplit(indirizzo)
    if parti.path in CATALOGO:
        if parti.query or metodo not in ("GET", "POST") or (parti.path == "/api/foto" and metodo != "POST"):
            raise Rifiuto(404, NON_RICONOSCIUTO)
        return CATALOGO[parti.path], LIMITE_CATALOGO
    for metodi, modello, destinazione, ammessi in CASELLA:
        trovato = modello.fullmatch(parti.path)
        if not trovato:
            continue
        if metodo not in metodi or (parti.query and not ammessi):
            raise Rifiuto(404, NON_RICONOSCIUTO)
        # Parametri riletti e ricodificati: un «&» codificato resta dentro il suo valore, niente chiavi in più o ripetute.
        parametri = parse_qs(parti.query, keep_blank_values=True)
        if any(k not in ammessi or len(v) != 1 or len(v[0]) > 200 for k, v in parametri.items()):
            raise Rifiuto(400, "Parametro non ammesso dal ponte")
        query = urlencode({k: v[0] for k, v in parametri.items()})
        return destinazione.format(*trovato.groups()) + (f"?{query}" if query else ""), LIMITE_CASELLA
    raise Rifiuto(404, NON_RICONOSCIUTO)

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
    try:
        destinazione, limite = instrada(handler.command, handler.path)
    except Rifiuto as rifiuto:
        errore(handler, rifiuto.codice, str(rifiuto))
        return
    try:
        length = int(handler.headers.get("Content-Length", "0"))
        if length < 0 or length > limite:
            errore(handler, 413, "Il caricamento supera 25 MB" if limite == LIMITE_CATALOGO else "Richiesta troppo grande per il ponte")
            return
        body = handler.rfile.read(length) if handler.command == "POST" else None
        content_type = handler.headers.get("Content-Type", "application/json")
        if handler.command == "POST" and destinazione != CATALOGO["/api/foto"] and not content_type.startswith("application/json"):
            errore(handler, 415, "Il catalogo accetta solo dati JSON" if destinazione == CATALOGO["/api/catalogo"] else "La casella accetta solo dati JSON")
            return
        try:
            stato, payload = inoltra(handler.command, destinazione, body, content_type)
        except HTTPError as scaduto:
            # Accesso scaduto o revocato: si rinnova il token una sola volta e si ripete la richiesta (le risposte della
            # casella hanno un id: ripetute non partono due volte).
            if scaduto.code != 401:
                raise
            dimentica_token()
            stato, payload = inoltra(handler.command, destinazione, body, content_type)
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
