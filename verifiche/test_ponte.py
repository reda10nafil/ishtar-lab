"""Test del ponte locale catalog_bridge.py e del server avvia_pannello.py, contro un'API finta: nessun dato reale.

Esecuzione: python3 -m unittest verifiche/test_ponte.py
"""
import io
import json
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import avvia_pannello  # noqa: E402
import catalog_bridge as ponte  # noqa: E402


class FintaAPI(BaseHTTPRequestHandler):
    emessi = []
    validi = set()
    errore = None  # (codice, corpo grezzo) restituito dal catalogo al posto dei dati

    def _json(self, codice, corpo):
        dati = json.dumps(corpo).encode()
        self.send_response(codice)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(dati)))
        self.end_headers()
        self.wfile.write(dati)

    def _catalogo(self):
        if self.headers.get("Authorization", "").removeprefix("Bearer ") not in FintaAPI.validi:
            self._json(401, {"message": "Unauthorized"})
            return
        if FintaAPI.errore:
            codice, corpo = FintaAPI.errore
            self.send_response(codice)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(corpo)))
            self.end_headers()
            self.wfile.write(corpo)
            return
        self._json(200, {"products": [], "fields": [], "categories": []})

    def do_POST(self):
        lunghezza = int(self.headers.get("Content-Length", 0))
        self.rfile.read(lunghezza)
        if self.path == "/auth/user/emailpass":
            token = f"tok-{len(FintaAPI.emessi) + 1}"
            FintaAPI.emessi.append(token)
            self._json(200, {"token": token})
            return
        self._catalogo()

    def do_GET(self):
        self._catalogo()

    def log_message(self, *args):
        pass


class Richiesta:
    """Imita l'handler HTTP che avvia_pannello.py passa a catalog_bridge.handle."""

    def __init__(self, path="/api/catalogo", command="GET", headers=None, corpo=b""):
        self.path, self.command = path, command
        self.headers = {"Host": "127.0.0.1:4273", "Origin": "http://127.0.0.1:4273", "X-Ishtar-Local": "1",
                        "Content-Length": str(len(corpo)), **(headers or {})}
        self.rfile, self.wfile = io.BytesIO(corpo), io.BytesIO()
        self.stato, self.intestazioni = None, {}

    def send_response(self, codice, messaggio=None):
        self.stato = codice

    def send_header(self, chiave, valore):
        self.intestazioni[chiave] = valore

    def end_headers(self):
        pass

    def send_error(self, codice, messaggio=None):
        self.stato = codice
        self.wfile.write(f"<html><body>{messaggio}</body></html>".encode())

    def risposta(self):
        return json.loads(self.wfile.getvalue().decode() or "{}")


class Ponte(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), FintaAPI)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        FintaAPI.emessi, FintaAPI.validi, FintaAPI.errore = [], set(), None
        self.originali = (ponte.API, ponte.credentials)
        ponte.API = f"http://127.0.0.1:{self.server.server_port}"
        ponte.credentials = lambda: {"ADMIN_EMAIL": "proprietario@esempio.invalid", "ADMIN_PASSWORD": "prova"}
        ponte._token, ponte._until = "", 0

    def tearDown(self):
        ponte.API, ponte.credentials = self.originali
        ponte._token, ponte._until = "", 0
        self.server.shutdown()
        self.server.server_close()

    def test_errori_del_ponte_in_json_leggibile(self):
        casi = [Richiesta(headers={"Host": "esterno.example:4273"}), Richiesta(headers={"X-Ishtar-Local": "0"}),
                Richiesta(path="/api/sconosciuta"), Richiesta(command="POST", headers={"Content-Length": str(30 * 1024 * 1024)}),
                Richiesta(command="POST", headers={"Content-Type": "text/plain"}, corpo=b"x")]
        for richiesta, atteso in zip(casi, (403, 403, 404, 413, 415)):
            ponte.handle(richiesta)
            self.assertEqual(richiesta.stato, atteso)
            self.assertTrue(richiesta.risposta().get("message"), f"{atteso}: manca il messaggio JSON")

    def test_accesso_scaduto_rinnovato_una_volta(self):
        FintaAPI.validi = {"tok-2"}
        ponte._token, ponte._until = "", 0
        richiesta = Richiesta()
        ponte.handle(richiesta)
        self.assertEqual(richiesta.stato, 200)
        self.assertEqual(FintaAPI.emessi, ["tok-1", "tok-2"])

    def test_accesso_rifiutato_anche_dopo_il_rinnovo(self):
        richiesta = Richiesta()
        ponte.handle(richiesta)
        self.assertEqual(richiesta.stato, 401)
        self.assertEqual(len(FintaAPI.emessi), 2, "un solo nuovo tentativo, senza cicli")
        self.assertTrue(richiesta.risposta().get("message"))

    def test_api_spenta_messaggio_chiaro(self):
        ponte.API = "http://127.0.0.1:9"
        richiesta = Richiesta()
        ponte.handle(richiesta)
        self.assertEqual(richiesta.stato, 503)
        self.assertIn("non disponibile", richiesta.risposta()["message"])


    def test_errore_del_backend_con_carattere_non_codificabile(self):
        # Un surrogato isolato nel messaggio non deve far cadere la connessione (il pannello la tratterebbe come rete assente).
        FintaAPI.validi, FintaAPI.errore = {"tok-1"}, (400, b'{"message": "valore \\ud800 non valido"}')
        richiesta = Richiesta()
        ponte.handle(richiesta)
        self.assertEqual(richiesta.stato, 400)
        self.assertIn("non valido", richiesta.risposta()["message"])

    def test_errore_del_backend_senza_json(self):
        FintaAPI.validi, FintaAPI.errore = {"tok-1"}, (500, b"<html>errore</html>")
        richiesta = Richiesta()
        ponte.handle(richiesta)
        self.assertEqual(richiesta.stato, 500)
        self.assertEqual(richiesta.risposta()["message"], "Il backend ha risposto con l'errore 500")


class Server(unittest.TestCase):
    def test_localhost_reindirizzato_a_127(self):
        self.assertEqual(avvia_pannello.indirizzo_canonico("localhost:4273", "/ishtar-lab/#/products"),
                         "http://127.0.0.1:4273/ishtar-lab/#/products")
        self.assertEqual(avvia_pannello.indirizzo_canonico("LOCALHOST:4273", "/api/catalogo"), "http://127.0.0.1:4273/api/catalogo")
        self.assertIsNone(avvia_pannello.indirizzo_canonico("127.0.0.1:4273", "/ishtar-lab/"))
        self.assertIsNone(avvia_pannello.indirizzo_canonico("esterno.example:4273", "/ishtar-lab/"))

    def test_moduli_mjs_serviti_come_javascript(self):
        self.assertEqual(avvia_pannello.Handler.extensions_map.get(".mjs"), "text/javascript")


if __name__ == "__main__":
    unittest.main()
