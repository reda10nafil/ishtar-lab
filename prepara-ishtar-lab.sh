#!/usr/bin/env bash
# Ishtar Lab — preparazione su Linux/macOS, equivalente di «Prepara Ishtar Lab.bat».
# Richiede Node.js >= 22.22, python3, Bun 1.4.4 e Docker con il plugin compose. Va eseguito una sola volta;
# --check controlla solo i prerequisiti, --riprendi completa una preparazione interrotta.
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
if ! command -v node >/dev/null 2>&1; then
  echo "Installare Node.js (almeno 22.22) prima della preparazione."
  exit 1
fi
if ! node tools/prepara-installazione.mjs "$@"; then
  echo "Preparazione non completata. Leggere il messaggio sopra."
  exit 1
fi
