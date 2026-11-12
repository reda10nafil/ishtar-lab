// Verifica che backend, Redis, archivio file ed email funzionino davvero insieme.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attendiBackend } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL || 'http://127.0.0.1:9100';
const env = Object.fromEntries(fs.readFileSync(path.join(here, '..', '.credenziali-locali.env'), 'utf8').trim().split(/\r?\n/).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'OK' : 'KO'}  ${name}${detail ? `  (${detail})` : ''}`);
};

await attendiBackend();
const health = await fetch(`${API}/health`);
check('Backend attivo', health.ok, `HTTP ${health.status}`);

const login = await fetch(`${API}/auth/user/emailpass`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }) });
const { token } = await login.json();
check('Accesso amministratore', Boolean(token));
const auth = { authorization: `Bearer ${token}` };

const form = new FormData();
const stamp = Date.now();
form.append('files', new Blob([`prova ${stamp}`], { type: 'text/plain' }), `prova-${stamp}.txt`);
const upload = await fetch(`${API}/admin/uploads`, { method: 'POST', headers: auth, body: form });
const uploaded = await upload.json();
const file = uploaded.files?.[0];
check('Caricamento file', upload.ok && Boolean(file?.url), `HTTP ${upload.status}`);
if (file?.url) {
  const read = await fetch(file.url);
  check('Lettura pubblica del file', read.ok && (await read.text()) === `prova ${stamp}`, `HTTP ${read.status}, ${new URL(file.url).host}`);
  const del = await fetch(`${API}/admin/uploads/${encodeURIComponent(file.id)}`, { method: 'DELETE', headers: auth });
  check('Eliminazione file', del.ok, `HTTP ${del.status}`);
}

const before = await (await fetch('http://127.0.0.1:58500/api/v1/messages?limit=1')).json();
const invite = await fetch(`${API}/admin/invites`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ email: `prova-${stamp}@ishtarlab.test` }) });
check('Creazione invito', invite.ok, `HTTP ${invite.status}`);
const invited = await invite.json();
let total = before.total;
for (let i = 0; i < 24 && total === before.total; i += 1) {
  await new Promise((r) => setTimeout(r, 500));
  total = (await (await fetch('http://127.0.0.1:58500/api/v1/messages?limit=1')).json()).total;
}
check('Email di invito recapitata', total > before.total, `${before.total} prima, ${total} dopo`);
const ricevuta = await (await fetch(`http://127.0.0.1:58500/api/v1/search?query=${encodeURIComponent(`to:prova-${stamp}@ishtarlab.test`)}`)).json();
const dettaglio = ricevuta.messages?.[0] ? await (await fetch(`http://127.0.0.1:58500/api/v1/message/${ricevuta.messages[0].ID}`)).json() : {};
check('Email di invito in inglese con il nome Ishtar Lab', /Ishtar Lab/.test(dettaglio.Subject ?? '') && /invited/.test(dettaglio.Text ?? '') && !/Multi Outfit|invitato/.test(`${dettaglio.Subject} ${dettaglio.Text}`), dettaglio.Subject);
if (invited.invite?.id) await fetch(`${API}/admin/invites/${invited.invite.id}`, { method: 'DELETE', headers: auth });

console.log(results.every(Boolean) ? `ESITO: servizi operativi (${results.length} controlli)` : 'ESITO: PROBLEMI');
process.exit(results.every(Boolean) ? 0 : 1);
