// Collaudo completo dei connettori sul backend in esecuzione. Richiede infra/servizio-prova.mjs attivo.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attendiBackend } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const API = 'http://127.0.0.1:9100';
const leggiEnv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const cred = leggiEnv(path.join(here, '..', '.credenziali-locali.env'));
const infra = leggiEnv(path.join(here, '.env'));
const SEGRETO = 'test-secret';

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'OK' : 'KO'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const call = async (p, token, init = {}) => {
  const r = await fetch(API + p, { redirect: 'manual', ...init, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  const t = await r.text();
  let body;
  try { body = JSON.parse(t); } catch { body = t; }
  return { status: r.status, body, location: r.headers.get('location') };
};
const sql = (q) => execFileSync('docker', ['exec', 'multi-outfit-postgres-1', 'psql', '-U', infra.POSTGRES_USER, '-d', infra.POSTGRES_DB, '-At', '-c', q], { encoding: 'utf8' }).trim();
const scheda = async (t, id) => (await call('/admin/connectors', t)).body.connettori.find((c) => c.id === id);

await attendiBackend();
const admin = (await call('/auth/user/emailpass', null, { method: 'POST', body: JSON.stringify({ email: cred.ADMIN_EMAIL, password: cred.ADMIN_PASSWORD }) })).body.token;
const member = (await call('/auth/member/emailpass', null, { method: 'POST', body: JSON.stringify({ email: 'seller@mercur.dev', password: 'supersecret' }) })).body.token;

const anon = await call('/admin/connectors');
check('Senza accesso la pagina è negata', anon.status === 401, `HTTP ${anon.status}`);
const azienda = await call('/admin/connectors', member);
check('Un\'azienda non vede i connettori', azienda.status === 401 || azienda.status === 403, `HTTP ${azienda.status}`);
const scritturaAzienda = await call('/admin/connectors/demo', member, { method: 'POST', body: JSON.stringify({ valori: {} }) });
check('Un\'azienda non modifica i connettori', scritturaAzienda.status === 401 || scritturaAzienda.status === 403, `HTTP ${scritturaAzienda.status}`);

await call('/admin/connectors/demo', admin, { method: 'DELETE' });
const elenco = await call('/admin/connectors', admin);
check('Catalogo disponibile', elenco.status === 200 && elenco.body.connettori.length >= 18, `${elenco.body.connettori?.length} servizi`);
const testiCatalogo = JSON.stringify(elenco.body.connettori.map((c) => [c.nome, c.descrizione, c.campi.map((k) => [k.etichetta, k.aiuto, k.segnaposto])]));
const italiano = /\b(chiave|segreta?|applicazione|negozio|gestisci|pubblica|importa|prova|indirizzo|statistiche|fatture ai|assistente)\b/i.exec(testiCatalogo);
check('Catalogo tutto in inglese', !italiano && !/multi.?outfit/i.test(testiCatalogo), italiano?.[0]);

const incompleto = await call('/admin/connectors/demo', admin, { method: 'POST', body: JSON.stringify({ valori: { client_id: 'test-app' } }) });
check('Campi mancanti rifiutati in inglese', incompleto.status === 400 && /^Fill in the /.test(incompleto.body.message), String(incompleto.body.message));
const dominio = await call('/admin/connectors/shopify', admin, { method: 'POST', body: JSON.stringify({ valori: { shop: 'http://169.254.169.254/', client_id: 'a', client_secret: 'b' } }) });
check('Dominio Shopify malevolo rifiutato', dominio.status === 400 && /yourshop\.myshopify\.com/.test(dominio.body.message), String(dominio.body.message));
const interno = await call('/admin/connectors/woocommerce', admin, { method: 'POST', body: JSON.stringify({ valori: { site: 'https://127.0.0.1', consumer_key: 'a', consumer_secret: 'b' } }) });
check('Sito interno rifiutato', interno.status === 400 && /public site/.test(interno.body.message), String(interno.body.message));
const sconosciuto = await call('/admin/connectors/inesistente', admin, { method: 'POST', body: JSON.stringify({ valori: {} }) });
check('Servizio inesistente rifiutato', sconosciuto.status === 404, `HTTP ${sconosciuto.status}`);

const salva = await call('/admin/connectors/demo', admin, { method: 'POST', body: JSON.stringify({ valori: { client_id: 'test-app', client_secret: SEGRETO, estraneo: 'x' } }) });
check('Dati applicazione salvati', salva.status === 200, `HTTP ${salva.status}`);
const dopoSalva = await scheda(admin, 'demo');
check('Lo stato attende il login', dopoSalva.stato === 'da_collegare', dopoSalva.stato);
const risposta = JSON.stringify(await call('/admin/connectors', admin));
check('Il segreto non esce mai dall\'API', !risposta.includes(SEGRETO));
check('Il campo segreto risulta impostato', dopoSalva.campi.find((c) => c.chiave === 'client_secret').impostato === true);
const riga = sql("select secret from connector_account where provider='demo'");
check('Il database non contiene il segreto in chiaro', riga.startsWith('v1.') && !riga.includes(SEGRETO) && !riga.includes('test-app'));

const avvio = await call('/admin/connectors/demo/login', admin, { method: 'POST' });
check('Indirizzo di login creato', avvio.status === 200 && avvio.body.indirizzo.includes('/authorize'), `HTTP ${avvio.status}`);
const consenso = await fetch(avvio.body.indirizzo);
const ritorno = /href="([^"]+)"/.exec(await consenso.text())?.[1];
check('Il servizio di prova chiede il consenso', Boolean(ritorno));
const fine = await fetch(ritorno, { redirect: 'manual' });
const dest = fine.headers.get('location') ?? '';
check('Ritorno alla pagina Connettori', fine.status === 302 && dest.includes('/connettori?collegato=demo'), dest);
const collegato = await scheda(admin, 'demo');
check('Servizio collegato con l\'account giusto', collegato.stato === 'collegato' && collegato.account === 'test-account', `${collegato.stato}, ${collegato.account}`);
const riuso = await fetch(ritorno, { redirect: 'manual' });
check('Il ritorno non si può riusare', (riuso.headers.get('location') ?? '').includes('errore=login'));
const falso = await fetch(`${API}/connectors/oauth/callback?code=x&state=falso`, { redirect: 'manual' });
check('Stato falsificato rifiutato', (falso.headers.get('location') ?? '').includes('errore=login'));
const verifica = await call('/admin/connectors/demo/test', admin, { method: 'POST' });
check('Prova del collegamento riuscita', verifica.body.esito?.ok === true && verifica.body.esito.account === 'test-account');
const https = await call('/admin/connectors/instagram', admin, { method: 'POST', body: JSON.stringify({ valori: { client_id: 'a', client_secret: 'b' } }) });
const loginIg = await call('/admin/connectors/instagram/login', admin, { method: 'POST' });
check('Instagram chiede HTTPS con un messaggio chiaro', https.status === 200 && loginIg.status >= 400 && /HTTPS/.test(loginIg.body.message), String(loginIg.body.message));
await call('/admin/connectors/instagram', admin, { method: 'DELETE' });

const chiaveFalsa = 'sk_test_chiave_finta_per_collaudo';
const stripe = await call('/admin/connectors/stripe', admin, { method: 'POST', body: JSON.stringify({ valori: { secret_key: chiaveFalsa } }) });
check('Stripe reale rifiuta una chiave finta', stripe.body.esito?.ok === false && /^[A-Z][a-z]+ /.test(stripe.body.esito?.errore ?? '') && !/rifiutat|raggiungibile/.test(stripe.body.esito?.errore ?? ''), stripe.body.esito?.errore);
const schedaStripe = await scheda(admin, 'stripe');
check('L\'errore compare sulla scheda senza la chiave', schedaStripe.stato === 'errore' && !JSON.stringify(schedaStripe).includes(chiaveFalsa), schedaStripe.errore);
await call('/admin/connectors/stripe', admin, { method: 'DELETE' });

const scollega = await call('/admin/connectors/demo', admin, { method: 'DELETE' });
check('Scollegamento riuscito', scollega.status === 200 && (await scheda(admin, 'demo')).stato === 'non_collegato');
check('Credenziali rimosse dal database', sql("select count(*) from connector_account where provider='demo'") === '0');

const ok = results.every(Boolean);
console.log(ok ? `ESITO: connettori operativi (${results.length} controlli)` : 'ESITO: PROBLEMI');
process.exit(ok ? 0 : 1);
