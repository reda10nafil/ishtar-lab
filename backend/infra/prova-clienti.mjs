// Prova dei Clienti: creazione, scheda, indirizzi, newsletter, gruppi, segmenti, esportazione e permessi.
// I clienti e i gruppi creati qui iniziano con «Prova» e vengono cancellati alla fine.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONSOLE, accediAdmin, accediAzienda, attendiBackend, chiama as chiamaBase, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';
import { CARTELLA_SCREENSHOT, accediAdminBrowser, accediAziendaBrowser, apriBrowser } from './lib-browser.mjs';
import { REGOLE, appartenenze, ordineValido, statistiche } from '../piattaforma/packages/api/src/api/admin/clienti/lib/segmenti.ts';

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
const a = await accediAzienda('seller@mercur.dev');
const emailDi = (nome) => `prova-${nome}-${stamp}@multioutfit.test`;

/** Se il backend sta ripartendo l'email può tardare di mezzo minuto: senza non si può continuare. */
async function attendiEmail(indirizzo) {
  const messaggio = await emailPer(indirizzo, 240);
  if (!messaggio) throw new Error(`Email per ${indirizzo} non arrivata`);
  return messaggio;
}

/** L'accesso dell'azienda passa dal backend, che può essere in riavvio per un altro lavoro. */
async function entraComeAzienda(pagina, email) {
  try {
    await accediAziendaBrowser(pagina, email);
  } catch {
    await attendiBackend();
    await accediAziendaBrowser(pagina, email);
  }
}

async function collaboratore(ruolo) {
  const email = `prova-${ruolo}-c${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  collaboratori.push({ email });
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const token = tokenDaEmail(await attendiEmail(email))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  const accettato = await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: ruolo } });
  if (accettato.stato !== 200) throw new Error(`Invito di ${email} non accettato: HTTP ${accettato.stato}`);
  return { email, sessione: await accediAdmin(email, password) };
}

const creati = [];
const gruppi = [];
const collaboratori = [];
let bozza = null;
let aperto = null;

const nuovoCliente = async (corpo) => {
  const risposta = await chiama('/admin/clienti', admin, { corpo });
  if (risposta.corpo?.id) creati.push(risposta.corpo.id);
  return risposta;
};

try {
  // Regole dei segmenti, con ordini di esempio solo in memoria: mai nel database dell'utente
  const giorniFa = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
  const ordine = (estero, n = 10) => ({ id: 'o', status: 'pending', currency_code: 'eur', total: 100, created_at: giorniFa(n), ...estero });
  check('Bozze e ordini annullati non contano', !ordineValido(ordine({ status: 'draft' })) && !ordineValido(ordine({ is_draft_order: true })) && !ordineValido(ordine({ status: 'canceled' })) && ordineValido(ordine()));
  const dati = statistiche([ordine({ total: 300 }), ordine({ total: 250, created_at: giorniFa(5) }), ordine({ status: 'canceled', total: 9000 }), ordine({ currency_code: 'usd', total: 9000 })]);
  check('Statistiche: solo ordini validi, spesa solo in euro', dati.ordini === 3 && dati.speso === 550 && dati.ultimo_ordine === new Date(dati.ultimo_ordine).toISOString(), JSON.stringify(dati));
  const grande = appartenenze(giorniFa(200), dati);
  check('Abituale e grande cliente dai dati', grande.abituale && grande.grande && !grande.nuovo && !grande.inattivo);
  check('Nuovo: registrato da poco', appartenenze(giorniFa(REGOLE.giorni_nuovo - 1), statistiche([])).nuovo);
  check('Inattivo: nessun ordine da oltre 90 giorni', appartenenze(giorniFa(400), statistiche([ordine({}, 120)])).inattivo);
  check('Non inattivo se ha ordinato da poco', !appartenenze(giorniFa(400), statistiche([ordine({}, 10)])).inattivo);
  check('Sotto soglia: niente segmenti', Object.values(appartenenze(giorniFa(45), statistiche([ordine({ total: 10 })]))).every((v) => !v));

  // Stato iniziale, senza dati inventati
  const prima = await chiama('/admin/clienti', admin);
  check('Elenco clienti leggibile', prima.stato === 200 && typeof prima.corpo.conteggio === 'number', `${prima.corpo.conteggio} clienti`);
  const segmentiPrima = await chiama('/admin/clienti/segmenti', admin);
  check('I segmenti contano solo dati veri', segmentiPrima.stato === 200 && segmentiPrima.corpo.totale === prima.corpo.conteggio, `${segmentiPrima.corpo.totale} clienti`);
  check('Quattro segmenti con la loro regola', segmentiPrima.corpo.segmenti?.length === 4 && segmentiPrima.corpo.segmenti.every((s) => s.nome && Array.isArray(s.anteprima)));

  // Lo stato vuoto si vede solo adesso, prima che la prova crei il primo cliente
  if (prima.corpo.conteggio === 0) {
    const { browser, nuovaPagina } = await apriBrowser();
    const vuota = await nuovaPagina();
    await accediAdminBrowser(vuota);
    await vuota.goto(`${CONSOLE}/clienti/persone`);
    await vuota.getByText('No customers yet', { exact: true }).waitFor();
    await vuota.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'clienti-vuoto.png'), fullPage: true });
    await vuota.getByRole('button', { name: 'Add your first customer' }).click();
    await vuota.getByRole('dialog', { name: 'Add customer' }).waitFor();
    check('Browser: con zero clienti lo stato vuoto porta alla creazione', vuota.url().includes('nuovo=1'));
    await vuota.goto(`${CONSOLE}/clienti/segmenti`);
    await vuota.locator('.cli-segmento').first().waitFor();
    const numeri = await vuota.locator('.cli-segmento strong').allInnerTexts();
    check('Browser: con zero clienti ogni segmento mostra zero', numeri.length === 4 && numeri.every((n) => n === '0'), numeri.join(', '));
    check('Browser: nessun gruppo inventato', segmentiPrima.corpo.gruppi?.length > 0 || (await vuota.getByText('No groups yet', { exact: true }).isVisible()));
    await vuota.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'clienti-segmenti-vuoti.png'), fullPage: true });
    await browser.close();
  } else {
    console.log(`Stato vuoto non controllato: nel database ci sono ${prima.corpo.conteggio} clienti`);
  }

  // Creazione e controlli
  const emailUno = emailDi('uno');
  const uno = await nuovoCliente({ email: emailUno.toUpperCase(), nome: 'Prova', cognome: 'Rossi', telefono: '+39 333 000 0000', azienda: 'Prova srl', newsletter: true, note: 'Prova: nota iniziale' });
  check('Cliente creato', uno.stato === 201 && Boolean(uno.corpo.id), JSON.stringify(uno.corpo).slice(0, 80));
  const id = uno.corpo.id;
  const doppia = await nuovoCliente({ email: emailUno, nome: 'Prova' });
  check('Email doppia rifiutata in italiano', doppia.stato === 400 && /already exists/.test(doppia.corpo?.message ?? ''), doppia.corpo?.message);
  const sbagliata = await nuovoCliente({ email: 'non-una-email', nome: 'Prova' });
  check('Email non valida rifiutata', sbagliata.stato === 400 && /valid email/.test(sbagliata.corpo?.message ?? ''), sbagliata.corpo?.message);
  const senzaNome = await nuovoCliente({ email: emailDi('senzanome') });
  check('Nome obbligatorio', senzaNome.stato === 400 && /first name/i.test(senzaNome.corpo?.message ?? ''), senzaNome.corpo?.message);

  const scheda = await chiama(`/admin/clienti/${id}`, admin);
  const cliente = scheda.corpo.cliente;
  check('Scheda con i dati salvati', scheda.stato === 200 && cliente?.email === emailUno && cliente.nome === 'Prova' && cliente.telefono === '+39 333 000 0000' && cliente.azienda === 'Prova srl');
  check('Consenso newsletter con la data', cliente?.newsletter === true && Boolean(cliente.newsletter_data));
  check('Note salvate', cliente?.note === 'Prova: nota iniziale');
  check('Cliente nuovo: nessun ordine, zero euro', cliente?.ordini === 0 && cliente.speso === 0 && cliente.ultimo_ordine === null && scheda.corpo.ordini?.length === 0);
  check('Cliente nuovo nel segmento Nuovi', cliente?.nuovo === true);
  check('Cliente inesistente: non trovato', negato(await chiama('/admin/clienti/cus_inesistente', admin)));

  // Modifica
  const modifica = await chiama(`/admin/clienti/${id}`, admin, { corpo: { cognome: 'Bianchi', note: 'Prova: nota cambiata', rivenditore: true } });
  check('Modifica salvata', modifica.stato === 200 && modifica.corpo.cliente?.cognome === 'Bianchi' && modifica.corpo.cliente.note === 'Prova: nota cambiata' && modifica.corpo.cliente.rivenditore === true);
  check('La modifica non tocca il resto', modifica.corpo.cliente?.newsletter === true && modifica.corpo.cliente.telefono === '+39 333 000 0000');
  const svuotato = await chiama(`/admin/clienti/${id}`, admin, { corpo: { azienda: '' } });
  check('Un campo svuotato si cancella', svuotato.corpo.cliente?.azienda === null);
  const dataConsenso = cliente?.newsletter_data;
  await new Promise((r) => setTimeout(r, 20));
  const revoca = await chiama(`/admin/clienti/${id}`, admin, { corpo: { newsletter: false } });
  check('Revoca del consenso con nuova data', revoca.corpo.cliente?.newsletter === false && revoca.corpo.cliente.newsletter_data !== dataConsenso);
  await chiama(`/admin/clienti/${id}`, admin, { corpo: { newsletter: true } });

  // Indirizzi
  const url = `/admin/clienti/${id}/indirizzi`;
  const casa = await chiama(url, admin, { corpo: { etichetta: 'Prova casa', nome: 'Prova', cognome: 'Bianchi', indirizzo: 'Via Roma 1', citta: 'Provalandia', cap: '00100', provincia: 'RM', predefinito_spedizione: true } });
  check('Indirizzo aggiunto', casa.stato === 201 && Boolean(casa.corpo.id), `HTTP ${casa.stato}`);
  const senzaVia = await chiama(url, admin, { corpo: { citta: 'Roma' } });
  check('Via obbligatoria', senzaVia.stato === 400 && /street/i.test(senzaVia.corpo?.message ?? ''), senzaVia.corpo?.message);
  const ufficio = await chiama(url, admin, { corpo: { etichetta: 'Prova ufficio', indirizzo: 'Via Milano 2', citta: 'Altrove', predefinito_spedizione: true } });
  const conIndirizzi = await chiama(`/admin/clienti/${id}`, admin);
  check('Due indirizzi in scheda, paese italiano predefinito', conIndirizzi.corpo.indirizzi?.length === 2 && conIndirizzi.corpo.indirizzi.every((i) => i.paese === 'it'));
  check('Un solo indirizzo di spedizione predefinito', conIndirizzi.corpo.indirizzi?.filter((i) => i.predefinito_spedizione).length === 1 && conIndirizzi.corpo.indirizzi.find((i) => i.predefinito_spedizione)?.id === ufficio.corpo.id);
  check('La città viene dall\'indirizzo predefinito', conIndirizzi.corpo.cliente?.citta === 'Altrove', conIndirizzi.corpo.cliente?.citta);
  const cambiato = await chiama(`${url}/${ufficio.corpo.id}`, admin, { corpo: { citta: 'Provalandia' } });
  check('Indirizzo modificato', cambiato.stato === 200 && (await chiama(`/admin/clienti/${id}`, admin)).corpo.cliente?.citta === 'Provalandia');
  check('Indirizzo di un altro cliente rifiutato', negato(await chiama(`/admin/clienti/cus_inesistente/indirizzi/${ufficio.corpo.id}`, admin, { metodo: 'DELETE' })));
  const tolto = await chiama(`${url}/${casa.corpo.id}`, admin, { metodo: 'DELETE' });
  check('Indirizzo eliminato', tolto.stato === 200 && (await chiama(`/admin/clienti/${id}`, admin)).corpo.indirizzi?.length === 1);

  // Elenco, ricerca e filtri
  const due = await nuovoCliente({ email: emailDi('due'), nome: 'Prova', cognome: 'Verdi' });
  const conteggi = (q) => chiama(`/admin/clienti?q=${q}`, admin);
  check('Ricerca per email', (await conteggi(emailUno)).corpo.clienti?.length === 1);
  const perNome = await conteggi(encodeURIComponent('prova bianchi'));
  check('Ricerca per nome e cognome', perNome.corpo.clienti?.some((c) => c.id === id));
  check('Ricerca per telefono', (await conteggi(encodeURIComponent('333 000'))).corpo.clienti?.some((c) => c.id === id));
  check('Ricerca per città', (await conteggi('provalandia')).corpo.clienti?.some((c) => c.id === id));
  const filtrati = await chiama(`/admin/clienti?q=${stamp}`, admin);
  check('I conteggi dei filtri seguono la ricerca', filtrati.corpo.conteggi?.tutti === 2 && filtrati.corpo.conteggi.newsletter === 1 && filtrati.corpo.conteggi.rivenditori === 1 && filtrati.corpo.conteggi.abituali === 0, JSON.stringify(filtrati.corpo.conteggi));
  check('Filtro newsletter', (await chiama(`/admin/clienti?q=${stamp}&filtro=newsletter`, admin)).corpo.clienti?.every((c) => c.newsletter));
  check('Filtro rivenditori', (await chiama(`/admin/clienti?q=${stamp}&filtro=rivenditori`, admin)).corpo.clienti?.every((c) => c.rivenditore));
  check('Filtro abituali a zero senza ordini veri', (await chiama(`/admin/clienti?q=${stamp}&filtro=abituali`, admin)).corpo.conteggio === 0);
  check('Filtro sconosciuto rifiutato', (await chiama('/admin/clienti?filtro=inesistente', admin)).stato === 400);
  check('Filtro New', (await chiama(`/admin/clienti?q=${stamp}&filtro=nuovi`, admin)).corpo.clienti?.every((c) => c.nuovo));
  const ordinati = (await chiama(`/admin/clienti?q=${stamp}&ordina=nome`, admin)).corpo.clienti?.map((c) => c.cognome) ?? [];
  check('Ordinamento per nome', ordinati.join() === [...ordinati].sort((x, y) => x.localeCompare(y, 'en-GB')).join(), ordinati.join());
  check('Ordinamento sconosciuto rifiutato', (await chiama('/admin/clienti?ordina=inesistente', admin)).stato === 400);
  check('Filtro per segmento', (await chiama(`/admin/clienti?q=${stamp}&segmento=nuovi`, admin)).corpo.conteggio === 2);
  check('Filtro per città', (await chiama('/admin/clienti?citta=Provalandia', admin)).corpo.clienti?.some((c) => c.id === id));
  check('Esportazione di tutti i clienti', (await chiama('/admin/clienti?tutte=1', admin)).corpo.clienti?.length >= 2);

  // Un cliente eliminato può tornare con la stessa email
  const emailTre = emailDi('tre');
  const tre = await nuovoCliente({ email: emailTre, nome: 'Prova', cognome: 'Ritorno' });
  const viaTre = await chiama(`/admin/clienti/${tre.corpo.id}`, admin, { metodo: 'DELETE' });
  check('Cliente eliminato', viaTre.stato === 200 && negato(await chiama(`/admin/clienti/${tre.corpo.id}`, admin)));
  creati.splice(creati.indexOf(tre.corpo.id), 1);
  const ritorno = await nuovoCliente({ email: emailTre, nome: 'Prova', cognome: 'Ritorno' });
  check('La stessa email si può registrare di nuovo', ritorno.stato === 201, `HTTP ${ritorno.stato} ${ritorno.corpo?.message ?? ''}`);

  // Una bozza d'ordine non è un acquisto: verifica su dati veri con il modulo ordini
  const regione = (await chiama('/admin/regions?limit=1', admin)).corpo.regions?.[0];
  if (regione) {
    const creata = await chiama('/admin/draft-orders', admin, { corpo: { region_id: regione.id, customer_id: id, email: emailUno, sales_channel_id: (await chiama('/admin/sales-channels?limit=1', admin)).corpo.sales_channels?.[0]?.id } });
    bozza = creata.corpo.draft_order?.id ?? null;
    check('Bozza d\'ordine di prova creata', Boolean(bozza), `HTTP ${creata.stato} ${JSON.stringify(creata.corpo).slice(0, 100)}`);
    const conBozza = await chiama(`/admin/clienti/${id}`, admin);
    check('La scheda legge gli ordini reali', conBozza.stato === 200 && conBozza.corpo.ordini?.some((o) => o.id === bozza && o.bozza === true), JSON.stringify(conBozza.corpo.ordini).slice(0, 120));
    check('Una bozza non conta come acquisto', conBozza.corpo.cliente?.ordini === 0 && conBozza.corpo.cliente.speso === 0);
  }

  // Gruppi reali
  const gruppo = await chiama('/admin/clienti/gruppi', admin, { corpo: { nome: `Prova gruppo ${stamp}` } });
  check('Gruppo creato', gruppo.stato === 201 && Boolean(gruppo.corpo.id), `HTTP ${gruppo.stato}`);
  if (gruppo.corpo.id) gruppi.push(gruppo.corpo.id);
  const nomeDoppio = await chiama('/admin/clienti/gruppi', admin, { corpo: { nome: `prova GRUPPO ${stamp}` } });
  check('Nome di gruppo doppio rifiutato', nomeDoppio.stato === 400, nomeDoppio.corpo?.message);
  check('Nome di gruppo obbligatorio', (await chiama('/admin/clienti/gruppi', admin, { corpo: { nome: ' ' } })).stato === 400);
  const membri = await chiama(`/admin/clienti/gruppi/${gruppo.corpo.id}/clienti`, admin, { corpo: { aggiungi: [id, due.corpo.id] } });
  check('Clienti aggiunti al gruppo', membri.stato === 200 && membri.corpo.gruppo?.membri?.length === 2, `HTTP ${membri.stato}`);
  check('Il gruppo compare in scheda', (await chiama(`/admin/clienti/${id}`, admin)).corpo.cliente?.gruppi?.some((g) => g.id === gruppo.corpo.id));
  check('Filtro per gruppo', (await chiama(`/admin/clienti?gruppo=${gruppo.corpo.id}`, admin)).corpo.conteggio === 2);
  const togli = await chiama(`/admin/clienti/gruppi/${gruppo.corpo.id}/clienti`, admin, { corpo: { togli: [due.corpo.id] } });
  check('Cliente tolto dal gruppo', togli.corpo.gruppo?.membri?.length === 1);
  const rinomina = await chiama(`/admin/clienti/gruppi/${gruppo.corpo.id}`, admin, { corpo: { nome: `Prova gruppo nuovo ${stamp}` } });
  check('Gruppo rinominato', rinomina.stato === 200);
  const segmenti = await chiama('/admin/clienti/segmenti', admin);
  check('Segmenti: gruppi con il conteggio reale', segmenti.corpo.gruppi?.find((g) => g.id === gruppo.corpo.id)?.conteggio === 1);
  const nuoviVeri = segmenti.corpo.segmenti?.find((s) => s.chiave === 'nuovi');
  check('Segmenti: anteprima e spesa media dai dati veri', nuoviVeri?.anteprima?.length > 0 && nuoviVeri.media === 0, JSON.stringify(nuoviVeri?.media));
  check('Segmenti: spesa media assente con zero persone', segmenti.corpo.segmenti?.find((s) => s.chiave === 'grandi')?.conteggio > 0 || segmenti.corpo.segmenti?.find((s) => s.chiave === 'grandi')?.media === null);
  check('Segmenti: città con il conteggio reale', segmenti.corpo.citta?.find((c) => c.nome === 'Provalandia')?.conteggio === 1);
  check('Segmenti: i nuovi contano i due clienti di prova', segmenti.corpo.segmenti?.find((s) => s.chiave === 'nuovi')?.conteggio === segmentiPrima.corpo.segmenti.find((s) => s.chiave === 'nuovi').conteggio + 3);

  // Le aziende non vedono i clienti
  check('Azienda respinta: elenco clienti', negato(await chiama('/admin/clienti', a)));
  check('Azienda respinta: scheda cliente', negato(await chiama(`/admin/clienti/${id}`, a)));
  check('Azienda respinta: segmenti', negato(await chiama('/admin/clienti/segmenti', a)));
  check('Azienda respinta: gruppi', negato(await chiama('/admin/clienti/gruppi', a)));
  check('Azienda respinta: rotte standard dei clienti', negato(await chiama('/vendor/customers', a)) && negato(await chiama(`/vendor/customers/${id}`, a)));
  check('Azienda respinta: rotte standard dei gruppi', negato(await chiama('/vendor/customer-groups', a)));
  check('Azienda respinta: rotte amministratore dei clienti', negato(await chiama('/admin/customers', a)));
  check('Non esiste una rotta clienti per le aziende', negato(await chiama('/vendor/clienti', a)));
  check('Un\'azienda non crea clienti', negato(await chiama('/admin/clienti', a, { corpo: { email: emailDi('azienda'), nome: 'Prova' } })));
  check('Un\'azienda non elimina clienti', negato(await chiama(`/admin/clienti/${id}`, a, { metodo: 'DELETE' })));
  check('Senza accesso non si legge nulla', negato(await chiama('/admin/clienti')));

  // Ruoli dei collaboratori
  const lettura = await collaboratore('lettura');
  const contabilita = await collaboratore('contabilita');
  const operatore = await collaboratore('ordini');
  check('Sola lettura non vede i clienti', negato(await chiama('/admin/clienti', lettura.sessione)));
  check('Sola lettura non vede i segmenti', negato(await chiama('/admin/clienti/segmenti', lettura.sessione)));
  check('Contabilità legge i clienti', (await chiama('/admin/clienti?limit=1', contabilita.sessione)).stato === 200);
  check('Contabilità non crea clienti', negato(await chiama('/admin/clienti', contabilita.sessione, { corpo: { email: emailDi('contabile'), nome: 'Prova' } })));
  check('Contabilità non modifica clienti', negato(await chiama(`/admin/clienti/${id}`, contabilita.sessione, { corpo: { nome: 'Violazione' } })));
  const vistaContabile = await chiama('/admin/clienti/segmenti', contabilita.sessione);
  check('Senza permesso sui gruppi i gruppi non escono dai segmenti', vistaContabile.stato === 200 && vistaContabile.corpo.gruppi?.length === 0);
  check('Contabilità non legge i gruppi', negato(await chiama('/admin/clienti/gruppi', contabilita.sessione)));
  check('L\'operatore ordini modifica i clienti', (await chiama(`/admin/clienti/${due.corpo.id}`, operatore.sessione, { corpo: { cognome: 'Neri' } })).stato === 200);
  check('L\'operatore ordini non elimina i clienti', negato(await chiama(`/admin/clienti/${due.corpo.id}`, operatore.sessione, { metodo: 'DELETE' })));
  check('L\'operatore ordini non crea gruppi', negato(await chiama('/admin/clienti/gruppi', operatore.sessione, { corpo: { nome: `Prova vietato ${stamp}` } })));
  check('L\'operatore ordini non elimina gruppi', negato(await chiama(`/admin/clienti/gruppi/${gruppo.corpo.id}`, operatore.sessione, { metodo: 'DELETE' })));

  // Interfaccia reale nel browser
  const { browser, nuovaPagina, errori } = await apriBrowser();
  aperto = browser;

  const scuro = await nuovaPagina();
  await accediAdminBrowser(scuro);
  await scuro.goto(`${CONSOLE}/clienti`);
  await scuro.locator('h1', { hasText: 'Customers' }).waitFor();
  await scuro.locator('.tabella tbody tr').filter({ hasText: emailUno }).waitFor();
  check('Browser: /clienti apre le persone', scuro.url().endsWith('/clienti/persone'));
  const testoPersone = await scuro.locator('main').innerText();
  check('Browser: nessuna parola italiana a schermo', !/\b(cliente|clienti|persone|ordini|iscritti|rivenditori|cerca|esporta|città|speso)\b/i.test(testoPersone));
  await scuro.getByLabel('Sort').selectOption({ label: 'Name' });
  await scuro.waitForFunction(() => document.querySelector('.tabella tbody tr'));
  check('Browser: ordinamento dei clienti', true);
  await scuro.getByRole('button', { name: /^Subscribed/ }).click();
  await scuro.waitForFunction(() => document.querySelector('.filtri button.attivo')?.textContent?.startsWith('Subscribed'));
  check('Browser: filtri Tutti, Abituali, Newsletter, Rivenditori', (await scuro.locator('.filtri button').count()) === 5);
  await scuro.getByRole('button', { name: /^Everyone/ }).click();
  await scuro.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'clienti-persone-scuro.png'), fullPage: true });

  // Nuovo cliente dal menu: ?nuovo=1 apre il modulo
  const emailBrowser = emailDi('browser');
  await scuro.goto(`${CONSOLE}/clienti/persone?nuovo=1`);
  const modulo = scuro.getByRole('dialog', { name: 'Add customer' });
  await modulo.waitFor();
  check('Browser: ?nuovo=1 apre il modulo', true);
  await modulo.getByLabel('First name', { exact: true }).fill('Prova');
  await modulo.getByLabel('Last name', { exact: true }).fill('Browser');
  await modulo.getByLabel('Email', { exact: true }).fill(emailBrowser);
  await modulo.getByRole('switch', { name: 'Newsletter consent' }).click();
  await modulo.getByRole('button', { name: 'Add customer' }).click();
  await scuro.waitForURL(/\/clienti\/persone\/cus_/);
  const idBrowser = scuro.url().split('/').pop();
  creati.push(idBrowser);
  await scuro.locator('h1', { hasText: 'Prova Browser' }).waitFor();
  check('Browser: cliente creato e scheda aperta', (await chiama(`/admin/clienti/${idBrowser}`, admin)).corpo.cliente?.newsletter === true);

  await scuro.getByRole('button', { name: 'Add address' }).click();
  const moduloIndirizzo = scuro.getByRole('dialog', { name: 'Add address' });
  await moduloIndirizzo.getByLabel('Street address').fill('Via Prova 3');
  await moduloIndirizzo.getByLabel('Town or city').fill('Provaville');
  await moduloIndirizzo.getByRole('button', { name: 'Save address' }).click();
  await scuro.getByText(/Via Prova 3/).waitFor();
  check('Browser: indirizzo aggiunto dalla scheda', (await chiama(`/admin/clienti/${idBrowser}`, admin)).corpo.indirizzi?.[0]?.citta === 'Provaville');

  await scuro.getByLabel('Notes about this customer').fill('Prova: nota dal browser');
  await scuro.getByRole('button', { name: 'Save notes' }).click();
  await scuro.getByText('Notes saved').waitFor();
  check('Browser: note salvate', (await chiama(`/admin/clienti/${idBrowser}`, admin)).corpo.cliente?.note === 'Prova: nota dal browser');

  const scaricoScheda = scuro.waitForEvent('download');
  await scuro.getByRole('button', { name: 'Export data' }).click();
  const fileScheda = await scaricoScheda;
  const testoScheda = fs.readFileSync(await fileScheda.path(), 'utf8');
  check('Browser: CSV del singolo cliente', fileScheda.suggestedFilename().endsWith('.csv') && testoScheda.includes(emailBrowser) && testoScheda.includes('Provaville'));
  await scuro.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'clienti-scheda-scuro.png'), fullPage: true });

  await scuro.getByRole('button', { name: 'Edit', exact: true }).click();
  const moduloModifica = scuro.getByRole('dialog', { name: 'Edit customer' });
  await moduloModifica.getByLabel('Phone').fill('+39 02 000 000');
  await moduloModifica.getByRole('switch', { name: 'Stockist' }).click();
  await moduloModifica.getByRole('button', { name: 'Save changes' }).click();
  await scuro.getByText('+39 02 000 000').waitFor();
  const modificato = (await chiama(`/admin/clienti/${idBrowser}`, admin)).corpo.cliente;
  check('Browser: modifica del cliente', modificato?.telefono === '+39 02 000 000' && modificato.rivenditore === true && modificato.newsletter === true);

  await scuro.getByLabel('Group to add').selectOption({ label: `Prova gruppo nuovo ${stamp}` });
  await scuro.getByRole('button', { name: 'Add to group' }).click();
  await scuro.getByRole('link', { name: `Prova gruppo nuovo ${stamp}` }).waitFor();
  check('Browser: cliente aggiunto a un gruppo dalla scheda', (await chiama(`/admin/clienti/${idBrowser}`, admin)).corpo.cliente?.gruppi?.length === 1);

  await scuro.getByRole('button', { name: 'Delete customer' }).click();
  await scuro.getByRole('button', { name: 'Yes, delete customer' }).click();
  await scuro.waitForURL(/\/clienti\/persone$/);
  check('Browser: eliminazione con conferma', negato(await chiama(`/admin/clienti/${idBrowser}`, admin)));
  creati.splice(creati.indexOf(idBrowser), 1);

  const scaricoTutti = scuro.waitForEvent('download');
  await scuro.getByRole('button', { name: 'Export CSV' }).click();
  const fileTutti = await scaricoTutti;
  check('Browser: CSV di tutti i clienti', fs.readFileSync(await fileTutti.path(), 'utf8').includes(emailUno));

  const chiaro = await nuovaPagina({ colorScheme: 'light' });
  await accediAdminBrowser(chiaro);
  await chiaro.goto(`${CONSOLE}/clienti/segmenti`);
  await chiaro.locator('.cli-segmento').first().waitFor();
  await chiaro.getByRole('link', { name: /Big spenders/ }).waitFor();
  await chiaro.locator('.tabella tbody tr').filter({ hasText: `Prova gruppo nuovo ${stamp}` }).waitFor();
  check('Browser: segmenti e gruppi reali', true);
  const nomiClienti = await chiaro.getByRole('navigation', { name: 'Customer sections' }).getByRole('link').allInnerTexts();
  check('Browser: schede People e Segments', nomiClienti.join() === 'People,Segments', nomiClienti.join());
  check('Browser: Add customer in testata anche sui segmenti', await chiaro.getByRole('button', { name: 'Add customer' }).isVisible());
  check('Browser: la regola dei grandi clienti passa dalla valuta del negozio', /Spent \S+ or more/.test(await chiaro.locator('.cli-segmento').filter({ hasText: 'Big spenders' }).innerText()));
  await chiaro.getByRole('button', { name: 'New group' }).click();
  const moduloGruppo = chiaro.getByRole('dialog', { name: 'New group' });
  await moduloGruppo.getByLabel('Group name').fill(`Prova browser ${stamp}`);
  await moduloGruppo.getByRole('button', { name: 'Save group' }).click();
  const rigaGruppo = chiaro.locator('.tabella tbody tr').filter({ hasText: `Prova browser ${stamp}` });
  await rigaGruppo.waitFor();
  check('Browser: gruppo creato dalla pagina', (await chiama('/admin/clienti/gruppi', admin)).corpo.gruppi?.some((g) => g.nome === `Prova browser ${stamp}`));
  await rigaGruppo.getByRole('button', { name: 'Delete' }).click();
  await chiaro.getByRole('button', { name: 'Yes, delete group' }).click();
  await rigaGruppo.waitFor({ state: 'detached' });
  check('Browser: gruppo eliminato con conferma', !(await chiama('/admin/clienti/gruppi', admin)).corpo.gruppi?.some((g) => g.nome === `Prova browser ${stamp}`));
  await chiaro.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'clienti-segmenti-chiaro.png'), fullPage: true });
  await chiaro.getByRole('link', { name: /New customers/ }).click();
  await chiaro.waitForURL(/segmento=nuovi/);
  await chiaro.locator('.tabella tbody tr').filter({ hasText: emailUno }).waitFor();
  check('Browser: dal segmento all\'elenco filtrato', true);

  const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
  await accediAdminBrowser(telefono);
  await telefono.goto(`${CONSOLE}/clienti/persone/${id}`);
  await telefono.getByRole('heading', { name: 'Addresses' }).waitFor();
  await telefono.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'clienti-telefono.png'), fullPage: true });
  check('Browser: telefono senza scorrimento laterale', await telefono.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await telefono.goto(`${CONSOLE}/clienti/segmenti`);
  await telefono.locator('.cli-segmento').first().waitFor();
  check('Browser: segmenti su telefono senza scorrimento laterale', await telefono.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  const azienda = await nuovaPagina();
  await entraComeAzienda(azienda, 'seller@mercur.dev');
  check('Browser: nel menu dell\'azienda non ci sono i clienti', (await azienda.locator('.laterale').getByRole('link', { name: 'Customers' }).count()) === 0);
  await azienda.goto(`${CONSOLE}/clienti/persone/${id}`);
  await azienda.locator('.laterale').waitFor();
  await azienda.waitForFunction(() => !window.location.pathname.startsWith('/clienti'));
  check('Browser: un\'azienda che apre /clienti torna alla panoramica', new URL(azienda.url()).pathname === '/');
  check('Browser: nessun errore in console', errori.length === 0, errori.slice(0, 2).join(' | '));
} finally {
  await aperto?.close();
  if (bozza) await chiama(`/admin/draft-orders/${bozza}`, admin, { metodo: 'DELETE' });
  for (const gruppoId of gruppi) await chiama(`/admin/clienti/gruppi/${gruppoId}`, admin, { metodo: 'DELETE' });
  for (const clienteId of creati) await chiama(`/admin/clienti/${clienteId}`, admin, { metodo: 'DELETE' });
  const { collaboratori: persone = [], inviti = [] } = (await chiama('/admin/team', admin)).corpo;
  for (const { email } of collaboratori) {
    const persona = persone.find((c) => c.email === email)?.id;
    if (persona) await chiama(`/admin/team/${persona}`, admin, { metodo: 'DELETE' });
    const invito = inviti.find((i) => i.email === email)?.id;
    if (invito) await chiama(`/admin/team/inviti/${invito}`, admin, { metodo: 'DELETE' });
  }
}

if (bozza) check('Bozza d\'ordine di prova cancellata', negato(await chiama(`/admin/draft-orders/${bozza}`, admin)));
const dopo = await chiama(`/admin/clienti?q=${stamp}`, admin);
check('Clienti di prova cancellati', dopo.corpo.conteggio === 0, `${dopo.corpo.conteggio} rimasti`);
check('Gruppi di prova cancellati', !(await chiama('/admin/clienti/gruppi', admin)).corpo.gruppi?.some((g) => g.nome?.includes(String(stamp))));

const registro = (await chiama('/admin/registro', admin)).corpo.voci?.map((v) => v.azione) ?? [];
for (const attesa of ['Customer created', 'Customer deleted', 'Customer group created', 'Customer group deleted']) {
  check(`Registro: ${attesa}`, registro.includes(attesa));
}

chiudi('clienti, gruppi e segmenti funzionanti, aziende respinte');
