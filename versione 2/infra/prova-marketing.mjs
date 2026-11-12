// Prova di Marketing: campagne ed email vere in Mailpit, programmazione, disiscrizione, automazioni e permessi.
// Clienti, gruppi e campagne iniziano con «Prova» e vengono cancellati alla fine.
import crypto from 'node:crypto';
import path from 'node:path';
import { API, CONSOLE, MAILPIT, accediAdmin, accediAzienda, attendiBackend, chiama as chiamaBase, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';
import { CARTELLA_SCREENSHOT, accediAdminBrowser, apriBrowser } from './lib-browser.mjs';

async function chiama(...argomenti) {
  for (let tentativo = 0; ; tentativo += 1) {
    try {
      const risposta = await chiamaBase(...argomenti);
      if (risposta.stato < 500 || tentativo >= 4) return risposta;
    } catch (errore) {
      if (tentativo >= 6) throw errore;
    }
    await attendiBackend();
  }
}

const { check, chiudi } = nuovaProva();
await attendiBackend();
const stamp = Date.now();
const admin = await accediAdmin();
const a = await accediAzienda('seller@mercur.dev');
const emailDi = (nome) => `prova-mk-${nome}-${stamp}@multioutfit.test`;
const clienti = [];
const gruppi = [];
const campagne = [];
const collaboratori = [];
const URL_CAMPAGNE = '/admin/marketing/campagne';

const nuovoCliente = async (nome, newsletter) => {
  const risposta = await chiama('/admin/clienti', admin, { corpo: { email: emailDi(nome), nome: 'Prova', cognome: nome, newsletter } });
  if (!risposta.corpo?.id) throw new Error(`Cliente non creato: ${JSON.stringify(risposta.corpo)}`);
  clienti.push(risposta.corpo.id);
  return { id: risposta.corpo.id, email: emailDi(nome) };
};

const nuovaCampagna = async (dati) => {
  const risposta = await chiama(URL_CAMPAGNE, admin, { corpo: dati });
  if (risposta.corpo?.campagna?.id) campagne.push(risposta.corpo.campagna.id);
  return risposta;
};

const messaggi = async (indirizzo) => (await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${indirizzo}`)}`)).json()).messages ?? [];
const leggiCampagna = async (id) => (await chiama(`${URL_CAMPAGNE}/${id}`, admin)).corpo.campagna;

async function attendiStato(id, stati, secondi = 60) {
  const limite = Date.now() + secondi * 1000;
  while (Date.now() < limite) {
    const campagna = await leggiCampagna(id);
    if (stati.includes(campagna?.stato)) return campagna;
    await new Promise((r) => setTimeout(r, 500));
  }
  return leggiCampagna(id);
}

async function attendiMail(indirizzo, quante = 1, secondi = 40) {
  const limite = Date.now() + secondi * 1000;
  while (Date.now() < limite) {
    const elenco = await messaggi(indirizzo);
    if (elenco.length >= quante) return elenco;
    await new Promise((r) => setTimeout(r, 500));
  }
  return messaggi(indirizzo);
}

async function collaboratore(ruolo) {
  const email = `prova-${ruolo}-m${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  collaboratori.push(email);
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const token = tokenDaEmail(await emailPer(email, 240))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: ruolo } });
  return accediAdmin(email, password);
}

/** Dati dimostrativi usati solo se l'agente dei dati non li ha ancora caricati, e tolti alla fine. */
const DEMO_PROVA = {
  adesso: { visitatori: 18, carrello: 6, cassa: 2, andamento: [11, 13, 12, 15, 14, 16, 18, 17, 19, 16, 17, 18] },
  conversione: { valore: 0.0264, precedente: 0.0281, serie: [0.024, 0.026, 0.025, 0.027, 0.028, 0.026, 0.027, 0.025, 0.026, 0.029, 0.027, 0.026, 0.025, 0.026] },
  spunto: { titolo: 'Prova: the linen email did well', testo: 'Prova: a second send could land in the same window.' },
  traffico: {
    giorni: Array.from({ length: 30 }, (_, i) => ({ data: new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10), visite: 500 + i * 10, precedenti: 450 + i * 8 })),
    carrello: { valore: 0.091, precedente: 0.087 },
    ore: Array.from({ length: 7 }, (_, g) => Array.from({ length: 8 }, (_, o) => 100 + g * 10 + o * 20)),
    fonti: [{ nome: 'Instagram', visite: 7100 }, { nome: 'Search', visite: 5200 }, { nome: 'Direct', visite: 2400 }],
    pagine: [{ titolo: 'Home', percorso: '/', visite: 15400 }, { titolo: 'Shop all', percorso: '/shop', visite: 9800 }],
  },
  campagne: [
    { nome: 'Prova Linen Edit', canale: 'email', oggetto: 'Light layers', stato: 'inviata', quando: new Date(Date.now() - 5 * 86_400_000).toISOString(), destinatari: 6240, inviati: 6240, aperture: 0.47, clic: 0.118, incasso: 3120, ordini: 74 },
    { nome: 'Prova reel', canale: 'instagram', stato: 'inviata', quando: new Date(Date.now() - 9 * 86_400_000).toISOString(), destinatari: 18000, inviati: 18000, aperture: 0.5, clic: 0.033, incasso: 1600, ordini: 38 },
    { nome: 'Prova cut-off', canale: 'sms', stato: 'programmata', quando: new Date(Date.now() + 9 * 86_400_000).toISOString(), destinatari: 1900 },
  ],
  automazioni: { benvenuto: { inviate: 342, incasso: 1180 } },
};

const leggiStore = async () => (await chiama('/admin/stores?limit=1&fields=id,metadata', admin)).corpo.stores[0];
const mettiDemo = async (demo) => {
  const store = await leggiStore();
  const risposta = await chiama(`/admin/stores/${store.id}`, admin, { corpo: { metadata: { ...store.metadata, demo: demo ?? '' } } });
  if (risposta.stato !== 200) throw new Error(`Metadati non scritti: ${JSON.stringify(risposta.corpo).slice(0, 200)}`);
};
const demoCaricati = Boolean((await leggiStore()).metadata?.demo);

const email = { nome: `Prova campagna ${stamp}`, oggetto: `Prova oggetto ${stamp}`, testo: 'Prova testo.\n\nSeconda riga <b>sicura</b>.' };

try {
  // Automazioni
  const elenco = (await chiama('/admin/marketing/automazioni', admin)).corpo.automazioni;
  check('Cinque regole, nell\'ordine del pannello', elenco?.map((r) => r.chiave).join() === 'carrello,benvenuto,riacquisto,recensione,recupero');
  const regolaBenvenuto = (lista) => lista.find((r) => r.chiave === 'benvenuto');
  check('Benvenuto pronta a partire', regolaBenvenuto(elenco).bloccata === null);
  const ferme = elenco.filter((r) => r.chiave !== 'benvenuto');
  check('Le altre sono spente e dicono perché', ferme.every((r) => r.attiva === false && r.bloccata?.length > 10), ferme.map((r) => r.bloccata).join(' / ').slice(0, 120));
  const accendi = await chiama('/admin/marketing/automazioni/carrello', admin, { corpo: { attiva: true } });
  check('Una regola bloccata non si accende', accendi.stato === 400 && accendi.corpo.message === elenco[0].bloccata, accendi.corpo?.message);
  check('Regola inesistente: non trovata', negato(await chiama('/admin/marketing/automazioni/boh', admin, { corpo: { attiva: true } })));

  await chiama('/admin/marketing/automazioni/benvenuto', admin, { corpo: { attiva: true, oggetto: `Prova benvenuto ${stamp}` } });
  const uno = await nuovoCliente('uno', true);
  const senza = await nuovoCliente('senza', false);
  const posta = await attendiMail(uno.email);
  check('Benvenuto: email vera a chi ha dato il consenso', posta.length === 1 && posta[0].Subject === `Prova benvenuto ${stamp}`, posta[0]?.Subject);
  await new Promise((r) => setTimeout(r, 2500));
  check('Benvenuto: niente a chi non ha dato il consenso', (await messaggi(senza.email)).length === 0);
  await chiama(`/admin/clienti/${uno.id}`, admin, { corpo: { note: 'Prova modifica' } });
  await new Promise((r) => setTimeout(r, 1500));
  check('Benvenuto: una volta sola', (await messaggi(uno.email)).length === 1);
  await chiama('/admin/marketing/automazioni/benvenuto', admin, { corpo: { attiva: false } });
  const spenta = await nuovoCliente('spenta', true);
  await new Promise((r) => setTimeout(r, 2500));
  check('Benvenuto spenta: nessuna email', (await messaggi(spenta.email)).length === 0);
  const contate = regolaBenvenuto((await chiama('/admin/marketing/automazioni', admin)).corpo.automazioni);
  check('Il conteggio viene dagli invii veri', contate.inviate >= 1);
  await chiama('/admin/marketing/automazioni/benvenuto', admin, { corpo: { attiva: true } });

  // Pubblico
  const due = await nuovoCliente('due', true);
  const gruppo = await chiama('/admin/clienti/gruppi', admin, { corpo: { nome: `Prova gruppo ${stamp}` } });
  gruppi.push(gruppo.corpo.id);
  await chiama(`/admin/clienti/gruppi/${gruppo.corpo.id}/clienti`, admin, { corpo: { aggiungi: [uno.id, due.id, senza.id] } });
  const pubblico = `gruppo:${gruppo.corpo.id}`;
  const panoramica = (await chiama(URL_CAMPAGNE, admin)).corpo;
  check('Segmenti di Customers fra i pubblici', ['tutti', 'segmento:nuovi', 'segmento:abituali', 'segmento:grandi', 'segmento:inattivi'].every((c) => panoramica.pubblici.some((p) => p.chiave === c)));
  const delGruppo = panoramica.pubblici.find((p) => p.chiave === pubblico);
  check('Il pubblico conta solo chi ha il consenso', delGruppo?.conteggio === 2, `${delGruppo?.conteggio} su 3 nel gruppo`);
  check('Iscritti contati dai clienti veri', panoramica.riepilogo.iscritti >= 3);

  // Bozza
  check('Nome obbligatorio, in inglese', (await nuovaCampagna({ ...email, nome: ' ' })).corpo?.message === 'Give the campaign a name');
  check('Oggetto obbligatorio', (await nuovaCampagna({ ...email, oggetto: '' })).corpo?.message === 'Write a subject line');
  check('Testo obbligatorio', (await nuovaCampagna({ ...email, testo: '' })).corpo?.message === 'Write the message');
  check('Pubblico sconosciuto respinto', (await nuovaCampagna({ ...email, pubblico: 'boh' })).stato === 400);
  const bozza = await nuovaCampagna({ ...email, pubblico });
  check('Bozza creata', bozza.stato === 201 && bozza.corpo.campagna.stato === 'bozza' && bozza.corpo.campagna.inviati === 0);
  const id = bozza.corpo.campagna.id;
  const modificata = await chiama(`${URL_CAMPAGNE}/${id}`, admin, { corpo: { ...email, pubblico, nome: `Prova cambiata ${stamp}` } });
  check('Bozza modificata', modificata.corpo.campagna?.nome === `Prova cambiata ${stamp}`);
  const copia = await chiama(`${URL_CAMPAGNE}/${id}/duplica`, admin, { corpo: {} });
  campagne.push(copia.corpo.campagna?.id);
  check('Duplicato: nuova bozza senza conteggi', copia.corpo.campagna?.stato === 'bozza' && copia.corpo.campagna.nome.endsWith('(copy)') && copia.corpo.campagna.inviati === 0);
  check('Una bozza non spedisce nulla', (await messaggi(uno.email)).length === 1);

  // Invio
  const invio = await chiama(`${URL_CAMPAGNE}/${id}/invia`, admin, { corpo: {} });
  check('Invio accettato', invio.stato === 202, `HTTP ${invio.stato}`);
  const inviata = await attendiStato(id, ['inviata', 'fallita']);
  check('Campagna inviata', inviata?.stato === 'inviata', inviata?.stato);
  check('Conteggi veri: solo chi ha il consenso', inviata?.inviati === 2 && inviata.falliti === 0 && inviata.destinatari === 2, `${inviata?.inviati} su ${inviata?.destinatari}`);
  const arrivate = await attendiMail(due.email, 2);
  const campagnaVera = arrivate.find((m) => m.Subject === email.oggetto);
  check('Email vera in Mailpit', Boolean(campagnaVera), arrivate.map((m) => m.Subject).join(' / '));
  check('Niente a chi non ha il consenso', (await messaggi(senza.email)).length === 0);
  const completa = await (await fetch(`${MAILPIT}/message/${campagnaVera.ID}`)).json();
  check('Il testo è protetto: niente HTML del mittente', completa.HTML.includes('&lt;b&gt;sicura&lt;/b&gt;'));
  const link = /href="([^"]*disiscrizione[^"]+)"/.exec(completa.HTML)?.[1]?.replace(/&amp;/g, '&');
  check('Ogni email ha il link per disiscriversi', Boolean(link));
  check('Una campagna partita non si rimanda', (await chiama(`${URL_CAMPAGNE}/${id}/invia`, admin, { corpo: {} })).stato === 400);
  check('Né si modifica', (await chiama(`${URL_CAMPAGNE}/${id}`, admin, { corpo: { ...email, pubblico } })).stato === 400);
  await new Promise((r) => setTimeout(r, 1500));
  check('Un invio solo a persona', (await messaggi(due.email)).filter((m) => m.Subject === email.oggetto).length === 1);

  // Programmazione
  const futura = (await nuovaCampagna({ ...email, nome: `Prova futura ${stamp}`, oggetto: `Prova futura ${stamp}`, pubblico })).corpo.campagna;
  check('Data passata respinta', (await chiama(`${URL_CAMPAGNE}/${futura.id}/programma`, admin, { corpo: { quando: new Date(Date.now() - 60_000).toISOString() } })).corpo?.message === 'Choose a time in the future');
  check('Data non valida respinta', (await chiama(`${URL_CAMPAGNE}/${futura.id}/programma`, admin, { corpo: { quando: 'domani' } })).stato === 400);
  const momento = new Date(Date.now() + 6000).toISOString();
  const programmata = await chiama(`${URL_CAMPAGNE}/${futura.id}/programma`, admin, { corpo: { quando: momento } });
  check('Campagna programmata', programmata.corpo.campagna?.stato === 'programmata');
  check('Prossimo invio nel riepilogo', (await chiama(URL_CAMPAGNE, admin)).corpo.riepilogo.programmate >= 1);
  check('Prima dell\'ora non parte', (await messaggi(uno.email)).every((m) => m.Subject !== futura.oggetto));
  const partita = await attendiStato(futura.id, ['inviata', 'fallita'], 90);
  check('All\'ora scelta parte da sola', partita?.stato === 'inviata' && partita.inviati === 2 && new Date(partita.avviata_il).getTime() >= new Date(momento).getTime() - 1000, `${partita?.stato}, ${partita?.inviati} invii`);

  const annullata = (await nuovaCampagna({ ...email, nome: `Prova annullata ${stamp}`, oggetto: `Prova annullata ${stamp}`, pubblico })).corpo.campagna;
  await chiama(`${URL_CAMPAGNE}/${annullata.id}/programma`, admin, { corpo: { quando: new Date(Date.now() + 3000).toISOString() } });
  const tolta = await chiama(`${URL_CAMPAGNE}/${annullata.id}/programma`, admin, { metodo: 'DELETE' });
  check('Programmazione tolta: torna bozza', tolta.corpo.campagna?.stato === 'bozza' && tolta.corpo.campagna.programmata_il === null);
  await new Promise((r) => setTimeout(r, 5000));
  check('L\'attesa scaduta non spedisce una bozza', (await leggiCampagna(annullata.id)).stato === 'bozza' && (await messaggi(uno.email)).every((m) => m.Subject !== annullata.oggetto));

  // Disiscrizione
  check('Link con firma sbagliata respinto', (await fetch(link.replace(/firma=[^&]+/, 'firma=sbagliata'))).status === 400);
  const pagina = await fetch(link);
  check('Il link apre una conferma, non disiscrive da solo', pagina.status === 200 && (await pagina.text()).includes('Stop marketing emails?') && (await chiama(`/admin/clienti/${due.id}`, admin)).corpo.cliente.newsletter === true);
  const via = await fetch(link, { method: 'POST' });
  check('Disiscrizione confermata senza accesso', via.status === 200 && (await via.text()).includes("You're unsubscribed"));
  check('Il consenso cambia nella scheda del cliente', (await chiama(`/admin/clienti/${due.id}`, admin)).corpo.cliente.newsletter === false);
  check('Link costruito sul backend', link.startsWith(API) || link.includes('/admin/marketing/disiscrizione'));
  await chiama(`/admin/clienti/${uno.id}`, admin, { corpo: { newsletter: false } });
  const nessuno = (await nuovaCampagna({ ...email, nome: `Prova vuota ${stamp}`, pubblico })).corpo.campagna;
  const respinta = await chiama(`${URL_CAMPAGNE}/${nessuno.id}/invia`, admin, { corpo: {} });
  check('Pubblico senza consensi: invio rifiutato', respinta.stato === 400 && respinta.corpo.message === 'Nobody in this audience has agreed to marketing emails', respinta.corpo?.message);

  // Permessi
  const lettura = await collaboratore('lettura');
  check('Sola lettura: vede le campagne', (await chiama(URL_CAMPAGNE, lettura)).stato === 200);
  check('Sola lettura: non crea', (await chiama(URL_CAMPAGNE, lettura, { corpo: { ...email, pubblico } })).stato === 403);
  check('Sola lettura: non invia', (await chiama(`${URL_CAMPAGNE}/${nessuno.id}/invia`, lettura, { corpo: {} })).stato === 403);
  check('Sola lettura: non tocca le automazioni', (await chiama('/admin/marketing/automazioni/benvenuto', lettura, { corpo: { attiva: false } })).stato === 403);
  const operatore = await collaboratore('ordini');
  check('Senza `marketing`: respinto', (await chiama(URL_CAMPAGNE, operatore)).stato === 403 && (await chiama('/admin/marketing/automazioni', operatore)).stato === 403);
  const addetto = await collaboratore('marketing');
  const sua = await nuovaCampagna({ ...email, nome: `Prova ruolo ${stamp}`, pubblico });
  check('Ruolo Marketing: la rotta risponde', sua.stato === 201 && (await chiama(`${URL_CAMPAGNE}/${sua.corpo.campagna.id}/duplica`, addetto, { corpo: {} })).stato === 201);
  campagne.push(...(await chiama(URL_CAMPAGNE, admin)).corpo.campagne.filter((c) => c.nome.includes(`${stamp}`)).map((c) => c.id));
  check('Azienda: nessuna rotta di marketing', negato(await chiama(URL_CAMPAGNE, a)) && negato(await chiama('/admin/marketing/automazioni', a)));
  check('Senza accesso: respinto', negato(await chiama(URL_CAMPAGNE, null)));

  // Dati dimostrativi: aperture, clic e guadagni non hanno una fonte vera
  if (!demoCaricati) {
    const senza = (await chiama(URL_CAMPAGNE, admin)).corpo;
    check('Senza dati dimostrativi aperture e clic restano vuoti', senza.riepilogo.apertura === null && senza.riepilogo.incasso === null && senza.campagne.every((c) => c.misure === null));
    check('Senza dati dimostrativi nessun guadagno dalle automazioni', (await chiama('/admin/marketing/automazioni', admin)).corpo.guadagno === null);
    await mettiDemo(DEMO_PROVA);
  }
  const conDemo = (await chiama(URL_CAMPAGNE, admin)).corpo;
  const misurata = conDemo.campagne.find((c) => c.misure);
  check('Aperture, clic e guadagni dai dati dimostrativi', Boolean(misurata) && conDemo.riepilogo.apertura > 0 && conDemo.riepilogo.incasso > 0, misurata?.nome);
  check('Le campagne dimostrative si riconoscono e non hanno azioni vere', conDemo.campagne.some((c) => c.dimostrativa) && conDemo.campagne.filter((c) => c.dimostrativa).every((c) => c.id.startsWith('demo-')));
  check('Anche Instagram e SMS come schede', demoCaricati || (conDemo.campagne.some((c) => c.canale === 'instagram') && conDemo.campagne.some((c) => c.canale === 'sms')));
  check('Prossimo invio anche da una programmata dimostrativa', demoCaricati || conDemo.riepilogo.prossima !== null);
  check('Guadagno delle automazioni dai dati dimostrativi', (await chiama('/admin/marketing/automazioni', admin)).corpo.guadagno > 0);

  // Browser
  const { browser, nuovaPagina, errori } = await apriBrowser();
  const web = await nuovaPagina();
  await accediAdminBrowser(web);
  await web.goto(`${CONSOLE}/marketing`);
  await web.getByRole('heading', { name: 'Marketing' }).or(web.locator('h1[aria-label="Marketing"]')).first().waitFor();
  await web.getByText('Open rate').waitFor();
  check('Browser: /marketing apre Campaigns', web.url().endsWith('/marketing/campagne'));
  check('Browser: incasso delle campagne come nel pannello', await web.getByText('Earned by campaigns').isVisible());
  check('Browser: tasso di apertura dai dati', (await web.locator('.tessera', { hasText: 'Open rate' }).locator('.tessera__valore').innerText()) !== '–');
  check('Browser: le schede mostrano Opened, Clicked ed Earned', (await web.getByRole('article').first().getByText('Earned', { exact: true }).isVisible()) && (await web.getByRole('article').first().getByText('Clicked', { exact: true }).isVisible()));
  await web.getByRole('button', { name: 'New campaign' }).click();
  const modulo = web.getByRole('dialog', { name: 'New campaign' });
  await modulo.waitFor();
  const canali = await modulo.getByLabel('Channel').locator('option:disabled').allInnerTexts();
  check('Browser: Instagram e SMS presenti ma non collegati', canali.length === 2 && canali.every((c) => c.includes('not connected')), canali.join(', '));
  check('Browser: rimando ad Apps', await modulo.getByRole('link', { name: 'Connect them in Apps' }).isVisible());
  await modulo.getByLabel('Name').fill(`Prova browser ${stamp}`);
  await modulo.getByLabel('Subject line').fill(`Prova browser ${stamp}`);
  await modulo.getByLabel('Message').fill('Prova dal browser');
  await web.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'marketing-nuova.png') });
  await modulo.getByRole('button', { name: 'Save draft' }).click();
  await web.getByRole('article').filter({ hasText: `Prova browser ${stamp}` }).waitFor();
  check('Browser: la bozza appare fra le schede', await web.getByRole('article').filter({ hasText: `Prova browser ${stamp}` }).getByText('Draft', { exact: true }).isVisible());
  const scheda = web.getByRole('article').filter({ hasText: `Prova browser ${stamp}` }).first();
  const quante = await web.getByRole('article').count();
  await scheda.getByRole('button', { name: 'Duplicate' }).click();
  await web.getByText('Copied as a draft').waitFor();
  await web.getByRole('article').nth(quante).waitFor();
  check('Browser: Duplicate crea la copia e offre Undo', await web.getByRole('button', { name: 'Undo' }).first().isVisible());
  await web.getByRole('button', { name: 'Undo' }).first().click();
  await web.waitForFunction((n) => document.querySelectorAll('article').length === n, quante);
  check('Browser: Undo toglie la copia', (await web.getByRole('article').count()) === quante);
  await scheda.getByRole('button', { name: 'Send now' }).click();
  const conferma = web.getByRole('dialog', { name: `Send “Prova browser ${stamp}” now?` });
  await conferma.waitFor();
  check('Browser: Send now chiede conferma e dice a quante persone', await conferma.getByText('straight away', { exact: false }).isVisible());
  await conferma.getByRole('button', { name: 'Cancel' }).click();
  await conferma.waitFor({ state: 'hidden' });
  await web.getByRole('group', { name: 'Filter campaigns' }).getByRole('button', { name: 'Sent' }).click();
  await web.waitForTimeout(400);
  check('Browser: il filtro Sent nasconde le bozze', (await web.getByRole('article').filter({ hasText: `Prova browser ${stamp}` }).count()) === 0);
  await web.getByRole('group', { name: 'Filter campaigns' }).getByRole('button', { name: 'All' }).click();
  await web.waitForTimeout(1200);
  await web.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'marketing-campagne.png'), fullPage: true });
  await web.getByRole('link', { name: 'Automations', exact: true }).first().click();
  await web.getByRole('heading', { name: 'Abandoned basket' }).waitFor();
  check('Browser: regole bloccate con l\'interruttore spento', await web.getByRole('switch', { name: 'Abandoned basket: turn on' }).isDisabled());
  check('Browser: Win-back presente come nel pannello', await web.getByRole('heading', { name: 'Win-back' }).isVisible());
  check('Browser: guadagno delle automazioni nella striscia', await web.getByText('earned by automations', { exact: false }).isVisible());
  check('Browser: il motivo si legge', await web.getByText("The online shop isn't live yet", { exact: false }).isVisible());
  const benvenuto = web.getByRole('switch', { name: /^Welcome/ });
  await benvenuto.click();
  await web.getByRole('switch', { name: 'Welcome: turn on' }).waitFor();
  check('Browser: il messaggio dice che è in pausa', await web.getByText('Welcome paused').first().isVisible());
  check('Browser: Welcome si spegne davvero', regolaBenvenuto((await chiama('/admin/marketing/automazioni', admin)).corpo.automazioni).attiva === false);
  await web.getByRole('switch', { name: 'Welcome: turn on' }).click();
  await web.getByRole('switch', { name: 'Welcome: turn off' }).waitFor();
  await web.getByRole('button', { name: 'Edit email' }).click();
  await web.getByRole('dialog', { name: 'Welcome email' }).waitFor();
  await web.keyboard.press('Escape');
  await web.waitForTimeout(700);
  await web.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'marketing-automazioni.png'), fullPage: true });

  const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
  await accediAdminBrowser(telefono).catch(() => undefined);
  for (const [rotta, nome] of [['/marketing/campagne', 'campagne'], ['/marketing/automazioni', 'automazioni']]) {
    await telefono.goto(`${CONSOLE}${rotta}`);
    await telefono.locator('main').waitFor();
    await telefono.waitForTimeout(1800);
    const larga = await telefono.evaluate(() => document.documentElement.scrollWidth);
    check(`Telefono: ${nome} senza scorrimento laterale`, larga <= 390, `${larga} px`);
    await telefono.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `marketing-${nome}-telefono.png`), fullPage: true });
  }
  const veri = errori.filter((e) => !/Failed to fetch|401|Server unavailable/.test(e));
  check('Browser: nessun errore in pagina', veri.length === 0, veri.slice(0, 2).join(' | ').slice(0, 240));
  await browser.close();
} finally {
  if (!demoCaricati) await mettiDemo(null);
  const presenti = (await chiama(URL_CAMPAGNE, admin)).corpo.campagne ?? [];
  for (const c of presenti.filter((x) => String(x.nome).startsWith('Prova') && !x.dimostrativa)) await chiama(`${URL_CAMPAGNE}/${c.id}`, admin, { metodo: 'DELETE' });
  await chiama('/admin/marketing/automazioni/benvenuto', admin, { corpo: { attiva: true, oggetto: 'Welcome' } });
  for (const id of gruppi) await chiama(`/admin/clienti/gruppi/${id}`, admin, { metodo: 'DELETE' });
  for (const id of clienti) await chiama(`/admin/clienti/${id}`, admin, { metodo: 'DELETE' });
  const { collaboratori: persone = [], inviti = [] } = (await chiama('/admin/team', admin)).corpo;
  for (const indirizzo of collaboratori) {
    const persona = persone.find((p) => p.email === indirizzo)?.id;
    if (persona) await chiama(`/admin/team/${persona}`, admin, { metodo: 'DELETE' });
    const invito = inviti.find((p) => p.email === indirizzo)?.id;
    if (invito) await chiama(`/admin/team/inviti/${invito}`, admin, { metodo: 'DELETE' });
  }
}

const rimaste = (await chiama(URL_CAMPAGNE, admin)).corpo.campagne ?? [];
check('Campagne di prova cancellate', !rimaste.some((c) => String(c.nome).includes(String(stamp))));
chiudi('campagne reali, programmazione, disiscrizione, automazioni e permessi');
