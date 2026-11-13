// Chi può ricevere il token del proprietario da /__accesso-locale (server di sviluppo, vite.config.ts): solo le pagine
// della console aperte su questo PC. Serve anche il nome dell'host: con il DNS rebinding un sito esterno può risultare
// «same-origin» usando un suo nome che punta a 127.0.0.1. Il controllo degli host di Vite non copre questa rotta,
// perché i middleware dei plugin vengono montati prima del suo. Verificato in verifiche/accesso-locale.test.mjs.

export const hostLocali = (porta) => [`localhost:${porta}`, `127.0.0.1:${porta}`, `[::1]:${porta}`];

export function richiestaLocale(intestazioni, porta) {
  const host = String(intestazioni.host ?? '').toLowerCase();
  if (!hostLocali(porta).includes(host)) return false;
  if (intestazioni['sec-fetch-site'] !== 'same-origin') return false;
  const origine = intestazioni.origin;
  return origine === undefined || String(origine).toLowerCase() === `http://${host}`;
}

// La console non si apre dentro pagine di altri siti: incorniciata, entrerebbe comunque come proprietario e un sito
// esterno potrebbe indurre clic ingannevoli.
export const intestazioniSicure = { 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "frame-ancestors 'none'" };
