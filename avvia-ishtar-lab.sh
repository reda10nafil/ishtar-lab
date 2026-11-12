#!/usr/bin/env bash
# Ishtar Lab — avvio su Linux/macOS, equivalente di «Avvia Ishtar Lab.bat».
# Avvia servizi Docker, API e pannello di questa copia, poi apre http://127.0.0.1:4273/ishtar-lab/#/home
# (--no-browser per non aprire il browser).
set -uo pipefail
# Risale alla cartella reale dello script anche se lanciato da un collegamento simbolico.
sorgente="${BASH_SOURCE[0]}"
while [ -L "$sorgente" ]; do
  cartella="$(cd -P "$(dirname "$sorgente")" && pwd)"
  sorgente="$(readlink "$sorgente")"
  case "$sorgente" in /*) ;; *) sorgente="$cartella/$sorgente" ;; esac
done
cd -P "$(dirname "$sorgente")" || exit 1
[ -d "$HOME/.bun/bin" ] && PATH="$HOME/.bun/bin:$PATH"
echo "Avvio di Ishtar Lab. Attendi la preparazione dei servizi..."
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js non trovato. Controlla l'installazione di Ishtar Lab."
  exit 1
fi
if ! node tools/apri-ishtar-lab.mjs "$@"; then
  echo
  echo "Avvio non riuscito. Leggi il messaggio qui sopra."
  exit 1
fi
