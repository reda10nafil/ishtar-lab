"""Anteprima locale della copia recuperata; nessuna dipendenza esterna."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen
import argparse
import threading
import webbrowser
from catalog_bridge import handle as handle_catalog

ROOT = Path(__file__).resolve().parent / "frontend"
HOST = "127.0.0.1"
PORT = 4273
URL = f"http://{HOST}:{PORT}/ishtar-lab/#/home"
IDENTIFIER = "redx-pannello-recuperato-2026-11-06"


def indirizzo_canonico(host, percorso):
    """Il ponte accetta solo l'host 127.0.0.1:4273: chi apre localhost:4273 viene reindirizzato lì."""
    if str(host).lower() == f"localhost:{PORT}":
        return f"http://{HOST}:{PORT}{percorso}"
    return None


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
    }

    def end_headers(self):
        self.send_header("X-Redx-Recovery", IDENTIFIER)
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        canonico = indirizzo_canonico(self.headers.get("Host", ""), self.path)
        if canonico:
            self.send_response(302)
            self.send_header("Location", canonico)
            self.end_headers()
            return
        if self.path.startswith("/api/"):
            handle_catalog(self)
            return
        path = urlsplit(self.path).path
        if path in ("/", "/ishtar-lab"):
            self.send_response(302)
            self.send_header("Location", "/ishtar-lab/" + ("#/home" if path == "/" else ""))
            self.end_headers()
            return
        if path == "/lumelle" or path.startswith("/lumelle/"):
            # Un Location senza frammento conserva #/products e gli altri bookmark.
            target = "/ishtar-lab" + self.path[len("/lumelle"):]
            if path == "/lumelle":
                parsed = urlsplit(self.path)
                target = "/ishtar-lab/" + ("?" + parsed.query if parsed.query else "")
            self.send_response(302)
            self.send_header("Location", target)
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        handle_catalog(self)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--open", action="store_true", help="Apre il browser")
    args = parser.parse_args()
    if not (ROOT / "ishtar-lab" / "index.html").is_file():
        raise SystemExit("Manca frontend/ishtar-lab/index.html: conservare la struttura delle cartelle.")
    try:
        server = ThreadingHTTPServer((HOST, PORT), partial(Handler, directory=str(ROOT)))
    except OSError as error:
        try:
            with urlopen(f"http://{HOST}:{PORT}/ishtar-lab/", timeout=2) as response:
                existing = response.headers.get("X-Redx-Recovery") == IDENTIFIER
        except OSError:
            existing = False
        if existing:
            print(f"La copia del pannello è già aperta: {URL}")
            if args.open:
                webbrowser.open(URL)
            return
        raise SystemExit(f"Porta {PORT} non disponibile. Nessun processo è stato fermato. {error}")
    print(f"Pannello recuperato: {URL}", flush=True)
    print("Lascia aperta questa finestra. Per fermare questa copia premi Ctrl+C.", flush=True)
    if args.open:
        threading.Timer(0.5, webbrowser.open, args=(URL,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
