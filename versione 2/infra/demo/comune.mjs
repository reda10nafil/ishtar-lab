// Strumenti dei dati fittizi: chiamate che reggono ai riavvii del backend, registro di ciò che si crea e SQL.
// Il registro `.log/demo-creati.json` dice cosa è stato creato o cambiato: `togli-demo.mjs` lavora solo su quello.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { accediAdmin as accediAdminBase, accediAzienda as accediAziendaBase, attendiBackend, chiama as chiamaBase, qui } from '../lib.mjs';

const ATTESA_BACKEND = 3600;
const TENTATIVI_RETE = 12;
const TENTATIVI_SERVER = 3;
const PAUSA_SERVER = 2500;

export const PERCORSO_REGISTRO = path.join(qui, '..', '.log', 'demo-creati.json');
export const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ripete la chiamata se il backend sta ripartendo: gli altri lavori salvano file di continuo. */
export async function chiama(percorso, sessione, opzioni) {
  for (let rete = 0, server = 0; ; ) {
    try {
      const risposta = await chiamaBase(percorso, sessione, opzioni);
      if (risposta.stato < 500 || server >= TENTATIVI_SERVER) return risposta;
      server += 1;
      await pausa(PAUSA_SERVER);
    } catch (errore) {
      rete += 1;
      if (rete > TENTATIVI_RETE) throw errore;
      await attendiBackend(ATTESA_BACKEND);
    }
  }
}

/** Come `chiama`, ma un rifiuto ferma il lavoro con il messaggio del server. */
export async function deve(percorso, sessione, opzioni) {
  const risposta = await chiama(percorso, sessione, opzioni);
  if (risposta.stato >= 400) throw new Error(`${opzioni?.metodo ?? (opzioni?.corpo !== undefined ? 'POST' : 'GET')} ${percorso}: ${risposta.stato} ${JSON.stringify(risposta.corpo).slice(0, 400)}`);
  return risposta.corpo;
}

export async function accediAdmin() {
  await attendiBackend(ATTESA_BACKEND);
  for (let i = 0; ; i += 1) {
    try {
      return await accediAdminBase();
    } catch (errore) {
      if (i >= TENTATIVI_RETE) throw errore;
      await attendiBackend(ATTESA_BACKEND);
    }
  }
}

const aziende = new Map();

export async function accediAzienda(email) {
  if (aziende.has(email)) return aziende.get(email);
  await attendiBackend(ATTESA_BACKEND);
  const sessione = await accediAziendaBase(email);
  aziende.set(email, sessione);
  return sessione;
}

/** SQL sul database locale, con le variabili già presenti nel contenitore: righe di campi separati da tab. */
export function sql(testo) {
  const esito = spawnSync('docker', ['exec', '-i', 'multi-outfit-postgres-1', 'sh', '-c', 'psql -q -At -F "\t" -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], { input: testo, encoding: 'utf8' });
  if (esito.status !== 0) throw new Error(`SQL: ${esito.stderr}`);
  return esito.stdout.split('\n').filter(Boolean).map((riga) => riga.split('\t'));
}

export const elencoSql = (valori) => valori.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',');

const REGISTRO_VUOTO = {
  ancora: null,
  negozio: null,
  spedizioni: null,
  prodotti: {},
  collezioni: {},
  clienti: {},
  gruppi: {},
  motivi_reso: {},
  sconti: {},
  rivenditori: {},
  trattative: {},
  ordini: {},
  bozze: {},
  carte: {},
  proposte: {},
  proposte_prezzi: {},
  outfit: {},
  richieste: {},
  campagne: {},
  automazioni: {},
  vetrina: null,
  pagine: {},
};

export function leggiRegistro() {
  const salvato = fs.existsSync(PERCORSO_REGISTRO) ? JSON.parse(fs.readFileSync(PERCORSO_REGISTRO, 'utf8')) : {};
  return { ...structuredClone(REGISTRO_VUOTO), ...salvato };
}

export function salvaRegistro(registro) {
  const provvisorio = `${PERCORSO_REGISTRO}.tmp`;
  fs.mkdirSync(path.dirname(PERCORSO_REGISTRO), { recursive: true });
  fs.writeFileSync(provvisorio, JSON.stringify(registro, null, 1));
  fs.renameSync(provvisorio, PERCORSO_REGISTRO);
}

export async function contesto() {
  const r = leggiRegistro();
  const admin = await accediAdmin();
  r.ancora ??= new Date().toISOString();
  salvaRegistro(r);
  return { r, admin, salva: () => salvaRegistro(r), ancora: new Date(r.ancora) };
}

/** Numeri casuali ripetibili: a ogni ripartenza i dati pianificati restano gli stessi. */
export function casuale(seme) {
  let stato = seme >>> 0;
  const prossimo = () => {
    stato = (stato + 0x6d2b79f5) >>> 0;
    let t = stato;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const intero = (minimo, massimo) => minimo + Math.floor(prossimo() * (massimo - minimo + 1));
  const scegli = (voci) => voci[Math.floor(prossimo() * voci.length)];
  const pesato = (voci) => {
    const totale = voci.reduce((s, [, peso]) => s + peso, 0);
    let soglia = prossimo() * totale;
    for (const [voce, peso] of voci) {
      soglia -= peso;
      if (soglia <= 0) return voce;
    }
    return voci.at(-1)[0];
  };
  return { prossimo, intero, scegli, pesato };
}

export const GIORNO = 86_400_000;
export const giorniFa = (ancora, giorni) => new Date(ancora.getTime() - giorni * GIORNO);
export const traGiorni = (ancora, giorni) => new Date(ancora.getTime() + giorni * GIORNO);

export const racconta = (...parti) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...parti);
