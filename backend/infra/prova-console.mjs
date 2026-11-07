// Collaudo della console in un browser reale, dal login al ciclo completo azienda-prodotto-approvazione.
// Richiede backend, console e servizio-prova attivi. Salva gli screenshot in .scratch/console.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'piattaforma', 'packages', 'api', 'package.json'));
const { chromium } = require(path.resolve(here, '..', '..', 'node_modules', 'playwright'));
const cred = Object.fromEntries(fs.readFileSync(path.join(here, '..', '.credenziali-locali.env'), 'utf8').trim().split(/\r?\n/).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const CONSOLE = 'http://localhost:5283';
const MAILPIT = 'http://127.0.0.1:58730/api/v1';
const OUT = path.resolve(here, '..', '..', '.scratch', 'console');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'OK' : 'KO'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    check(name, false, e.message.split('\n')[0].slice(0, 120));
    for (const p of browser.contexts().flatMap((c) => c.pages())) {
      await p.screenshot({ path: path.join(OUT, `errore-${name}-${browser.contexts().indexOf(p.context())}.png`) }).catch(() => undefined);
      console.log(`   pagina ${p.url()}: ${(await p.locator('main, form').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220)}`);
    }
  }
};

const browser = await chromium.launch();
const nuovaPagina = async (viewport = { width: 1440, height: 900 }) => {
  const contesto = await browser.newContext({ viewport, colorScheme: 'dark', locale: 'it-IT' });
  const pagina = await contesto.newPage();
  pagina.setDefaultTimeout(10000);
  pagina.on('pageerror', (e) => erroriPagina.push(e.message));
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erroriPagina.push(m.text());
  });
  return pagina;
};
const erroriPagina = [];

const accediAzienda = async (p, email, password) => {
  await p.goto(`${CONSOLE}/accesso-azienda`);
  await p.getByLabel('Email').fill(email);
  await p.getByLabel('Password').fill(password);
  await p.getByRole('button', { name: 'Accedi', exact: true }).click();
};

const stamp = Date.now();
const admin = await nuovaPagina();

await step('Accesso', async () => {
  await accediAzienda(admin, 'nessuno@multioutfit.test', 'password-sbagliata');
  await admin.getByRole('alert').waitFor();
  check('Accesso azienda: password errata rifiutata con messaggio', (await admin.getByRole('alert').innerText()).includes('non corrette'));
  await admin.goto(CONSOLE);
  await admin.getByRole('heading', { name: 'Panoramica' }).waitFor();
  check('L\'amministratore entra senza email e password', !admin.url().includes('accesso') && (await admin.getByLabel('Password').count()) === 0);
  await admin.getByText('Aziende partner').waitFor();
  await admin.waitForFunction(() => /\d/.test(document.querySelector('.scheda-numero strong')?.textContent ?? ''));
  check('Panoramica con dati reali', true);
  await admin.waitForTimeout(600);
  await admin.screenshot({ path: path.join(OUT, '1-panoramica.png') });
});

await step('Connettori', async () => {
  await admin.locator('.laterale').getByRole('link', { name: 'Connettori' }).click();
  await admin.getByRole('heading', { name: 'Connettori' }).waitFor();
  await admin.locator('.connettore').first().waitFor();
  const schede = await admin.locator('.connettore').count();
  check('Schede dei connettori visibili', schede >= 18, `${schede} schede`);
  await admin.waitForFunction(() => [...document.querySelectorAll('.connettore__icona img')].every((i) => i.complete));
  const loghi = await admin.locator('.connettore__icona img').evaluateAll((l) => l.map((i) => ({ src: i.getAttribute('src'), ok: i.naturalWidth > 0 })));
  check('Ogni servizio reale ha il suo logo a colori', loghi.length === schede - 1 && loghi.every((l) => l.ok), `${loghi.length} loghi`);
  await admin.waitForTimeout(400);
  await admin.screenshot({ path: path.join(OUT, '2-connettori.png') });
  await admin.getByRole('group', { name: 'Categoria' }).getByRole('button', { name: 'Spedizioni' }).click();
  check('Filtro per categoria', (await admin.locator('.connettore').count()) === 1);
  await admin.getByRole('group', { name: 'Categoria' }).getByRole('button', { name: 'Tutti' }).click();

  await admin.getByRole('button', { name: 'Collega Instagram' }).click();
  await admin.getByRole('dialog').getByText('HTTPS pubblico').waitFor();
  check('Instagram spiega il requisito HTTPS', true);
  check('Login Instagram disattivato senza dominio', await admin.getByRole('button', { name: 'Accedi a Instagram' }).isDisabled());
  await admin.keyboard.press('Escape');

  await admin.getByRole('button', { name: 'Collega Stripe' }).click();
  await admin.getByLabel('Chiave segreta').fill('sk_test_chiave_finta_per_collaudo');
  await admin.getByRole('button', { name: 'Salva e prova' }).click();
  await admin.getByRole('dialog').getByText('Credenziali rifiutate dal servizio').first().waitFor();
  check('Chiave sbagliata segnalata con chiarezza', true);
  check('La chiave non resta visibile', (await admin.getByLabel('Chiave segreta').inputValue()) === '');
  await admin.screenshot({ path: path.join(OUT, '3-errore-chiave.png') });
  await admin.getByRole('button', { name: 'Scollega' }).click();
  await admin.getByRole('dialog').waitFor({ state: 'detached' });

  await admin.getByRole('button', { name: 'Collega Servizio di prova' }).click();
  await admin.getByLabel('ID applicazione').fill('app-di-prova');
  await admin.getByLabel('Chiave segreta applicazione').fill('segreto-di-prova');
  await admin.getByRole('button', { name: 'Salva dati dell\'app' }).click();
  await admin.getByRole('dialog').getByText('Da completare').waitFor();
  await admin.getByRole('button', { name: 'Accedi a Servizio di prova' }).click();
  await admin.locator('#autorizza').click();
  await admin.waitForURL('**/connettori*');
  await admin.getByText('Collegamento completato.').waitFor();
  check('Login completo fino al ritorno nell\'app', true);
  await admin.getByRole('group', { name: 'Vista' }).getByRole('button', { name: /Collegati/ }).click();
  await admin.getByRole('button', { name: 'Servizio di prova collegato: gestisci' }).click();
  await admin.getByRole('dialog').getByText('account-di-prova').waitFor();
  check('Stato collegato con nome dell\'account', true);
  await admin.getByRole('button', { name: 'Prova', exact: true }).click();
  await admin.getByText('Collegamento riuscito: account-di-prova.').waitFor();
  check('Prova del collegamento dall\'interfaccia', true);
  await admin.getByRole('button', { name: 'Scollega' }).click();
  await admin.getByRole('dialog').waitFor({ state: 'detached' });
});

const emailAzienda = `azienda-${stamp}@multioutfit.test`;
const passwordAzienda = crypto.randomBytes(12).toString('base64url');
const nomeAzienda = `Atelier ${stamp}`;
let tokenInvito;

await step('Aziende', async () => {
  await admin.locator('.laterale').getByRole('link', { name: 'Aziende' }).click();
  await admin.getByRole('heading', { name: 'Aziende' }).waitFor();
  await admin.locator('.riga').first().waitFor();
  await admin.waitForTimeout(300);
  await admin.screenshot({ path: path.join(OUT, '4-aziende.png') });
  await admin.getByRole('button', { name: 'Nuova azienda' }).click();
  await admin.getByLabel('Nome azienda').fill(nomeAzienda);
  await admin.getByLabel('Email del referente').fill(emailAzienda);
  await admin.getByRole('button', { name: 'Crea e invita' }).click();
  await admin.locator('.riga', { hasText: nomeAzienda }).waitFor();
  check('Nuova azienda creata dall\'interfaccia', true);
  let messaggio;
  for (let i = 0; i < 24 && !messaggio; i += 1) {
    await admin.waitForTimeout(500);
    const elenco = await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${emailAzienda}`)}`)).json();
    messaggio = elenco.messages?.[0];
  }
  check('Email di invito ricevuta', Boolean(messaggio), messaggio?.Subject);
  const corpo = await (await fetch(`${MAILPIT}/message/${messaggio.ID}`)).json();
  const collegamento = /href="([^"]*token=[^"]+)"/.exec(corpo.HTML)?.[1]?.replace(/&amp;/g, '&');
  tokenInvito = collegamento ? new URL(collegamento).searchParams.get('token') : undefined;
  check('L\'email contiene il token di invito', Boolean(tokenInvito), collegamento ? new URL(collegamento).pathname : 'nessun link');
  const riga = admin.locator('.riga', { hasText: nomeAzienda });
  if (await riga.getByRole('button', { name: 'Approva' }).count()) await riga.getByRole('button', { name: 'Approva' }).click();
  await riga.getByText('Attiva').waitFor();
  check('Azienda approvata', true);
});

const azienda = await nuovaPagina();
const titoloProdotto = `Blazer lino ${stamp}`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAKklEQVR4nGP8z8DAwMDAwMDAxMDAwMAgwMDA8J+BgYGB4T8DAwMDw38GAAYuAgQ0PqZtAAAAAElFTkSuQmCC', 'base64');

await step('Portale azienda', async () => {
  await azienda.goto(`${CONSOLE}/invito?token=${encodeURIComponent(tokenInvito)}`);
  await azienda.getByLabel('Nome', { exact: true }).fill('Giulia');
  await azienda.getByLabel('Cognome').fill('Rossi');
  await azienda.getByLabel('Email').fill(emailAzienda);
  await azienda.getByLabel('Password').fill(passwordAzienda);
  await azienda.getByRole('button', { name: 'Attiva l\'accesso' }).click();
  await azienda.getByRole('heading', { name: nomeAzienda }).waitFor();
  check('Invito accettato e portale aperto', true);
  const voci = await azienda.locator('.laterale nav a').allInnerTexts();
  check("L'azienda vede solo le sue voci", voci.join(', ') === 'Panoramica, I miei prodotti, Magazzino, Ordini, Evasioni, Outfit, Sconti, Team, Assistenza', voci.join(', '));
  await azienda.goto(`${CONSOLE}/connettori`);
  await azienda.getByRole('heading', { name: nomeAzienda }).waitFor();
  check('Pagina Connettori vietata all\'azienda', !azienda.url().includes('connettori'));
  await azienda.goto(`${CONSOLE}/aziende`);
  await azienda.getByRole('heading', { name: nomeAzienda }).waitFor();
  check('Pagina Aziende vietata all\'azienda', !azienda.url().includes('aziende'));

  await azienda.locator('.laterale').getByRole('link', { name: 'I miei prodotti' }).click();
  await azienda.getByText('Non hai ancora caricato prodotti.').waitFor();
  check('Un\'azienda nuova non vede prodotti altrui', true);
  await azienda.getByRole('button', { name: 'Nuovo prodotto' }).click();
  await azienda.getByLabel('Nome prodotto').fill(titoloProdotto);
  await azienda.getByLabel('Descrizione').fill('Blazer in lino sfoderato, taglio morbido.');
  await azienda.getByLabel('Codice articolo').fill(`BLZ${stamp}`);
  await azienda.getByLabel('Aggiungi foto').setInputFiles({ name: 'blazer.png', mimeType: 'image/png', buffer: PNG });
  await azienda.locator('.galleria__voce img').waitFor();
  const foto = await azienda.locator('.galleria__voce img').getAttribute('src');
  check('Foto caricata nell\'archivio', foto.startsWith('http://127.0.0.1:59730/'), new URL(foto).host);
  await azienda.waitForFunction(() => document.querySelector('.galleria__voce img')?.naturalWidth > 0);
  check('La foto si vede davvero', true);
  await azienda.screenshot({ path: path.join(OUT, '5-nuovo-prodotto.png') });
  await azienda.getByRole('button', { name: 'Invia in revisione' }).click();
  const riga = azienda.locator('.riga', { hasText: titoloProdotto });
  await riga.getByText('In revisione').waitFor();
  check('Prodotto inviato e in revisione', (await riga.innerText()).includes('S, M, L'));
  await azienda.waitForTimeout(300);
  await azienda.screenshot({ path: path.join(OUT, '6-prodotti-azienda.png') });
});

await step('Revisione', async () => {
  await admin.locator('.laterale').getByRole('link', { name: /^Revisione/ }).click();
  await admin.getByRole('heading', { name: 'Revisione' }).waitFor();
  const riga = admin.locator('.riga', { hasText: titoloProdotto });
  await riga.waitFor();
  check('Il prodotto arriva in revisione con la foto', (await riga.locator('img').count()) === 1);
  await admin.screenshot({ path: path.join(OUT, '7-revisione.png') });
  await riga.getByRole('button', { name: 'Approva' }).click();
  await riga.waitFor({ state: 'detached' });
  check('Prodotto approvato', true);
  await azienda.reload();
  await azienda.locator('.riga', { hasText: titoloProdotto }).getByText('Online').waitFor();
  check('L\'azienda vede subito lo stato Online', true);
  const API = 'http://127.0.0.1:9273';
  const json = { 'content-type': 'application/json' };
  const { token } = await (await fetch(`${API}/auth/member/emailpass`, { method: 'POST', headers: json, body: JSON.stringify({ email: 'seller@mercur.dev', password: 'supersecret' }) })).json();
  const altra = (await (await fetch(`${API}/vendor/sellers`, { headers: { authorization: `Bearer ${token}` } })).json()).seller_members[0].seller_id;
  const auth = { authorization: `Bearer ${token}`, 'x-seller-id': altra };
  const elenco = await (await fetch(`${API}/vendor/products?limit=500&fields=id,title`, { headers: auth })).json();
  const riga2 = (elenco.products ?? []).find((p) => p.title === titoloProdotto);
  check('Un\'altra azienda non vede il prodotto pubblicato', !riga2, `${elenco.products?.length} prodotti visibili`);
});

await step('Telefono', async () => {
  const stato = await admin.context().storageState();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', storageState: stato });
  const p = await mobile.newPage();
  await p.goto(`${CONSOLE}/accesso-azienda`);
  await p.getByRole('heading', { name: 'Ishtar Lab' }).waitFor();
  const largo = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check('Pagina di accesso senza scorrimento laterale su telefono', largo);
  await p.goto(`${CONSOLE}/connettori`);
  await p.locator('.connettore').first().waitFor();
  await p.waitForTimeout(300);
  check('Connettori senza scorrimento laterale su telefono', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await p.screenshot({ path: path.join(OUT, '8-telefono.png') });
  await mobile.close();
});

check('Nessun errore JavaScript nelle pagine', erroriPagina.length === 0, erroriPagina[0]?.slice(0, 120));
await browser.close();
const ok = results.every(Boolean);
console.log(ok ? `ESITO: console operativa (${results.length} controlli)` : `ESITO: PROBLEMI (${results.filter((r) => !r).length} su ${results.length})`);
process.exit(ok ? 0 : 1);
