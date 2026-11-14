// Collegamento alla casella della chat (progetto Supabase dedicato) con la sola chiave pubblicabile. Si carica solo
// quando serve: all'apertura della chat o, se il visitatore ha già una conversazione, per vedere le risposte nuove.
// Il visitatore entra come utente anonimo (con il controllo Turnstile) con l'AuthClient di supabase-js, che conserva e
// rinnova la sessione; le funzioni del visitatore si chiamano su /rest/v1/rpc con fetch (solo quelle servono: Realtime,
// Storage e Functions restano fuori dal file).
import {AuthClient} from '@supabase/supabase-js';
import {archivioSessione, CHIAVE_SESSIONE} from './archivio.mjs';

/** Una chiave JWT (quella vecchia di Supabase) va anche come Bearer; la chiave pubblicabile nuova mai. */
const jwt = chiave => /^[\w-]+\.[\w-]+\.[\w-]+$/.test(chiave);

/** Attesa massima di ogni richiesta: una richiesta ferma finisce in «Non inviato» o in una lettura fallita, non blocca tutto. */
const ATTESA_MS = 15000;
function conAttesa(segnale) {
  const tempo = globalThis.AbortSignal?.timeout?.(ATTESA_MS);
  if (!segnale) return tempo;
  return tempo && AbortSignal.any ? AbortSignal.any([segnale, tempo]) : segnale;
}

export function creaCasella(config) {
  const archivio = archivioSessione(config.ricorda);
  const auth = new AuthClient({
    url: `${config.url}/auth/v1`,
    headers: {apikey: config.chiave, ...(jwt(config.chiave) ? {authorization: `Bearer ${config.chiave}`} : {})},
    storageKey: CHIAVE_SESSIONE,
    storage: archivio,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    fetch: (indirizzo, opzioni = {}) => fetch(indirizzo, {...opzioni, signal: conAttesa(opzioni.signal)}),
  });
  /**
   * Stato dell'accesso: la sessione valida (rinnovata se serve), l'eventuale errore del rinnovo e se una sessione è ancora
   * salvata. Una sessione salvata che ora non si rinnova (rete o servizio fuori uso) resta del visitatore: auth-js la toglie
   * solo quando non vale più.
   */
  const accesso = async () => {
    const {data, error} = await auth.getSession();
    return {sessione: data.session ?? null, errore: error ?? null, salvata: Boolean(archivio.getItem(CHIAVE_SESSIONE))};
  };
  const sessione = async () => (await accesso()).sessione;
  /** Errori con il codice di PostgREST (PTxyz dei rifiuti della casella), mai il corpo intero. */
  async function rpc(nome, argomenti) {
    const accesso = await sessione();
    const bearer = accesso?.access_token ?? (jwt(config.chiave) ? config.chiave : null);
    const risposta = await fetch(`${config.url}/rest/v1/rpc/${nome}`, {
      method: 'POST',
      headers: {'content-type': 'application/json', apikey: config.chiave, ...(bearer ? {authorization: `Bearer ${bearer}`} : {})},
      body: JSON.stringify(argomenti),
      credentials: 'omit',
      redirect: 'error',
      signal: conAttesa(),
    });
    const testo = await risposta.text();
    let dati = null;
    try {
      dati = testo ? JSON.parse(testo) : null;
    } catch {
      dati = null;
    }
    if (!risposta.ok) throw Object.assign(new Error(typeof dati?.message === 'string' ? dati.message : `HTTP ${risposta.status}`), {code: dati?.code ?? null, status: risposta.status});
    return dati;
  }
  return {
    accesso,
    sessione,
    entra: async captchaToken => {
      const {data, error} = await auth.signInAnonymously(captchaToken ? {options: {captchaToken}} : undefined);
      if (error) throw error;
      return data.session;
    },
    scrivi: (id_client, testo, pagina) => rpc('chat_scrivi', {p_id_client: id_client, p_testo: testo, p_pagina: pagina}),
    profilo: (nome, email) => rpc('chat_profilo', {p_nome: nome, p_email: email}),
    leggi: () => rpc('chat_leggi', {p_dopo: null, p_limite: 50}),
    stato: () => rpc('chat_stato', {}),
    ricordata: () => archivio.ricordata(),
    ricorda: si => archivio.ricorda(si),
  };
}
