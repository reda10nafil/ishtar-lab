// Aiuti puri della pagina Chats: nessun DOM e nessuna richiesta (provati in verifiche/chat-casella.test.mjs).
// Gli orari usano l'orologio vero: gli aiuti del kit per le date seguono l'orologio dimostrativo, fermo al 30/10/2026.

const CANALI = {telegram: 'Telegram', email: 'Email', sito: 'Site chat', whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger'};
const STATI = {aperta: 'Open', in_attesa: 'Waiting for customer', chiusa: 'Closed'};

export const etichettaCanale = canale => CANALI[canale] ?? String(canale ?? '');
export const etichettaStato = stato => STATI[stato] ?? String(stato ?? '');
/** Mai vuoto: l'avatar del kit ricava le iniziali dal nome. */
export const nomeContatto = contatto => contatto?.nome?.trim() || contatto?.recapito?.trim() || 'Customer';

const ORA = new Intl.DateTimeFormat('en-GB', {hour: '2-digit', minute: '2-digit'});
const SETTIMANA = new Intl.DateTimeFormat('en-GB', {weekday: 'short'});
const GIORNO = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short'});
const GIORNO_ANNO = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});

const istante = quando => new Date(quando).getTime();
const mezzanotte = t => new Date(t).setHours(0, 0, 0, 0);
// Giorni di calendario fra le due date (ora locale); l'arrotondamento assorbe i giorni di 23 o 25 ore.
const giorniFa = (t, adesso) => Math.round((mezzanotte(adesso) - mezzanotte(t)) / 864e5);
const giorno = (t, adesso) => (new Date(t).getFullYear() === new Date(adesso).getFullYear() ? GIORNO : GIORNO_ANNO).format(t);

/** Orario dell'ultimo messaggio nell'elenco: «now», «5 min», «09:05», «Yesterday», «Tue», «6 Nov», «25 Dec 2025». */
export function quandoElenco(quando, adesso = Date.now()) {
  const t = istante(quando);
  if (!Number.isFinite(t)) return '';
  const trascorso = adesso - t;
  if (trascorso < 60e3) return 'now';
  if (trascorso < 3600e3) return `${Math.floor(trascorso / 60e3)} min`;
  const giorni = giorniFa(t, adesso);
  if (giorni <= 0) return ORA.format(t);
  if (giorni === 1) return 'Yesterday';
  if (giorni <= 6) return SETTIMANA.format(t);
  return giorno(t, adesso);
}

/** Orario sotto un messaggio: «09:05», «Yesterday, 23:59», «10 Nov, 14:00», «25 Dec 2025, 14:00». */
export function quandoMessaggio(quando, adesso = Date.now()) {
  const t = istante(quando);
  if (!Number.isFinite(t)) return '';
  const giorni = giorniFa(t, adesso), ora = ORA.format(t);
  if (giorni <= 0) return ora;
  if (giorni === 1) return `Yesterday, ${ora}`;
  return `${giorno(t, adesso)}, ${ora}`;
}

/** Importo nella valuta dell'ordine (gli importi di Medusa sono già in unità intere, per esempio 37.5). */
export function soldi(importo, valuta = 'eur') {
  const numero = Number(importo) || 0, codice = String(valuta || 'eur').toUpperCase();
  try {
    return new Intl.NumberFormat('en-GB', {style: 'currency', currency: codice}).format(numero);
  } catch {
    return `${numero.toFixed(2)} ${codice}`;
  }
}

const ORDINI = {
  completed: ['Completed', 'good'], canceled: ['Cancelled', 'bad'], pending: ['Pending', 'warn'],
  requires_action: ['Needs action', 'warn'], archived: ['Archived', 'plain'], draft: ['Draft', 'plain'],
};

/** Stato di un ordine con il tono dei `pill` del kit (good, bad, warn, plain). */
export function statoOrdine(stato) {
  const noto = ORDINI[stato];
  if (noto) return {testo: noto[0], tono: noto[1]};
  const testo = String(stato ?? '').replace(/_/g, ' ');
  return {testo: testo.charAt(0).toUpperCase() + testo.slice(1), tono: 'plain'};
}

/** Indirizzo dell'elenco nel ponte: stato e numero di righe sempre, canale e ricerca solo se presenti. */
export function percorsoElenco({stato = 'aperte', canale = '', q = '', quante = 50} = {}) {
  const parametri = new URLSearchParams({stato, limit: String(quante)});
  if (canale) parametri.set('canale', canale);
  if (q?.trim()) parametri.set('q', q.trim());
  return `/api/conversazioni?${parametri}`;
}

/**
 * Messaggi da mostrare: quelli del server nell'ordine ricevuto, poi le risposte ancora in attesa di quella conversazione.
 * Una risposta che il server ha già (stesso `id_client`) compare una volta sola, come riga del server, con l'esito
 * dell'ultimo tentativo fatto da qui: `inviando` (in corso: «Sending…» e nessun pulsante) oppure `tentativo` (non riuscito:
 * il motivo). `rimandate`: id delle risposte incerte già rimandate come risposte nuove.
 */
export function unisci(messaggi = [], inSospeso = [], conversazione_id, rimandate = []) {
  const mie = inSospeso.filter(r => r.conversazione_id === conversazione_id);
  const perId = new Map(mie.map(r => [r.id_client, r]));
  const giaRimandate = new Set(rimandate);
  const presenti = new Set();
  const server = messaggi.map(m => {
    if (!m.id_client) return m;
    presenti.add(m.id_client);
    const voce = perId.get(m.id_client);
    let riga = m;
    if (voce?.fase === 'invio') riga = {...riga, inviando: true};
    else if (voce) riga = {...riga, tentativo: {fase: voce.fase, errore: voce.errore}};
    if (giaRimandate.has(m.id_client)) riga = {...riga, rimandata: true};
    return riga;
  });
  return [...server, ...mie.filter(r => !presenti.has(r.id_client)).map(r => ({...r, locale: true}))];
}

/** Id dell'ultimo messaggio del server mostrato dalla pagina (`ultimo_visto` delle richieste), oppure null. */
export const ultimoVisto = messaggi => (messaggi?.length ? messaggi[messaggi.length - 1].id : null);

const NON_CONFERMATO = 'Not confirmed: the customer may have received it.';
const IN_CODA_DA = 60e3;

/**
 * Riga di stato sotto una risposta del team, con l'azione possibile:
 * `riprova` (stesso id: il server non la manda due volte), `rimanda` (id nuovo, dopo conferma), `modifica` (rifiutata).
 */
export function statoRisposta(m, adesso = Date.now()) {
  if (m?.locale) {
    if (m.fase === 'invio') return {testo: 'Sending…', tono: 'plain', azione: null};
    if (m.fase === 'attesa') return {testo: 'Not sent yet', tono: 'warn', azione: 'riprova'};
    return {testo: m.errore || 'Not sent', tono: 'bad', azione: 'modifica'};
  }
  if (m?.direzione !== 'uscita') return null;
  if (m.inviando) return {testo: 'Sending…', tono: 'plain', azione: null};
  if (m.tentativo?.fase === 'attesa') return {testo: 'Not sent yet', tono: 'warn', azione: 'riprova'};
  if (m.tentativo?.fase === 'rifiutato') return {testo: m.tentativo.errore || 'Not sent', tono: 'bad', azione: 'riprova'};
  switch (m.stato_consegna) {
    case 'inviato':
      return {testo: 'Sent', tono: 'good', azione: null};
    case 'in_coda':
      return adesso - istante(m.quando) < IN_CODA_DA
        ? {testo: 'Sending…', tono: 'plain', azione: null}
        : {testo: 'Still sending', tono: 'warn', azione: 'riprova'};
    case 'fallito':
      return {testo: !m.errore ? 'Not sent' : /^Not sent\b/.test(m.errore) ? m.errore : `Not sent: ${m.errore}`, tono: 'bad', azione: 'riprova'};
    case 'incerto':
      return m.rimandata
        ? {testo: 'Not confirmed: sent again as a new message.', tono: 'warn', azione: null}
        : {testo: NON_CONFERMATO, tono: 'warn', azione: 'rimanda'};
    default:
      return null;
  }
}

/** Messaggio in inglese per un errore delle richieste (ErroreRichiesta di api.mjs o un Error qualsiasi). */
const PONTE_VECCHIO = 'Restart Ishtar Lab to use Chats: the panel server running now is older than this page.';

export function testoErrore(errore) {
  if (errore?.stato === 0) return "The panel's local server is not responding.";
  // Pagina aggiornata ma server del pannello avviato prima dell'aggiornamento: il ponte vecchio non conosce i percorsi nuovi
  // (404 con il suo messaggio) e il server vecchio non conosce DELETE (501).
  if ((errore?.stato === 404 && errore.message === 'Indirizzo del ponte non riconosciuto') || errore?.stato === 501) return PONTE_VECCHIO;
  // 503 arriva dal ponte quando l'API non risponde: il suo messaggio è in italiano, qui si spiega in inglese come la pagina.
  if (errore?.stato === 503) return 'The Ishtar Lab server is not reachable. Start Ishtar Lab and try again.';
  if (errore?.message) return errore.message;
  return errore?.stato ? `Something went wrong (${errore.stato}).` : 'Something went wrong.';
}

/** Id di una risposta: il server riconosce un invio ripetuto con lo stesso id e non lo manda due volte. */
export const nuovoId = () => crypto.randomUUID().replaceAll('-', '');

// Email ----------------------------------------------------------------------------------------------------------------

const PREFISSI = /^\s*(?:(?:re|r|rif|aw|sv|antw)\s*(?:\[\d+\])?\s*:\s*)+/i;
const minuscolo = indirizzo => String(indirizzo ?? '').trim().toLowerCase();

/** Oggetto della risposta email: un solo «Re: » davanti. È la regola del server, che decide l'oggetto vero. */
export function oggettoRisposta(oggetto) {
  const resto = String(oggetto ?? '').replace(PREFISSI, '').trim();
  return `Re: ${resto || 'Your message'}`;
}

/**
 * Ultimo messaggio del cliente, in ordine di arrivo (anche un segnaposto senza dettagli): la risposta continua il suo filo.
 * Si salta un'email che non passa DMARC (forse falsa), come fa il server.
 */
export function ultimaEmail(messaggi) {
  for (let i = (messaggi?.length ?? 0) - 1; i >= 0; i--) {
    const m = messaggi[i];
    if (m?.direzione === 'entrata' && m.email?.verifica !== 'non_verificato') return m;
  }
  return null;
}

/** Avviso nella bolla di un'email che non passa DMARC: l'indirizzo del mittente può essere falso. */
export const avvisoVerifica = m => (m?.email?.verifica === 'non_verificato'
  ? 'This email failed the sender check (DMARC): it may not come from this address.'
  : null);

/** Verifica del contatto per la proposta del cliente: «non verificato» se una sua email non è passata, altrimenti l'ultima. */
export function verificaContatto(messaggi) {
  const dalCliente = (messaggi ?? []).filter(m => m?.direzione === 'entrata' && m.email);
  if (dalCliente.some(m => m.email.verifica === 'non_verificato')) return 'non_verificato';
  return dalCliente.length ? dalCliente[dalCliente.length - 1].email.verifica ?? null : null;
}

/** Invio con il tasto Invio: nelle chat email Invio va a capo e si invia con Ctrl o Cmd + Invio (un'email non si ritira). */
export function inviaConTasto(evento, email) {
  if (evento?.key !== 'Enter' || evento.isComposing) return false;
  return email ? Boolean(evento.ctrlKey || evento.metaKey) : !evento.shiftKey;
}

/** Avviso quando l'email chiede di rispondere a un altro indirizzo: le risposte vanno sempre a chi l'ha mandata. */
export function avvisoRispondiA(messaggio, mittente) {
  const altro = messaggio?.email?.reply_to?.trim();
  if (!altro || minuscolo(altro) === minuscolo(mittente)) return null;
  return `This email asks to reply to ${altro}. Replies go to ${mittente}, the sender's address.`;
}

/** Clienti con lo stesso indirizzo email (uguale, senza maiuscole): una proposta solo se è uno solo, altrimenti l'elenco. */
export function clienteConEmail(clienti, indirizzo) {
  const cercato = minuscolo(indirizzo);
  const elenco = cercato ? (clienti ?? []).filter(c => minuscolo(c?.email) === cercato) : [];
  return {proposta: elenco.length === 1 ? elenco[0] : null, elenco};
}

/** Esito della verifica del mittente detto in chiaro: DMARC verifica il dominio, non la persona. */
export const testoVerifica = verifica => (verifica === 'verificato'
  ? "The sender's domain is verified (DMARC)"
  : "The sender's address is not verified: it can be forged");

const misura = byte => (byte >= 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(byte / 1024))} KB`);

/** Testo intero di un'email con le citazioni, seguito dalle righe degli allegati come nel testo mostrato di solito. */
export function testoCompleto(m) {
  const completo = m?.email?.testo_completo;
  if (!completo) return m?.testo ?? '';
  const allegati = (m.email.allegati ?? []).map(a => `[Attachment: ${a.nome}, ${misura(a.byte)}]`).join('\n');
  return [completo, allegati].filter(Boolean).join('\n\n');
}
