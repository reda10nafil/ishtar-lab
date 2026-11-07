// Strumenti comuni alle prove: chiamate API, accessi, controlli ed email di prova.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const qui = path.dirname(fileURLToPath(import.meta.url));
export const API = process.env.API_URL || 'http://127.0.0.1:9273';
export const CONSOLE = process.env.CONSOLE_URL || 'http://localhost:5283';
export const MAILPIT = 'http://127.0.0.1:58730/api/v1';
export const PASSWORD_DEMO = process.env.DEMO_SEED_PASSWORD || ''; 
export const cred = Object.fromEntries(
  fs.readFileSync(path.join(qui, '..', '.credenziali-locali.env'), 'utf8').trim().split(/\r?\n/).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);

export function nuovaProva() {
  const esiti = [];
  const check = (nome, ok, dettaglio = '') => {
    esiti.push(Boolean(ok));
    console.log(`${ok ? 'OK' : 'KO'}  ${nome}${dettaglio ? `  (${dettaglio})` : ''}`);
  };
  const chiudi = (titolo) => {
    const ok = esiti.every(Boolean);
    console.log(ok ? `ESITO: ${titolo} (${esiti.length} controlli)` : `ESITO: PROBLEMI (${esiti.filter((e) => !e).length} su ${esiti.length})`);
    process.exitCode = ok ? 0 : 1;
    return ok;
  };
  return { check, chiudi };
}

export async function chiama(percorso, sessione, opzioni = {}) {
  const headers = { ...opzioni.headers };
  if (opzioni.corpo !== undefined) headers['content-type'] = 'application/json';
  if (sessione?.token) headers.authorization = `Bearer ${sessione.token}`;
  if (sessione?.azienda) headers['x-seller-id'] = sessione.azienda;
  const risposta = await fetch(`${API}${percorso}`, {
    method: opzioni.metodo ?? (opzioni.corpo !== undefined ? 'POST' : 'GET'),
    headers,
    body: opzioni.corpo !== undefined ? JSON.stringify(opzioni.corpo) : undefined,
  });
  const testo = await risposta.text();
  let corpo;
  try {
    corpo = JSON.parse(testo);
  } catch {
    corpo = testo;
  }
  return { stato: risposta.status, corpo };
}

export async function accediAdmin(email = cred.ADMIN_EMAIL, password = cred.ADMIN_PASSWORD) {
  const { corpo } = await chiama('/auth/user/emailpass', null, { corpo: { email, password } });
  if (!corpo.token) throw new Error(`accesso admin ${email}: ${JSON.stringify(corpo)}`);
  return { token: corpo.token };
}

export async function accediAzienda(email, password = PASSWORD_DEMO) {
  if (!password) throw new Error('Impostare DEMO_SEED_PASSWORD o passare una password individuale.');
  const { corpo } = await chiama('/auth/member/emailpass', null, { corpo: { email, password } });
  if (!corpo.token) throw new Error(`accesso azienda ${email}: ${JSON.stringify(corpo)}`);
  const elenco = await chiama('/vendor/sellers', { token: corpo.token });
  const membro = elenco.corpo.seller_members?.[0];
  if (!membro) throw new Error(`${email}: nessuna azienda`);
  return { token: corpo.token, azienda: membro.seller_id, nome: membro.seller.name };
}

/** Il backend riparte a ogni modifica dei file: le prove aspettano che torni disponibile. */
export async function attendiBackend(secondi = 180) {
  const limite = Date.now() + secondi * 1000;
  while (Date.now() < limite) {
    try {
      if ((await fetch(`${API}/health`)).ok) return;
    } catch {
      // ancora in riavvio
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Backend non disponibile dopo ${secondi} secondi`);
}

export const negato = (r) => r.stato === 401 || r.stato === 403 || r.stato === 404;

export async function emailPer(indirizzo, tentativi = 24) {
  for (let i = 0; i < tentativi; i += 1) {
    const elenco = await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${indirizzo}`)}`)).json();
    if (elenco.messages?.[0]) return (await fetch(`${MAILPIT}/message/${elenco.messages[0].ID}`)).json();
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

export const tokenDaEmail = (messaggio) => {
  const link = /href="([^"]*token=[^"]+)"/.exec(messaggio?.HTML ?? '')?.[1]?.replace(/&amp;/g, '&');
  return link ? new URL(link) : null;
};
