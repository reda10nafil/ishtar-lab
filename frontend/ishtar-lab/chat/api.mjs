// Richieste della pagina Chats al ponte locale (catalog_bridge.py), che aggiunge l'accesso del proprietario lato server.
// Provate in verifiche/chat-api.test.mjs con un fetch finto.

/** Errore di una richiesta: `stato` 0 = rete o ponte irraggiungibili; altrimenti il codice HTTP, con codice e dati del server. */
export class ErroreRichiesta extends Error {
  constructor(messaggio, {stato = 0, codice, dati} = {}) {
    super(messaggio);
    this.name = 'ErroreRichiesta';
    this.stato = stato;
    this.codice = codice;
    this.dati = dati;
  }
}

export async function richiesta(percorso, {metodo = 'GET', corpo, fetch: prendi} = {}) {
  const intestazioni = {'X-Ishtar-Local': '1'};
  if (corpo !== undefined) intestazioni['Content-Type'] = 'application/json';
  const opzioni = {method: metodo, headers: intestazioni, ...(corpo !== undefined ? {body: JSON.stringify(corpo)} : {})};
  let risposta;
  try {
    risposta = await (prendi ?? globalThis.fetch.bind(globalThis))(percorso, opzioni);
  } catch {
    throw new ErroreRichiesta('Network error', {stato: 0});
  }
  let dati;
  try {
    dati = await risposta.json();
  } catch {
    // Corpo illeggibile: con una risposta riuscita la scrittura può essere avvenuta, l'esito non si conosce (stato 0).
    throw new ErroreRichiesta(`Request failed (${risposta.status})`, {stato: risposta.ok ? 0 : risposta.status});
  }
  if (!risposta.ok) throw new ErroreRichiesta(dati?.message || `Request failed (${risposta.status})`, {stato: risposta.status, codice: dati?.code, dati});
  return dati;
}
