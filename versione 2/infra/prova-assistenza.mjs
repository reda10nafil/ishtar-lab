// Prova di Help e Notifiche: richieste, risposte, isolamento tra aziende, campanella e letture per account.
// Le richieste create qui iniziano con «Prova» e vengono cancellate alla fine.
import crypto from 'node:crypto';
import path from 'node:path';
import { CONSOLE, accediAdmin, accediAzienda, attendiBackend, chiama as chiamaBase, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';
import { CARTELLA_SCREENSHOT, accediAdminBrowser, accediAziendaBrowser, apriBrowser } from './lib-browser.mjs';

/** Il backend riparte quando un altro lavoro salva un file: la richiesta si ripete quando torna. */
async function chiama(...argomenti) {
  for (let tentativo = 0; ; tentativo += 1) {
    try {
      return await chiamaBase(...argomenti);
    } catch (errore) {
      if (tentativo >= 6) throw errore;
      await attendiBackend();
    }
  }
}

const { check, chiudi } = nuovaProva();
await attendiBackend();
const stamp = Date.now();
const admin = await accediAdmin();
const azienda = await accediAzienda('seller@mercur.dev');
const altra = await accediAzienda('kickz@mercur.dev');
const scatta = (pagina, nome, opzioni = {}) => pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `assistenza-${nome}.png`), ...opzioni });

const RICHIESTE = '/assistenza/richieste';
const creati = [];
let collab = null;

/** Parole italiane che non devono comparire in una pagina: l'interfaccia è in inglese. */
const ITALIANO = /\b(della|delle|degli|sono|questo|questa|salva|cerca|nessun[ao]?|richiest[ae]|impostazion[ei]|aziend[ae]|negozio|spedizion[ei]|avvisi|domand[ae]|rispost[ae]|oggetto|chius[ae])\b/i;
// Le righe che iniziano con «Prova» sono dati creati dalle prove, non testi dell'interfaccia.
const parolaItaliana = async (pagina) => (await pagina.locator('.pagina').innerText()).replace(/Prova[^\n]*/g, '').match(ITALIANO)?.[0] ?? null;

async function collaboratore(ruolo) {
  const email = `prova-assistenza-${ruolo}-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const token = tokenDaEmail(await emailPer(email))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: ruolo } });
  return { email, sessione: await accediAdmin(email, password) };
}

const apri = async (sessione, base, oggetto) => {
  const esito = await chiama(`/${base}${RICHIESTE}`, sessione, { corpo: { oggetto, categoria: 'prodotti', testo: 'Prova: description of the problem.' } });
  if (esito.corpo?.richiesta?.id) creati.push(esito.corpo.richiesta.id);
  return esito;
};

/** Se il backend riparte mentre la pagina legge i permessi, la console riporta alla Panoramica: si riprova. */
async function apriConRiprova(pagina, percorso, atteso) {
  for (let tentativo = 0; tentativo < 6; tentativo += 1) {
    await attendiBackend();
    await pagina.goto(`${CONSOLE}${percorso}`);
    const arrivato = await pagina.waitForURL(atteso, { timeout: 6000 }).then(() => true, () => false);
    const pronta = await pagina.locator('.pagina').first().waitFor({ timeout: 8000 }).then(() => true, () => false);
    await pagina.waitForTimeout(500);
    if (arrivato && pronta && new URL(pagina.url()).pathname !== '/') return;
  }
  throw new Error(`Pagina non raggiungibile: ${percorso}`);
}

const avvisiAdmin = async (sessione = admin) => (await chiama('/admin/avvisi', sessione)).corpo;
const avvisiAzienda = async (sessione = azienda) => (await chiama('/vendor/avvisi', sessione)).corpo;

try {
  // --- Apertura e validazione ---
  const nome = `Prova richiesta ${stamp}`;
  const aperta = await apri(azienda, 'vendor', nome);
  check("L'azienda apre una richiesta", aperta.stato === 201 && aperta.corpo.richiesta.stato === 'aperta', aperta.corpo?.richiesta?.id);
  const id = aperta.corpo.richiesta.id;

  const vuota = await chiama(`/vendor${RICHIESTE}`, azienda, { corpo: { oggetto: ' ', categoria: 'prodotti', testo: 'x' } });
  check('Oggetto vuoto respinto in inglese', vuota.stato === 400 && vuota.corpo?.message === 'Write a subject for your request', vuota.corpo?.message);
  const senza = await chiama(`/vendor${RICHIESTE}`, azienda, { corpo: { oggetto: 'x', categoria: 'prodotti' } });
  check('Testo mancante respinto in inglese', senza.stato === 400 && senza.corpo?.message === 'Describe the problem', senza.corpo?.message);
  const categoria = await chiama(`/vendor${RICHIESTE}`, azienda, { corpo: { oggetto: 'x', categoria: 'inventata', testo: 'y' } });
  check('Argomento sconosciuto respinto in inglese', categoria.stato === 400 && categoria.corpo?.message === 'Choose a topic', categoria.corpo?.message);

  // --- Isolamento ---
  const elencoAdmin = await chiama(`/admin${RICHIESTE}?limit=100`, admin);
  const vistaAdmin = elencoAdmin.corpo.richieste?.find((r) => r.id === id);
  check("L'amministratore vede la richiesta con il nome dell'azienda", vistaAdmin?.azienda === azienda.nome, vistaAdmin?.azienda);
  check("L'azienda vede la propria richiesta", (await chiama(`/vendor${RICHIESTE}?limit=100`, azienda)).corpo.richieste.some((r) => r.id === id));
  const elencoAltra = (await chiama(`/vendor${RICHIESTE}?limit=100`, altra)).corpo.richieste;
  check("Un'altra azienda non la vede in elenco", !elencoAltra.some((r) => r.id === id));
  const estranea = await chiama(`/vendor${RICHIESTE}/${id}`, altra);
  check("Un'altra azienda non la apre", estranea.stato === 404 && estranea.corpo?.message === 'Request not found', estranea.corpo?.message);
  check("Un'altra azienda non risponde", (await chiama(`/vendor${RICHIESTE}/${id}/messaggi`, altra, { corpo: { testo: 'intrusion' } })).stato === 404);
  check("Un'altra azienda non la chiude", (await chiama(`/vendor${RICHIESTE}/${id}/stato`, altra, { corpo: { stato: 'chiusa' } })).stato === 404);
  const seconda = await apri(altra, 'vendor', `Prova altra azienda ${stamp}`);
  check("La prima azienda non vede quella dell'altra", !(await chiama(`/vendor${RICHIESTE}?limit=100`, azienda)).corpo.richieste.some((r) => r.id === seconda.corpo.richiesta.id));

  // --- Avvisi: l'amministratore ---
  const avviso = (lista) => lista.avvisi.find((a) => a.a === `${RICHIESTE}/${id}`);
  const primoAvviso = avviso(await avvisiAdmin());
  check('Campanella: richiesta aperta tra gli avvisi', primoAvviso?.titolo === 'Help request open' && primoAvviso.dettaglio === nome, primoAvviso?.titolo);
  check('Campanella: avviso non letto', primoAvviso?.letto === false);
  const contati = await avvisiAdmin();
  check('Il conteggio corrisponde agli avvisi non letti', contati.non_letti === contati.avvisi.filter((a) => !a.letto).length, `${contati.non_letti} non letti`);
  check("L'altra azienda non riceve l'avviso", !(await avvisiAzienda(altra)).avvisi.some((a) => a.a === `${RICHIESTE}/${id}`));

  check('Segna come letto', (await chiama('/admin/avvisi/letti', admin, { corpo: { chiavi: [primoAvviso.chiave] } })).stato === 200);
  const letti = await avvisiAdmin();
  check('Avviso letto per questo account', avviso(letti)?.letto === true);
  check('Il conteggio esclude gli avvisi letti', letti.non_letti === letti.avvisi.filter((a) => !a.letto).length && !letti.avvisi.some((a) => a.chiave === primoAvviso.chiave && !a.letto));
  check('Segnare due volte non dà errore', (await chiama('/admin/avvisi/letti', admin, { corpo: { chiavi: [primoAvviso.chiave] } })).stato === 200);
  check('Lista di letture vuota respinta', (await chiama('/admin/avvisi/letti', admin, { corpo: { chiavi: [] } })).corpo?.message === 'No notifications specified');

  collab = await collaboratore('lettura');
  const vistaCollab = (await avvisiAdmin(collab.sessione)).avvisi.find((a) => a.a === `${RICHIESTE}/${id}`);
  check('La lettura vale per account: per il collaboratore resta da leggere', vistaCollab?.letto === false);

  // --- Dialogo ---
  const risposta = await chiama(`/admin${RICHIESTE}/${id}/messaggi`, admin, { corpo: { testo: 'Prova: reply from the team.' } });
  check("L'amministratore risponde: tocca all'azienda", risposta.stato === 201 && risposta.corpo.richiesta.stato === 'in_attesa');
  const dettaglio = (await chiama(`/vendor${RICHIESTE}/${id}`, azienda)).corpo.richiesta;
  check('Dialogo in ordine, con due messaggi', dettaglio.messaggi.length === 2 && dettaglio.messaggi[1].da_staff === true);
  check("L'azienda non vede l'email del collaboratore", dettaglio.messaggi[1].autore === 'Ishtar Lab team', dettaglio.messaggi[1].autore);
  check("L'amministratore vede chi ha scritto", (await chiama(`/admin${RICHIESTE}/${id}`, admin)).corpo.richiesta.messaggi[0].autore === 'seller@mercur.dev');
  check("Per l'amministratore l'avviso sparisce", !avviso(await avvisiAdmin()));

  const perAzienda = avviso(await avvisiAzienda());
  check("Campanella dell'azienda: nuova risposta", perAzienda?.titolo === 'New reply to your request', perAzienda?.titolo);
  await chiama('/vendor/avvisi/letti', azienda, { corpo: { chiavi: [perAzienda.chiave] } });
  check("L'azienda segna come letto", avviso(await avvisiAzienda())?.letto === true);

  const replica = await chiama(`/vendor${RICHIESTE}/${id}/messaggi`, azienda, { corpo: { testo: 'Prova: follow-up.' } });
  check("L'azienda replica: torna allo staff", replica.stato === 201 && replica.corpo.richiesta.stato === 'aperta');
  check("Un nuovo messaggio riaccende l'avviso già letto", avviso(await avvisiAdmin())?.letto === false);
  check('Messaggio vuoto respinto in inglese', (await chiama(`/vendor${RICHIESTE}/${id}/messaggi`, azienda, { corpo: { testo: '  ' } })).corpo?.message === 'Write a message');

  // --- Stato, filtri ---
  check("L'azienda non può mettere «in attesa»", (await chiama(`/vendor${RICHIESTE}/${id}/stato`, azienda, { corpo: { stato: 'in_attesa' } })).corpo?.message === 'Invalid status');
  check('Stato sconosciuto respinto', (await chiama(`/admin${RICHIESTE}/${id}/stato`, admin, { corpo: { stato: 'inventato' } })).stato === 400);
  check("L'azienda chiude la propria richiesta", (await chiama(`/vendor${RICHIESTE}/${id}/stato`, azienda, { corpo: { stato: 'chiusa' } })).corpo.richiesta?.stato === 'chiusa');
  const chiusa = await chiama(`/admin${RICHIESTE}/${id}/messaggi`, admin, { corpo: { testo: 'Too late' } });
  check('Su una richiesta chiusa non si risponde', chiusa.stato >= 400 && chiusa.corpo?.message === 'This request is closed: reopen it to reply', chiusa.corpo?.message);
  check('Filtro per stato', (await chiama(`/admin${RICHIESTE}?stato=chiusa&limit=100`, admin)).corpo.richieste.every((r) => r.stato === 'chiusa'));
  const trovate = (await chiama(`/admin${RICHIESTE}?q=${encodeURIComponent(nome)}`, admin)).corpo;
  check('Ricerca per oggetto', trovate.totale === 1 && trovate.richieste[0].id === id);
  check('Una richiesta chiusa non genera avvisi', !avviso(await avvisiAdmin()) && !avviso(await avvisiAzienda()));
  check("L'azienda la riapre", (await chiama(`/vendor${RICHIESTE}/${id}/stato`, azienda, { corpo: { stato: 'aperta' } })).corpo.richiesta?.stato === 'aperta');

  // --- Permessi ---
  const lettura = collab.sessione;
  const interna = await apri(lettura, 'admin', `Prova interna ${stamp}`);
  check('Un collaboratore apre una richiesta interna', interna.stato === 201);
  const idInterna = interna.corpo.richiesta.id;
  check('La richiesta interna non è visibile alle aziende', (await chiama(`/vendor${RICHIESTE}/${idInterna}`, azienda)).stato === 404);
  await chiama(`/admin${RICHIESTE}/${idInterna}/messaggi`, admin, { corpo: { testo: 'Prova: internal reply.' } });
  const interne = (await avvisiAdmin(lettura)).avvisi.find((a) => a.a === `${RICHIESTE}/${idInterna}`);
  check('Chi ha aperto la richiesta interna riceve la risposta', interne?.titolo === 'New reply to your request', interne?.titolo);
  check('Sola lettura non elimina', negato(await chiama(`/admin${RICHIESTE}/${id}`, lettura, { metodo: 'DELETE' })));
  check("L'azienda non elimina", (await chiama(`/vendor${RICHIESTE}/${id}`, azienda, { metodo: 'DELETE' })).stato >= 400);
  check("L'azienda non usa le rotte dell'amministratore", negato(await chiama(`/admin${RICHIESTE}`, azienda)));
  check('Senza accesso niente richieste', negato(await chiama(`/vendor${RICHIESTE}`, null)));

  const azioni = (await chiama('/admin/registro', admin)).corpo.voci.map((v) => v.azione);
  for (const attesa of ['Help request opened', 'Reply to a help request', 'Help request status changed', 'Notifications marked as read']) {
    check(`Registro: ${attesa}`, azioni.includes(attesa));
  }

  // --- Browser ---
  const { browser, nuovaPagina, errori } = await apriBrowser();
  try {
    const perAziendaPagina = await nuovaPagina();
    await accediAziendaBrowser(perAziendaPagina, 'seller@mercur.dev');
    await apriConRiprova(perAziendaPagina, '/assistenza', '**/assistenza');
    await perAziendaPagina.getByRole('heading', { name: 'Help', exact: true }).waitFor();
    await perAziendaPagina.locator('.domanda').first().waitFor();
    const domandeAzienda = await perAziendaPagina.locator('.domanda').count();
    check('Domande frequenti visibili', domandeAzienda >= 10, `${domandeAzienda} domande`);
    check('Help: nessuna parola italiana', (await parolaItaliana(perAziendaPagina)) === null, await parolaItaliana(perAziendaPagina));
    const ricerca = perAziendaPagina.getByRole('searchbox', { name: 'Search the questions' });
    check('La ricerca nelle domande ha la sua altezza', (await ricerca.boundingBox()).height < 60);
    const colonna = await perAziendaPagina.locator('.aiuto__colonne > *').evaluateAll((c) => c.map((e) => Math.round(e.getBoundingClientRect().x)));
    check('Domande e modulo stanno su due colonne', colonna.length === 2 && colonna[1] > colonna[0], colonna.join(', '));
    const aperteDi = () => perAziendaPagina.locator('.domanda button[aria-expanded="true"]').count();
    check('Prima risposta già aperta', (await aperteDi()) === 1);
    await perAziendaPagina.locator('.domanda button').nth(2).click();
    check('Una sola risposta aperta alla volta', (await aperteDi()) === 1 && (await perAziendaPagina.locator('.domanda').nth(2).getAttribute('class')).includes('aperta'));
    await ricerca.fill('ships');
    check('Ricerca nelle domande', (await perAziendaPagina.locator('.domanda').count()) === 1);
    check('Il conteggio delle risposte segue la ricerca', await perAziendaPagina.getByText('1 answer', { exact: true }).isVisible());
    await perAziendaPagina.getByRole('button', { name: 'Clear search' }).click();
    await perAziendaPagina.getByRole('group', { name: 'Topic' }).getByRole('button', { name: 'Products' }).click();
    check('La pillola scrive nella ricerca', (await ricerca.inputValue()) === 'products');
    const filtrate = await perAziendaPagina.locator('.domanda').count();
    check('La pillola filtra le domande', filtrate > 0 && filtrate < domandeAzienda, `${filtrate} domande`);
    await perAziendaPagina.getByRole('button', { name: 'Clear search' }).click();
    const testoAzienda = await perAziendaPagina.locator('.domande').innerText();
    check("L'azienda non vede le domande riservate", !testoAzienda.includes('How do I approve a product'));
    await scatta(perAziendaPagina, 'domande', { fullPage: true });
    await ricerca.fill('qwertyuiop');
    await perAziendaPagina.getByText('Nothing about “qwertyuiop”').waitFor();
    check('Ricerca senza risultati: lo stato vuoto cita la ricerca', await perAziendaPagina.getByText('0 answers').isVisible());
    await ricerca.fill('');

    const oggettoBrowser = `Prova dal browser ${stamp}`;
    const testoModulo = await perAziendaPagina.locator('.aiuto__lato .riquadro').first().innerText();
    check('Nessuna promessa sui tempi di risposta', !/\b\d+\s*(hours?|days?|minutes?)\b|within|weekdays|mornings/i.test(testoModulo));
    await perAziendaPagina.getByLabel('Subject', { exact: true }).fill(oggettoBrowser);
    await perAziendaPagina.getByRole('combobox', { name: 'Topic' }).selectOption('spedizioni');
    await perAziendaPagina.getByLabel('Describe the problem').fill('Prova: written in the browser.');
    await perAziendaPagina.getByRole('button', { name: 'Send request' }).click();
    await perAziendaPagina.locator('.avvisi').getByText(/^T-\d+ sent$/).waitFor();
    check('Invio: resta nella pagina, con il numero della richiesta', (await perAziendaPagina.getByLabel('Subject', { exact: true }).inputValue()) === '');
    await perAziendaPagina.locator('.aiuto__richieste a', { hasText: oggettoBrowser }).click();
    await perAziendaPagina.waitForURL(/\/assistenza\/richieste\/ric_/);
    const idBrowser = perAziendaPagina.url().split('/').pop();
    creati.push(idBrowser);
    await perAziendaPagina.getByRole('heading', { name: oggettoBrowser }).waitFor();
    check('Richiesta creata dal browser', true);
    await perAziendaPagina.getByText('Awaiting reply').waitFor();
    await scatta(perAziendaPagina, 'richiesta-azienda', { fullPage: true });

    const pagina = await nuovaPagina();
    await accediAdminBrowser(pagina);
    const campanella = pagina.getByRole('button', { name: /^Notifications/ });
    await campanella.locator('em').waitFor();
    check('Campanella con il conteggio', /\d/.test(await campanella.locator('em').innerText()));
    await campanella.click();
    const voce = pagina.locator('.notifiche__voce', { hasText: oggettoBrowser });
    await voce.waitFor();
    await scatta(pagina, 'campanella');
    await voce.click();
    await pagina.waitForURL(`**${RICHIESTE}/${idBrowser}`);
    check("L'avviso porta alla pagina giusta", true);
    await pagina.getByRole('heading', { name: oggettoBrowser }).waitFor();
    check('Richiesta: nessuna parola italiana', (await pagina.locator('.dialogo').count()) === 1 && !ITALIANO.test((await pagina.locator('.pagina').innerText()).replace(oggettoBrowser, '').replace(/Prova[^\n]*/g, '')));
    await pagina.getByLabel('Your reply').fill('Prova: reply from the browser.');
    await pagina.getByRole('button', { name: 'Send reply' }).click();
    await pagina.getByText('Prova: reply from the browser.').first().waitFor();
    await pagina.getByText('Replied').waitFor();
    check("L'amministratore risponde dal browser", true);
    await scatta(pagina, 'richiesta-admin', { fullPage: true });

    // Se il backend riparte, la pagina resta sull'errore: si aspetta che torni e si ricarica.
    for (let tentativo = 0; tentativo < 5; tentativo += 1) {
      await attendiBackend();
      await perAziendaPagina.reload();
      if (await perAziendaPagina.getByText('Prova: reply from the browser.').waitFor({ timeout: 8000 }).then(() => true, () => false)) break;
    }
    await perAziendaPagina.getByText('Prova: reply from the browser.').waitFor();
    check("L'azienda legge la risposta firmata dal team", (await perAziendaPagina.locator('.dialogo__voce').last().innerText()).includes('Ishtar Lab team'));
    const campanellaAzienda = perAziendaPagina.getByRole('button', { name: /^Notifications/ });
    await campanellaAzienda.locator('em').waitFor();
    await campanellaAzienda.click();
    await perAziendaPagina.getByRole('button', { name: 'Mark all read' }).click();
    await perAziendaPagina.getByRole('button', { name: 'Mark all read' }).waitFor({ state: 'detached' });
    await campanellaAzienda.locator('em').waitFor({ state: 'detached' });
    check('Segna tutti come letti: il numero sparisce', true);
    await perAziendaPagina.keyboard.press('Escape');
    await perAziendaPagina.getByRole('button', { name: 'Close request' }).click();
    await perAziendaPagina.getByRole('button', { name: 'Reopen request' }).waitFor();
    check("L'azienda chiude dalla pagina", (await perAziendaPagina.getByLabel('Your reply').count()) === 0);

    await apriConRiprova(pagina, '/assistenza', '**/assistenza');
    await pagina.getByRole('link', { name: /^View all requests/ }).click();
    await pagina.waitForURL(`**${RICHIESTE}`);
    await pagina.getByRole('table', { name: 'Help requests' }).waitFor();
    await pagina.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Closed' }).click();
    await pagina.locator('.tabella tbody tr', { hasText: oggettoBrowser }).waitFor();
    check("L'amministratore la trova tra le chiuse", true);
    await scatta(pagina, 'elenco', { fullPage: true });
    await pagina.locator('.tabella tbody tr', { hasText: oggettoBrowser }).click();
    await pagina.getByRole('button', { name: 'Delete' }).click();
    await pagina.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await pagina.waitForURL(`**${RICHIESTE}`);
    check('Richiesta eliminata dal browser', (await chiama(`/admin${RICHIESTE}/${idBrowser}`, admin)).stato === 404);

    const chiaro = await nuovaPagina({ colorScheme: 'light' });
    await accediAdminBrowser(chiaro);
    await apriConRiprova(chiaro, '/assistenza', '**/assistenza');
    await chiaro.locator('.domanda').first().waitFor();
    await scatta(chiaro, 'domande-chiaro', { fullPage: true });
    check('Tema chiaro attivo sulla pagina', (await chiaro.evaluate(() => document.documentElement.dataset.tema)) === 'chiaro');
    check("L'amministratore vede anche le domande riservate", (await chiaro.locator('.domande').innerText()).includes('How do I approve a product'));

    const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
    // Sul telefono il menu laterale è chiuso: l'app è pronta quando c'è la testata.
    await telefono.goto(CONSOLE);
    await telefono.locator('.testata').waitFor();
    for (const [percorso, nomeFoto] of [['/assistenza', 'domande'], [RICHIESTE, 'richieste'], [`${RICHIESTE}/${id}`, 'richiesta'], ['/connettori', 'connettori']]) {
      await apriConRiprova(telefono, percorso, `**${percorso}`);
      await telefono.locator('.pagina').waitFor();
      await telefono.waitForTimeout(600);
      check(`Telefono, ${nomeFoto}: nessuno scorrimento laterale`, await telefono.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await scatta(telefono, `telefono-${nomeFoto}`, { fullPage: true });
    }
    await apriConRiprova(telefono, '/assistenza', '**/assistenza');
    await telefono.getByRole('button', { name: /^Notifications/ }).click();
    await telefono.waitForTimeout(300);
    const scatola = await telefono.locator('.tendina__pannello').boundingBox();
    check('Telefono: il pannello degli avvisi resta nello schermo', scatola.x >= 0 && scatola.x + scatola.width <= 390, `da ${Math.round(scatola.x)} a ${Math.round(scatola.x + scatola.width)}`);
    await scatta(telefono, 'telefono-campanella');

    // Con più lavori che salvano, Vite può caricare due versioni dello stesso modulo: non è un errore della pagina.
    const veriErrori = errori.filter((e) => !/richiede Provider/.test(e));
    check('Nessun errore nel browser', veriErrori.length === 0, veriErrori.slice(0, 2).join(' | ').slice(0, 200));
  } finally {
    await browser.close();
  }
} finally {
  for (const id of creati) await chiama(`/admin${RICHIESTE}/${id}`, admin, { metodo: 'DELETE' });
  if (collab) {
    const { collaboratori } = (await chiama('/admin/team', admin)).corpo;
    const idCollab = collaboratori.find((c) => c.email === collab.email)?.id;
    if (idCollab) await chiama(`/admin/team/${idCollab}`, admin, { metodo: 'DELETE' });
  }
}

const rimaste = (await chiama(`/admin${RICHIESTE}?q=${encodeURIComponent(String(stamp))}&limit=100`, admin)).corpo.totale;
check('Le richieste di prova sono state cancellate', rimaste === 0, `${rimaste} rimaste`);
check('Team senza il collaboratore di prova', !(await chiama('/admin/team', admin)).corpo.collaboratori.some((c) => c.email === collab?.email));

chiudi('Help e notifiche verificate');
