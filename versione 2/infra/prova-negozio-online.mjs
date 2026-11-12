// Prova di Online shop: impostazioni, pagine, anteprima con prodotti veri, permessi e passaggio nel browser.
// Uso: node infra/prova-negozio-online.mjs [--solo-api]. Le pagine di prova si cancellano e le impostazioni tornano com'erano.
import crypto from 'node:crypto';
import path from 'node:path';
import { accediAdmin, accediAzienda, attendiBackend, chiama as chiamaBase, CONSOLE, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';

const { check, chiudi } = nuovaProva();
const soloApi = process.argv.includes('--solo-api');
const chiama = async (...argomenti) => {
  for (let tentativo = 0; ; tentativo += 1) {
    try {
      return await chiamaBase(...argomenti);
    } catch (errore) {
      if (tentativo >= 5) throw errore;
      await attendiBackend();
    }
  }
};
const stamp = Date.now();

await attendiBackend();
const admin = await accediAdmin();
const azienda = await accediAzienda('seller@mercur.dev');
const persone = [];
const pagineProva = new Set();

const collaboratore = async (ruolo) => {
  const email = `prova-negozio-${ruolo}-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const token = tokenDaEmail(await emailPer(email))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: 'Negozio' } });
  persone.push(email);
  return accediAdmin(email, password);
};

const creaPagina = async (corpo) => {
  const r = await chiama('/admin/negozio-online/pagine', admin, { corpo });
  if (r.corpo?.pagina?.id) pagineProva.add(r.corpo.pagina.id);
  return r;
};

// IMPOSTAZIONI
const inizio = await chiama('/admin/negozio-online', admin);
const originale = inizio.corpo.vetrina;
check('Il negozio online si apre', inizio.stato === 200 && Boolean(originale?.id));
check('Il negozio dichiara di non essere online', inizio.corpo.online === false);
check('Limite dell\'annuncio come sul pannello', inizio.corpo.massimo_annuncio === 80);

const annuncio = `Prova annuncio ${stamp}`;
const salvata = await chiama('/admin/negozio-online', admin, { corpo: { testata: 'Prova Lab', annuncio, accento: 'mare', messaggio: 'Prova messaggio' } });
check('Impostazioni salvate', salvata.stato === 200 && salvata.corpo.vetrina.annuncio === annuncio);
const riletta = (await chiama('/admin/negozio-online', admin)).corpo.vetrina;
check('Impostazioni rilette dal server', riletta.testata === 'Prova Lab' && riletta.accento === 'mare' && riletta.messaggio === 'Prova messaggio');
check('Una sola riga di impostazioni', riletta.id === originale.id);
const lungo = await chiama('/admin/negozio-online', admin, { corpo: { annuncio: 'x'.repeat(81) } });
check('Annuncio troppo lungo respinto in inglese', lungo.stato === 400 && /80 characters/.test(lungo.corpo.message), lungo.corpo.message);
check('Colore sconosciuto respinto', (await chiama('/admin/negozio-online', admin, { corpo: { accento: 'verde' } })).stato === 400);
check('Nome vuoto respinto', (await chiama('/admin/negozio-online', admin, { corpo: { testata: '  ' } })).stato === 400);

// PAGINE
const percorso = `/prova-${stamp}`;
const creata = await creaPagina({ titolo: 'Prova pagina', percorso, testo: 'Prova testo', visibile: true });
const id = creata.corpo.pagina?.id;
check('Pagina creata', creata.stato === 201 && creata.corpo.pagina.percorso === percorso);
check('La pagina è nell\'elenco', (await chiama('/admin/negozio-online', admin)).corpo.pagine.some((p) => p.id === id));
check('Indirizzo doppio respinto', (await creaPagina({ titolo: 'Prova doppia', percorso })).stato === 400);
check('Indirizzo sbagliato respinto', (await creaPagina({ titolo: 'Prova sbagliata', percorso: 'senza barra' })).stato === 400);
check('Titolo vuoto respinto', (await creaPagina({ titolo: ' ', percorso: `/prova-vuota-${stamp}` })).stato === 400);
const nascosta = await chiama(`/admin/negozio-online/pagine/${id}`, admin, { corpo: { visibile: false } });
check('Pagina nascosta', nascosta.stato === 200 && nascosta.corpo.pagina.visibile === false);
const cambiata = await chiama(`/admin/negozio-online/pagine/${id}`, admin, { corpo: { titolo: 'Prova titolo nuovo', testo: 'Prova altro testo' } });
check('Titolo e testo cambiati', cambiata.corpo.pagina?.titolo === 'Prova titolo nuovo' && cambiata.corpo.pagina?.testo === 'Prova altro testo' && cambiata.corpo.pagina?.visibile === false);
check('Pagina inesistente: 404', (await chiama('/admin/negozio-online/pagine/pagn_nessuna', admin, { corpo: { visibile: true } })).stato === 404);

// ANTEPRIMA
const vetrina = await chiama('/admin/negozio-online/vetrina', admin);
const inVendita = (await chiama('/admin/cassa', admin)).corpo.prodotti.map((p) => p.id);
check('Anteprima con prodotti veri', vetrina.stato === 200 && vetrina.corpo.prodotti.length > 0 && vetrina.corpo.prodotti.every((p) => inVendita.includes(p.id)), `${vetrina.corpo.prodotti?.length}`);

// PERMESSI
check('Azienda respinta', negato(await chiama('/admin/negozio-online', azienda)));
check('Senza accesso respinto', negato(await chiama('/admin/negozio-online', null)));
const senza = await collaboratore('ordini');
check('Ruolo senza permesso: niente lettura', negato(await chiama('/admin/negozio-online', senza)));
check('Ruolo senza permesso: niente modifica', negato(await chiama('/admin/negozio-online', senza, { corpo: { annuncio: 'Prova vietata' } })));
check('Ruolo senza permesso: niente pagine', negato(await chiama('/admin/negozio-online/pagine', senza, { corpo: { titolo: 'Prova vietata', percorso: `/prova-vietata-${stamp}` } })));
const lettura = await collaboratore('lettura');
const vistaLettura = await chiama('/admin/negozio-online', lettura);
check('Sola lettura: vede', vistaLettura.stato === 200);
check('Sola lettura: non modifica', negato(await chiama('/admin/negozio-online', lettura, { corpo: { annuncio: 'Prova vietata' } })));
check('Sola lettura: non elimina', negato(await chiama(`/admin/negozio-online/pagine/${id}`, lettura, { metodo: 'DELETE' })));

const eliminata = await chiama(`/admin/negozio-online/pagine/${id}`, admin, { metodo: 'DELETE' });
check('Pagina eliminata', eliminata.stato === 200 && !(await chiama('/admin/negozio-online', admin)).corpo.pagine.some((p) => p.id === id));
pagineProva.delete(id);

// BROWSER
if (!soloApi) {
  const { apriBrowser, accediAdminBrowser, CARTELLA_SCREENSHOT } = await import('./lib-browser.mjs');
  const { browser, nuovaPagina, errori } = await apriBrowser();
  const apri = async (pagina) => {
    await accediAdminBrowser(pagina);
    await pagina.goto(`${CONSOLE}/negozio-online`);
    await pagina.locator('.sito').waitFor({ timeout: 60000 });
  };
  const scatta = (pagina, nome) => pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `negozio-online-${nome}.png`), fullPage: true });
  const pagina = await nuovaPagina();
  await apri(pagina);
  await pagina.locator('.sito__prodotto').first().waitFor({ timeout: 30000 });
  await pagina.waitForTimeout(800);
  await scatta(pagina, 'scuro');
  const testo = await pagina.locator('.contenuto').innerText();
  check('Titolo inglese', await pagina.getByRole('heading', { name: 'Online shop' }).isVisible());
  check('Stato chiaro: non online', testo.includes('Not online') && testo.includes("doesn't exist yet"));
  await pagina.getByRole('button', { name: 'Visit shop' }).click();
  await pagina.getByText("The public site doesn't exist yet").first().waitFor();
  check('Visit shop dice che il sito non esiste', true);
  check('Nessun pill Live', !/\bLive\b/.test(await pagina.locator('.negozio__anteprima').innerText()));
  const blocco = pagina.locator('section[aria-label="Visiting now"]');
  const conDemo = inizio.corpo.visite;
  if (conDemo) check('Visiting now con i dati fittizi', (await blocco.locator('.negozio__visita').count()) === conDemo.citta.length);
  else check('Visiting now vuoto senza dati fittizi', (await blocco.innerText()).includes('Nobody can visit yet'));
  for (const voce of ['Online shop', 'Shop till', 'Wholesale']) check(`Scheda ${voce}`, await pagina.locator('.schede').getByRole('link', { name: voce, exact: true }).isVisible());
  check('Prodotti veri nell\'anteprima', (await pagina.locator('.sito__prodotto').count()) === vetrina.corpo.prodotti.length);

  const campoAnnuncio = pagina.getByLabel('Announcement bar');
  await campoAnnuncio.fill('');
  check('Annuncio vuoto: la barra resta con il segnaposto', (await pagina.locator('.sito__annuncio').innerText()).includes('Your announcement'));
  await campoAnnuncio.fill('x'.repeat(100));
  check('Annuncio fermo a 80 caratteri', (await campoAnnuncio.inputValue()).length === 80);
  check('Zero caratteri rimasti', (await pagina.locator('.canale-campo', { hasText: 'Announcement bar' }).innerText()).includes('0 characters left'));
  await campoAnnuncio.fill(`Prova browser ${stamp}`);
  check('L\'anteprima cambia mentre si scrive', (await pagina.locator('.sito__annuncio').innerText()).includes(`Prova browser ${stamp}`));
  const restanti = 80 - `Prova browser ${stamp}`.length;
  check('Caratteri rimasti', (await pagina.locator('.canale-campo', { hasText: 'Announcement bar' }).innerText()).includes(`${restanti} characters left`));
  await pagina.getByLabel('Message', { exact: true }).fill('Prova messaggio browser');
  check('Il messaggio arriva all\'anteprima', (await pagina.locator('.sito__apertura h3').innerText()) === 'Prova messaggio browser');
  await pagina.getByRole('button', { name: 'Sand', exact: true }).click();
  check('Il colore arriva all\'anteprima', (await pagina.locator('.sito').getAttribute('data-accento')) === 'sabbia');
  await pagina.waitForTimeout(1200);
  const server = (await chiama('/admin/negozio-online', admin)).corpo.vetrina;
  check('Salvato da solo sul server', server.annuncio === `Prova browser ${stamp}` && server.accento === 'sabbia' && server.messaggio === 'Prova messaggio browser');
  await pagina.reload();
  await pagina.locator('.sito').waitFor({ timeout: 60000 });
  check('Dopo il ricarico resta', (await pagina.locator('.sito__annuncio').innerText()).includes(`Prova browser ${stamp}`));

  await pagina.getByRole('button', { name: 'New page' }).click();
  const finestra = pagina.getByRole('dialog');
  await finestra.getByLabel('Title').fill('Prova storia');
  check('Indirizzo proposto dal titolo', (await finestra.getByLabel('Address').inputValue()) === '/prova-storia');
  await finestra.getByLabel('Address').fill(`/prova-storia-${stamp}`);
  await finestra.getByLabel('Text', { exact: true }).fill('Prova testo della pagina');
  await pagina.waitForTimeout(400);
  await scatta(pagina, 'nuova-pagina');
  await finestra.getByRole('button', { name: 'Add page' }).click();
  await pagina.locator('tbody tr', { hasText: 'Prova storia' }).waitFor();
  const dopo = (await chiama('/admin/negozio-online', admin)).corpo.pagine.find((p) => p.percorso === `/prova-storia-${stamp}`);
  if (dopo) pagineProva.add(dopo.id);
  check('Pagina salvata dal browser', Boolean(dopo) && dopo.testo === 'Prova testo della pagina');
  check('La pagina entra nel menu dell\'anteprima', (await pagina.locator('.sito__menu').innerText()).includes('Prova storia'));
  await pagina.getByRole('switch', { name: 'Prova storia showing' }).click();
  await pagina.getByText('Prova storia hidden').waitFor();
  await pagina.waitForTimeout(600);
  check('Nascosta esce dal menu', !(await pagina.locator('.sito__menu').innerText()).includes('Prova storia'));
  await pagina.locator('tbody tr', { hasText: 'Prova storia' }).locator('b').click();
  await pagina.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await pagina.getByRole('button', { name: 'Delete page' }).click();
  await pagina.locator('tbody tr', { hasText: 'Prova storia' }).waitFor({ state: 'detached' });
  pagineProva.delete(dopo?.id);
  check('Pagina eliminata dal browser', true);

  const chiara = await nuovaPagina({ colorScheme: 'light' });
  await chiara.addInitScript("try { localStorage.setItem('ishtar-tema', 'chiaro') } catch {}");
  await apri(chiara);
  await chiara.waitForTimeout(800);
  await scatta(chiara, 'chiaro');
  check('Tema chiaro attivo', (await chiara.evaluate(() => document.documentElement.dataset.tema)) === 'chiaro');

  const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
  await telefono.goto(CONSOLE);
  await telefono.locator('.contenuto').waitFor();
  await telefono.goto(`${CONSOLE}/negozio-online`);
  await telefono.locator('.sito').waitFor({ timeout: 60000 });
  await telefono.waitForTimeout(800);
  await scatta(telefono, 'telefono');
  const largo = await telefono.evaluate(() => document.documentElement.scrollWidth);
  check('Telefono senza scorrimento laterale', largo <= 390, `${largo}`);

  const propri = errori.filter((e) => !/Failed to fetch|net::|ERR_/.test(e));
  check('Nessun errore nella pagina', propri.length === 0, propri.slice(0, 2).join(' | ').slice(0, 200));
  await browser.close();
}

// PULIZIA
for (const pagina of pagineProva) await chiama(`/admin/negozio-online/pagine/${pagina}`, admin, { metodo: 'DELETE' });
const { testata, annuncio: annuncioPrima, accento, messaggio } = originale;
await chiama('/admin/negozio-online', admin, { corpo: { testata, annuncio: annuncioPrima, accento, messaggio } });
const fine = (await chiama('/admin/negozio-online', admin)).corpo;
check('Impostazioni tornate com\'erano', fine.vetrina.testata === testata && fine.vetrina.annuncio === annuncioPrima && fine.vetrina.accento === accento && fine.vetrina.messaggio === messaggio);
check('Pulizia: nessuna pagina di prova', !fine.pagine.some((p) => p.titolo.startsWith('Prova')));
const squadra = (await chiama('/admin/team', admin)).corpo;
for (const email of persone) {
  const persona = squadra.collaboratori?.find((c) => c.email === email);
  if (persona) await chiama(`/admin/team/${persona.id}`, admin, { metodo: 'DELETE' });
}

chiudi('negozio online funzionante');
