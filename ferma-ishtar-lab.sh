#!/usr/bin/env bash
# Ishtar Lab — arresto su Linux/macOS: ferma pannello, API e servizi Docker di questa copia.
# I dati restano nei volumi; nessun altro processo o container viene toccato.
set -uo pipefail
# Risale alla cartella reale dello script anche se lanciato da un collegamento simbolico.
sorgente="${BASH_SOURCE[0]}"
while [ -L "$sorgente" ]; do
  cartella="$(cd -P "$(dirname "$sorgente")" && pwd)"
  sorgente="$(readlink "$sorgente")"
  case "$sorgente" in /*) ;; *) sorgente="$cartella/$sorgente" ;; esac
done
cd -P "$(dirname "$sorgente")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js non trovato."
  exit 1
fi
node tools/ferma-ishtar-lab.mjs "$@"
