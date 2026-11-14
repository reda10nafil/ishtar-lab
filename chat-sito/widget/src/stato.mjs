// Stato puro del widget della chat del sito: nessun DOM e nessuna rete (provato in verifiche/chat-sito-widget.test.mjs).
// I messaggi del visitatore aspettano «in sospeso» con il loro id_client finché la casella non li conferma; le letture
// della casella arrivano come righe e si uniscono per id, in ordine di creazione.

export const MASSIMO_TESTO = 4000;
const MASSIMO_PAGINA = 500;
const ERRORI_OFFLINE = 3;

export const statoIniziale = () => ({bozza: '', messaggi: [], inSospeso: [], negozio: null, erroriLettura: 0});

const lunghezza = testo => [...String(testo ?? '')].length;

/** Ordine della conversazione: istante di creazione nella casella, poi id (come chat_leggi). */
function ordine(a, b) {
  const ta = Date.parse(a.creato_il), tb = Date.parse(b.creato_il);
  if (ta !== tb && !Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
  if (a.creato_il !== b.creato_il) return a.creato_il < b.creato_il ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Solo righe con la forma di chat_leggi; di ognuna si tengono i campi noti, come testo. */
const valida = r => !!r && typeof r === 'object' && typeof r.id === 'string' && (r.direzione === 'entrata' || r.direzione === 'uscita')
  && typeof r.testo === 'string' && typeof r.creato_il === 'string';
const pulita = r => ({
  id: r.id, direzione: r.direzione, testo: r.testo, firma: typeof r.firma === 'string' ? r.firma : null, creato_il: r.creato_il, importato: r.importato === true,
});

function aggiorna(s, id_client, cambi, ammesso = () => true) {
  const indice = s.inSospeso.findIndex(m => m.id_client === id_client);
  if (indice < 0 || !ammesso(s.inSospeso[indice])) return s;
  const inSospeso = s.inSospeso.slice();
  inSospeso[indice] = {...inSospeso[indice], ...cambi};
  return {...s, inSospeso};
}

/**
 * Azioni: `bozza` (testo scritto), `invia` (consuma la bozza: un doppio clic manda un solo messaggio), `inviato` (la
 * casella ha confermato: solo ora «Sent»), `non_inviato`, `riprova` (stesso id_client: la casella non lo duplica),
 * `letti` (righe di chat_leggi), `negozio` (chat_stato), `errore_lettura`.
 */
export function riduci(s, a) {
  switch (a?.tipo) {
    case 'bozza':
      return {...s, bozza: String(a.testo ?? '')};
    case 'invia': {
      const testo = s.bozza;
      if (!testo.trim() || lunghezza(testo) > MASSIMO_TESTO || !a.id_client) return s;
      return {...s, bozza: '', inSospeso: [...s.inSospeso, {id_client: a.id_client, testo, fase: 'invio', quando: a.adesso ?? Date.now(), errore: null}]};
    }
    case 'inviato': {
      const s2 = aggiorna(s, a.id_client, {fase: 'inviato', id: a.id, creato_il: a.creato_il, errore: null});
      // Già arrivato con una lettura: resta solo quello della casella.
      return s2.messaggi.some(m => m.id === a.id) ? {...s2, inSospeso: s2.inSospeso.filter(m => m.id_client !== a.id_client)} : s2;
    }
    case 'non_inviato':
      return aggiorna(s, a.id_client, {fase: 'errore', errore: a.errore ?? null});
    case 'riprova':
      return aggiorna(s, a.id_client, {fase: 'invio', errore: null}, m => m.fase === 'errore');
    case 'letti': {
      if (!Array.isArray(a.righe)) return s;
      const perId = new Map(s.messaggi.map(m => [m.id, m]));
      for (const r of a.righe) if (valida(r)) perId.set(r.id, pulita(r));
      const messaggi = [...perId.values()].sort(ordine);
      const letti = new Set(messaggi.map(m => m.id));
      return {...s, messaggi, inSospeso: s.inSospeso.filter(m => !(m.id && letti.has(m.id))), erroriLettura: 0};
    }
    case 'negozio':
      return {...s, negozio: {online: a.online === true, nome: typeof a.nome === 'string' ? a.nome : null}, erroriLettura: 0};
    case 'errore_lettura':
      return {...s, erroriLettura: s.erroriLettura + 1};
    default:
      return s;
  }
}

/** Messaggi da mostrare: quelli della casella in ordine, poi quelli ancora in sospeso nell'ordine di scrittura. */
export const vista = s => [...s.messaggi, ...s.inSospeso];

/** Riga di stato sotto un messaggio del visitatore (null per le risposte del negozio). */
export function etichetta(m, t) {
  if (m?.fase === 'invio') return {testo: t.invio, riprova: false};
  if (m?.fase === 'errore') return {testo: t.nonInviato, riprova: true};
  if (m?.fase === 'inviato') return {testo: t.inviato, riprova: false};
  if (m?.direzione === 'entrata') return {testo: m.importato ? t.consegnato : t.inviato, riprova: false};
  return null;
}

/** «online» (Ishtar Lab ha letto da poco), «away», «offline» (la casella non risponde), null finché non si sa. */
export function statoNegozio(s) {
  if (s.erroriLettura >= ERRORI_OFFLINE) return 'offline';
  if (!s.negozio) return null;
  return s.negozio.online ? 'online' : 'away';
}

/** Attesa crescente (raddoppia a ogni tentativo) con una parte casuale del ±20%, mai oltre il massimo. */
export function attesa(tentativi, {base, massimo}, caso = Math.random) {
  return Math.round(Math.min(massimo, base * 2 ** Math.max(0, tentativi) * (0.8 + 0.4 * caso())));
}

/** Ogni quanto leggere: 4 secondi a chat aperta, 60 a chat chiusa con una conversazione, mai senza conversazione. */
export function intervalloLettura({aperta, conversazione, errori = 0}, caso = Math.random) {
  if (aperta) return attesa(errori, {base: 4000, massimo: 60000}, caso);
  if (conversazione) return attesa(errori, {base: 60000, massimo: 300000}, caso);
  return null;
}

const PROGETTO = /^https:\/\/[a-z]{20}\.supabase\.co$/;
const LOCALE = /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/;
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z0-9-]{2,}$/i;

/** Ruolo dentro una chiave JWT (le chiavi vecchie di Supabase): «anon» si può pubblicare, «service_role» mai. */
function ruoloJwt(chiave) {
  const parti = chiave.split('.');
  if (parti.length !== 3) return null;
  try {
    return JSON.parse(atob(parti[1].replace(/-/g, '+').replace(/_/g, '/')))?.role ?? null;
  } catch {
    return null;
  }
}

/** Configurazione dagli attributi data- dello script; `{errore}` se il widget non deve partire. */
export function configurazione(d = {}) {
  const url = String(d?.url ?? '').trim().replace(/\/$/, '');
  if (!PROGETTO.test(url) && !LOCALE.test(url)) return {errore: 'data-url: use the chat project URL, for example https://abcdefghijklmnopqrst.supabase.co'};
  const chiave = String(d?.chiave ?? '').trim();
  if (!chiave) return {errore: 'data-chiave: add the publishable key of the chat project'};
  if (/^sb_secret_/.test(chiave) || ruoloJwt(chiave) === 'service_role') {
    return {errore: 'data-chiave: this is the secret key. Never put it in the site: use the publishable key, and replace the secret key in Supabase'};
  }
  const email = String(d?.email ?? '').trim().toLowerCase();
  return {
    url,
    chiave,
    turnstile: String(d?.turnstile ?? '').trim() || null,
    lingua: d?.lingua === 'it' ? 'it' : 'en',
    ricorda: /^(si|sì|yes|true|1)$/i.test(String(d?.ricorda ?? '').trim()),
    email: email.length <= 254 && EMAIL.test(email) ? email : null,
  };
}

/** Pagina da cui si scrive: solo origine e percorso (query e frammento possono contenere dati personali). */
export function paginaCorrente(l) {
  if (!/^https?:\/\//.test(String(l?.origin ?? ''))) return null;
  return [...`${l.origin}${l.pathname ?? ''}`].slice(0, MASSIMO_PAGINA).join('');
}

/** Motivo da mostrare per un invio rifiutato, dai codici fissi della casella; null per gli altri errori. */
export function motivoErrore(e, t) {
  const testo = `${e?.code ?? ''} ${e?.message ?? ''}`;
  if (/too_many_messages|PT429/.test(testo)) return t.troppi;
  if (/mailbox_full|PT503/.test(testo)) return t.piena;
  return null;
}
