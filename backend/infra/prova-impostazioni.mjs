// Prova delle Impostazioni: negozio, valuta, spedizioni su un carrello vero, avvisi, aspetto, esportazione e permessi.
// Tutto ciò che cambia viene rimesso com'era alla fine, anche se un controllo non riesce.
import crypto from 'node:crypto';
import fs from 'node:fs';
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
const scatta = (pagina, nome, opzioni = {}) => pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `impostazioni-${nome}.png`), ...opzioni });

/** Parole italiane che non devono comparire in una pagina: l'interfaccia è in inglese. */
const ITALIANO = /\b(della|delle|degli|sono|questo|questa|salva|cerca|nessun[ao]?|richiest[ae]|impostazion[ei]|aziend[ae]|negozio|spedizion[ei]|avvisi|tariffa|soglia|collegat[oi]|prezzi|valuta)\b/i;
const parolaItaliana = async (pagina) => (await pagina.locator('.pagina').innerText()).match(ITALIANO)?.[0] ?? null;

/**
 * Se il backend sta ripartendo mentre la pagina legge i permessi, la console riporta alla Panoramica.
 * Qui si aspetta che torni e si riprova: un rifiuto vero resterebbe un errore dopo i tentativi.
 */
async function apriConRiprova(pagina, percorso, atteso) {
  for (let tentativo = 0; tentativo < 6; tentativo += 1) {
    await attendiBackend();
    await pagina.goto(`${CONSOLE}${percorso}`);
    const arrivato = await pagina.waitForURL(atteso, { timeout: 6000 }).then(() => true, () => false);
    await pagina.waitForTimeout(500);
    if (arrivato && new URL(pagina.url()).pathname !== '/') return;
  }
  throw new Error(`Pagina non raggiungibile: ${percorso}`);
}

async function collaboratore(ruolo) {
  const email = `prova-impostazioni-${ruolo}-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const token = tokenDaEmail(await emailPer(email))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: ruolo } });
  return { email, sessione: await accediAdmin(email, password) };
}

const leggiNegozio = async () => (await chiama('/admin/impostazioni', admin)).corpo.negozio;
const leggiSpedizioni = async () => (await chiama('/admin/impostazioni/spedizioni', admin)).corpo;
const leggiPreferenze = async () => (await chiama('/admin/avvisi/preferenze', admin)).corpo.fonti;
const leggiStore = async () => (await chiama('/admin/stores', admin)).corpo.stores[0];
const spente = (fonti) => fonti.filter((f) => !f.attiva).map((f) => f.id);
const opzioneMedusa = async (id) => (await chiama(`/admin/shipping-options?id=${id}&fields=id,name,*prices,*prices.price_rules,*rules`, admin)).corpo.shipping_options?.[0];

const negozioOriginale = await leggiNegozio();
const { regole: regoleOriginali, opzioni: opzioniOriginali } = await leggiSpedizioni();
const preferenzeOriginali = spente(await leggiPreferenze());
const opzione = opzioniOriginali.find((o) => o.azienda === 'Sole Society' && o.tipo === 'Standard');
const storeOriginale = await leggiStore();
const { id: storeId, metadata: metadatiOriginali } = storeOriginale;
const valutaMedusa = storeOriginale.supported_currencies.find((v) => v.is_default).currency_code;
// Medusa sostituisce i metadati del negozio, non li unisce: si scrivono sempre interi, altrimenti si perdono quelli altrui.
const scriviMetadati = (metadata) => chiama(`/admin/stores/${storeId}`, admin, { corpo: { metadata } });
const salvaNegozio = (dati) => chiama('/admin/impostazioni/negozio', admin, { corpo: dati });
const salvaOpzione = (dati) => chiama(`/admin/impostazioni/spedizioni/opzioni/${opzione.id}`, admin, { corpo: dati });
let collab = null;

async function ripristina() {
  await salvaNegozio(negozioOriginale);
  await salvaOpzione({ nome: opzione.nome, tariffa: opzione.tariffa, soglia_gratuita: opzione.soglia_gratuita, attiva: opzione.attiva });
  await chiama('/admin/impostazioni/spedizioni', admin, { corpo: { giorni_max_evasione: regoleOriginali.giorni_max_evasione } });
  await chiama('/admin/avvisi/preferenze', admin, { corpo: { disattivate: preferenzeOriginali } });
  await scriviMetadati(metadatiOriginali ?? {});
  if (collab) {
    const { collaboratori } = (await chiama('/admin/team', admin)).corpo;
    const id = collaboratori.find((c) => c.email === collab.email)?.id;
    if (id) await chiama(`/admin/team/${id}`, admin, { metodo: 'DELETE' });
  }
}

try {
  // --- Negozio ---
  const nuovo = {
    ...negozioOriginale,
    nome: `Prova negozio ${stamp}`,
    email: 'prova-negozio@multioutfit.test',
    telefono: '+39 02 1234567',
    indirizzo: { via: '1 Prova Street', cap: '20100', citta: 'Milan', provincia: 'MI', paese: 'Italy' },
    partita_iva: 'IT12345678901',
    valuta: 'GBP',
    fuso: 'Europe/Paris',
    prezzi_con_iva: !negozioOriginale.prezzi_con_iva,
    obiettivo_giornaliero: 1500.5,
  };
  await scriviMetadati({ ...metadatiOriginali, prova_altra_sezione: 'resta' });
  check('Salvataggio dei dati del negozio', (await salvaNegozio(nuovo)).stato === 200);
  const riletto = await leggiNegozio();
  check('Nome e contatti riletti dal server', riletto.nome === nuovo.nome && riletto.email === nuovo.email && riletto.telefono === nuovo.telefono);
  check('Indirizzo e partita IVA riletti dal server', riletto.indirizzo.citta === 'Milan' && riletto.indirizzo.cap === '20100' && riletto.partita_iva === 'IT12345678901');
  check('Fuso e obiettivo del giorno riletti', riletto.fuso === 'Europe/Paris' && riletto.obiettivo_giornaliero === 1500.5);

  const store = await leggiStore();
  check('Il nome è quello vero del negozio in Medusa', store.name === nuovo.nome);
  check("L'obiettivo si legge dai metadati del negozio", store.metadata?.impostazioni?.negozio?.obiettivo_giornaliero === 1500.5);
  check('I metadati delle altre sezioni restano', store.metadata?.prova_altra_sezione === 'resta');

  const preferenze = (await chiama('/admin/price-preferences?limit=50', admin)).corpo.price_preferences;
  const perValuta = preferenze.find((p) => p.attribute === 'currency_code' && p.value === valutaMedusa);
  const regioni = (await chiama(`/admin/regions?limit=50&currency_code=${valutaMedusa}&fields=id`, admin)).corpo.regions;
  const perRegione = preferenze.filter((p) => p.attribute === 'region_id' && regioni.some((r) => r.id === p.value));
  check('Prezzi con IVA applicati alla valuta di Medusa', perValuta?.is_tax_inclusive === nuovo.prezzi_con_iva);
  check('Prezzi con IVA applicati alle regioni, che hanno la precedenza', perRegione.length > 0 && perRegione.every((p) => p.is_tax_inclusive === nuovo.prezzi_con_iva), `${perRegione.length} regioni`);

  // --- Valuta del negozio ---
  const leggiValuta = async (sessione, base) => (await chiama(`/${base}/impostazioni/valuta`, sessione));
  const conValuta = await leggiValuta(admin, 'admin');
  check('Rotta amministratore: risponde esattamente { codice }', conValuta.stato === 200 && JSON.stringify(conValuta.corpo) === '{"codice":"GBP"}', JSON.stringify(conValuta.corpo));
  const perAzienda = await leggiValuta(azienda, 'vendor');
  check('Rotta azienda: stessa valuta', perAzienda.stato === 200 && JSON.stringify(perAzienda.corpo) === '{"codice":"GBP"}', JSON.stringify(perAzienda.corpo));
  const storeConValuta = await leggiStore();
  check('Cambiare valuta non tocca la valuta di Medusa', storeConValuta.supported_currencies.find((v) => v.is_default).currency_code === valutaMedusa);
  check('Cambiare valuta non aggiunge valute a Medusa', storeConValuta.supported_currencies.length === storeOriginale.supported_currencies.length);
  const prezzoDopo = (await chiama(`/admin/offers?limit=1&seller_id=${azienda.azienda}`, admin)).corpo.offers[0].prices.map((p) => `${p.currency_code}:${p.amount}`).sort();
  await salvaNegozio({ ...nuovo, valuta: 'USD' });
  check('Salvataggio di USD', (await leggiValuta(admin, 'admin')).corpo.codice === 'USD');
  const prezzoUsd = (await chiama(`/admin/offers?limit=1&seller_id=${azienda.azienda}`, admin)).corpo.offers[0].prices.map((p) => `${p.currency_code}:${p.amount}`).sort();
  check('I prezzi non vengono convertiti', JSON.stringify(prezzoDopo) === JSON.stringify(prezzoUsd), prezzoUsd.join(', '));
  await salvaNegozio({ ...nuovo, valuta: 'EUR' });
  check('Salvataggio di EUR', (await leggiValuta(azienda, 'vendor')).corpo.codice === 'EUR');

  const respinti = [
    ['nome vuoto', { nome: '   ' }, 'Enter the store name'],
    ['email non valida', { email: 'not-valid' }, 'Invalid email'],
    ['telefono non valido', { telefono: 'abc' }, 'Invalid phone number'],
    ['fuso inesistente', { fuso: 'Moon/Sea' }, 'Invalid time zone'],
    ['valuta non prevista', { valuta: 'JPY' }, 'Choose EUR, GBP or USD'],
    ['obiettivo negativo', { obiettivo_giornaliero: -1 }, 'The goal cannot be negative'],
  ];
  for (const [nome, modifica, atteso] of respinti) {
    const esito = await salvaNegozio({ ...nuovo, ...modifica });
    check(`Respinto: ${nome}, con messaggio in inglese`, esito.stato === 400 && esito.corpo?.message === atteso, esito.corpo?.message);
  }

  // --- Spedizioni ---
  check('Elenco delle opzioni reali di Medusa', opzioniOriginali.length >= 6 && Boolean(opzione), `${opzioniOriginali.length} opzioni`);
  check('Tipi di spedizione in inglese', opzioniOriginali.every((o) => ['Standard', 'Express'].includes(o.tipo)));
  const prima = await opzioneMedusa(opzione.id);
  const altreValute = prima.prices.filter((p) => p.currency_code !== 'eur').map((p) => `${p.currency_code}:${p.amount}`).sort();
  const offerte = (await chiama(`/admin/offers?limit=60&seller_id=${azienda.azienda}`, admin)).corpo.offers;
  const offerta = offerte.find((o) => o.prices?.some((p) => p.currency_code === 'eur'));
  const prezzo = offerta.prices.find((p) => p.currency_code === 'eur').amount;
  const soglia = prezzo * 1.5;

  const salvata = await salvaOpzione({ nome: `Prova opzione ${stamp}`, tariffa: 7.5, soglia_gratuita: soglia, attiva: true });
  check('Opzione aggiornata', salvata.stato === 200 && salvata.corpo.opzione.tariffa === 7.5 && salvata.corpo.opzione.soglia_gratuita === soglia);
  const dopo = await opzioneMedusa(opzione.id);
  check('Nome aggiornato in Medusa', dopo.name === `Prova opzione ${stamp}`);
  const altreDopo = dopo.prices.filter((p) => p.currency_code !== 'eur').map((p) => `${p.currency_code}:${p.amount}`).sort();
  check('Le altre valute restano uguali', JSON.stringify(altreDopo) === JSON.stringify(altreValute), altreDopo.join(', '));
  const conRegione = dopo.prices.find((p) => p.currency_code === 'eur' && p.amount === 7.5 && p.price_rules?.some((r) => r.attribute === 'region_id'));
  check('Anche il prezzo legato alla regione è aggiornato', Boolean(conRegione));

  const pubblica = (await chiama('/admin/api-keys?type=publishable&limit=1', admin)).corpo.api_keys[0].token;
  const negozio = { headers: { 'x-publishable-api-key': pubblica } };
  const regione = (await chiama('/store/regions?limit=1&fields=id,*countries', null, negozio)).corpo.regions[0];
  const carrello = (await chiama('/store/carts', null, {
    ...negozio,
    corpo: { region_id: regione.id, shipping_address: { country_code: regione.countries.find((c) => c.iso_2 === 'it')?.iso_2 ?? regione.countries[0].iso_2, first_name: 'Prova', last_name: 'Soglia', address_1: '1 Prova Street', city: 'Rome', postal_code: '00100' } },
  })).corpo.cart;
  const aggiungi = () => chiama(`/store/carts/${carrello.id}/line-items`, null, { ...negozio, corpo: { offer_id: offerta.id, quantity: 1 } });
  const costo = async () => {
    const { corpo } = await chiama(`/store/shipping-options?cart_id=${carrello.id}`, null, negozio);
    return Object.values(corpo.shipping_options ?? {}).flat().find((o) => o.id === opzione.id)?.amount;
  };
  await aggiungi();
  check('Carrello vero sotto soglia: si paga la tariffa', (await costo()) === 7.5, `${prezzo} di articoli`);
  await aggiungi();
  check('Carrello vero sopra soglia: spedizione gratuita', (await costo()) === 0, `${prezzo * 2} di articoli`);
  await salvaOpzione({ nome: opzione.nome, tariffa: 7.5, soglia_gratuita: soglia, attiva: false });
  check('Opzione spenta: non è più proposta nel carrello', (await costo()) === undefined);

  const soglia0 = await salvaOpzione({ nome: opzione.nome, tariffa: 7.5, soglia_gratuita: 0, attiva: true });
  check('Soglia a zero respinta', soglia0.stato === 400 && soglia0.corpo?.message === 'The threshold must be above zero', soglia0.corpo?.message);
  const negativa = await salvaOpzione({ nome: opzione.nome, tariffa: -1, soglia_gratuita: null, attiva: true });
  check('Tariffa negativa respinta', negativa.stato === 400 && negativa.corpo?.message === 'The rate cannot be negative', negativa.corpo?.message);
  const assente = await chiama('/admin/impostazioni/spedizioni/opzioni/so_inesistente', admin, { corpo: { nome: 'x', tariffa: 1, soglia_gratuita: null, attiva: true } });
  check('Opzione inesistente: non trovata, in inglese', assente.stato === 404 && assente.corpo?.message === 'Shipping option not found', assente.corpo?.message);

  const regola = await chiama('/admin/impostazioni/spedizioni', admin, { corpo: { giorni_max_evasione: 3 } });
  check('Tempo massimo di evasione salvato', regola.stato === 200 && (await leggiSpedizioni()).regole.giorni_max_evasione === 3);
  check('Tempo massimo fuori limite respinto', (await chiama('/admin/impostazioni/spedizioni', admin, { corpo: { giorni_max_evasione: 0 } })).corpo?.message === 'At least 1 day');

  // --- Avvisi: preferenze per account ---
  const fonti = await leggiPreferenze();
  check('Preferenze con tutte le fonti', ['prodotti', 'modifiche', 'connettori', 'scorte', 'assistenza'].every((id) => fonti.some((f) => f.id === id)), fonti.map((f) => f.id).join(', '));
  check('Etichette delle fonti in inglese', fonti.some((f) => f.etichetta === 'Low stock') && fonti.every((f) => !ITALIANO.test(`${f.etichetta} ${f.descrizione}`)));
  await chiama('/admin/avvisi/preferenze', admin, { corpo: { disattivate: [] } });
  const conTutto = (await chiama('/admin/avvisi', admin)).corpo.avvisi;
  check('Con le fonti accese ci sono i prodotti da approvare', conTutto.some((a) => a.chiave.startsWith('prodotto:')));
  check('Titoli degli avvisi in inglese', conTutto.every((a) => !ITALIANO.test(a.titolo)), conTutto[0]?.titolo);
  await chiama('/admin/avvisi/preferenze', admin, { corpo: { disattivate: ['prodotti'] } });
  const senza = (await chiama('/admin/avvisi', admin)).corpo.avvisi;
  check('Fonte spenta: niente avvisi di quel tipo', !senza.some((a) => a.chiave.startsWith('prodotto:')));
  check('La preferenza resta salvata', (await leggiPreferenze()).find((f) => f.id === 'prodotti')?.attiva === false);
  check('Fonte sconosciuta respinta', (await chiama('/admin/avvisi/preferenze', admin, { corpo: { disattivate: ['inventata'] } })).corpo?.message === 'Unknown alert');
  await chiama('/admin/avvisi/preferenze', admin, { corpo: { disattivate: [] } });

  // --- Esportazione ---
  const { conteggi } = (await chiama('/admin/impostazioni/esporta', admin)).corpo;
  const veri = {
    prodotti: (await chiama('/admin/products?limit=1&fields=id', admin)).corpo.count,
    aziende: (await chiama('/admin/sellers?limit=1&fields=id', admin)).corpo.count,
    clienti: (await chiama('/admin/customers?limit=1&fields=id', admin)).corpo.count,
  };
  check('Conteggi uguali ai dati veri', JSON.stringify(conteggi) === JSON.stringify(veri), JSON.stringify(conteggi));
  for (const tipo of ['prodotti', 'aziende', 'clienti']) {
    const { stato, corpo } = await chiama(`/admin/impostazioni/esporta/${tipo}`, admin, { corpo: {} });
    check(`Esportazione ${tipo}: tutte le righe`, stato === 200 && corpo.righe.length === veri[tipo] && corpo.dati.length === veri[tipo], `${corpo.righe?.length} righe`);
    check(`Esportazione ${tipo}: intestazioni allineate alle righe`, corpo.righe.every((r) => r.length === corpo.intestazioni.length));
  }
  const esportati = (await chiama('/admin/impostazioni/esporta/prodotti', admin, { corpo: {} })).corpo;
  const posizioneStato = esportati.intestazioni.indexOf('Status');
  check('Intestazioni e chiavi in inglese', esportati.intestazioni.includes('Title') && Object.hasOwn(esportati.dati[0], 'companies') && !Object.hasOwn(esportati.dati[0], 'aziende'));
  check('Stati dei prodotti in inglese', esportati.righe.every((r) => ['Live', 'In review', 'Changes requested', 'Rejected', 'Draft'].includes(r[posizioneStato])));
  check('Date in formato inglese', esportati.righe.every((r) => /^\d{2}\/\d{2}\/\d{4}$/.test(r.at(-1))), esportati.righe[0]?.at(-1));
  check('Prezzo con il punto decimale', esportati.righe.some((r) => /^\d+\.\d{2}$/.test(r[esportati.intestazioni.indexOf('Lowest price (EUR)')] ?? '')));
  check('Tipo di esportazione sconosciuto respinto', (await chiama('/admin/impostazioni/esporta/ordini', admin, { corpo: {} })).corpo?.message === 'Unknown export type');

  const azioni = (await chiama('/admin/registro', admin)).corpo.voci.map((v) => v.azione);
  for (const attesa of ['Store details updated', 'Shipping option updated', 'Fulfilment deadline updated', 'Alert preferences updated', 'Products exported', 'Customers exported']) {
    check(`Registro: ${attesa}`, azioni.includes(attesa));
  }

  // --- Permessi ---
  collab = await collaboratore('lettura');
  const lettura = collab.sessione;
  check('Sola lettura legge la valuta, che serve per gli importi', (await leggiValuta(lettura, 'admin')).stato === 200);
  check('Sola lettura non vede le impostazioni', negato(await chiama('/admin/impostazioni', lettura)));
  check('Sola lettura non vede le spedizioni', negato(await chiama('/admin/impostazioni/spedizioni', lettura)));
  check('Sola lettura non cambia il negozio', negato(await chiama('/admin/impostazioni/negozio', lettura, { corpo: nuovo })));
  check('Sola lettura non cambia le opzioni', negato(await chiama(`/admin/impostazioni/spedizioni/opzioni/${opzione.id}`, lettura, { corpo: { nome: 'x', tariffa: 1, soglia_gratuita: null, attiva: true } })));
  check('Sola lettura non esporta i clienti', negato(await chiama('/admin/impostazioni/esporta/clienti', lettura, { corpo: {} })));
  const suoi = await chiama('/admin/avvisi', lettura);
  check('Sola lettura riceve solo gli avvisi del suo ruolo', suoi.stato === 200 && !suoi.corpo.avvisi.some((a) => /^(prodotto|modifica|connettore):/.test(a.chiave)));
  const leSue = await chiama('/admin/avvisi/preferenze', lettura);
  check('Le preferenze mostrano solo le fonti del suo ruolo', !leSue.corpo.fonti.some((f) => f.id === 'connettori'));

  check("L'azienda non vede le impostazioni", negato(await chiama('/admin/impostazioni', azienda)));
  check("L'azienda non cambia la valuta", negato(await chiama('/admin/impostazioni/negozio', azienda, { corpo: nuovo })));
  check("L'azienda non esporta", negato(await chiama('/admin/impostazioni/esporta/clienti', azienda, { corpo: {} })));
  check("L'azienda non legge gli avvisi dell'amministrazione", negato(await chiama('/admin/avvisi', azienda)));
  check('Senza accesso niente valuta', negato(await chiama('/vendor/impostazioni/valuta', null)));

  // --- Browser ---
  await salvaNegozio(negozioOriginale);
  await salvaOpzione({ nome: opzione.nome, tariffa: opzione.tariffa, soglia_gratuita: opzione.soglia_gratuita, attiva: opzione.attiva });
  const { browser, nuovaPagina, errori } = await apriBrowser();
  try {
    const pagina = await nuovaPagina();
    await accediAdminBrowser(pagina);
    await apriConRiprova(pagina, '/impostazioni', '**/impostazioni/negozio');
    check('Settings apre la scheda Store', true);
    await pagina.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    const schede = pagina.getByRole('navigation', { name: 'Settings' });
    const nomiSchede = await schede.getByRole('link').allInnerTexts();
    check('Sette schede, nell\'ordine previsto', nomiSchede.join(', ') === 'Store, Team, Shipping, Alerts, Appearance, Data, Activity log', nomiSchede.join(', '));
    check('Team e Activity log portano alle loro pagine', (await schede.getByRole('link', { name: 'Team' }).getAttribute('href')) === '/team' && (await schede.getByRole('link', { name: 'Activity log' }).getAttribute('href')) === '/registro');
    await pagina.getByLabel('Store name').waitFor();
    check('Il modulo mostra i dati veri', (await pagina.getByLabel('Store name').inputValue()) === negozioOriginale.nome);
    check('Valuta predefinita EUR', (await pagina.getByLabel('Store currency').inputValue()) === negozioOriginale.valuta);
    const scelte = await pagina.getByLabel('Store currency').locator('option').allInnerTexts();
    check('Il selettore offre EUR, GBP e USD', scelte.length === 3 && ['EUR', 'GBP', 'USD'].every((c, i) => scelte[i].startsWith(c)), scelte.join(', '));
    await pagina.getByText('Prices are not converted').waitFor();
    check('La pagina spiega che i prezzi non vengono convertiti', true);
    check('Store: nessuna parola italiana', (await parolaItaliana(pagina)) === null, await parolaItaliana(pagina));

    const telefono = '+39 02 7654321';
    await pagina.getByLabel('Phone').fill(telefono);
    await pagina.getByLabel('Store currency').selectOption('GBP');
    await pagina.getByRole('button', { name: 'Save details' }).click();
    await pagina.getByText('Store details saved').waitFor();
    await pagina.reload();
    await pagina.getByLabel('Phone').waitFor();
    check('Il telefono resta dopo aver ricaricato la pagina', (await pagina.getByLabel('Phone').inputValue()) === telefono);
    check('La valuta resta dopo aver ricaricato la pagina', (await pagina.getByLabel('Store currency').inputValue()) === 'GBP');
    await scatta(pagina, 'negozio', { fullPage: true });

    await pagina.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Shipping' }).click();
    const opzioniPagina = pagina.locator('.impostazione--opzione');
    await opzioniPagina.first().waitFor();
    check('Opzioni reali nella pagina', (await opzioniPagina.count()) === opzioniOriginali.length);
    await pagina.waitForFunction(() => /£\d/.test(document.querySelector('.impostazioni__elenco')?.textContent ?? ''));
    check('Gli importi mostrano la valuta scelta', true);
    check('La cifra resta la stessa: nessuna conversione', /£10\.00/.test(await pagina.locator('.impostazioni__elenco').innerText()));
    check('Shipping: nessuna parola italiana', (await parolaItaliana(pagina)) === null, await parolaItaliana(pagina));
    await pagina.getByRole('button', { name: /^Edit / }).first().click();
    await pagina.getByRole('dialog', { name: 'Edit shipping option' }).waitFor();
    const [tariffaCampo, sogliaCampo] = await Promise.all([pagina.getByLabel('Rate').boundingBox(), pagina.getByLabel('Free over').boundingBox()]);
    check('Modale: i due importi hanno la stessa altezza', Math.abs(tariffaCampo.height - sogliaCampo.height) < 2, `${Math.round(tariffaCampo.height)} e ${Math.round(sogliaCampo.height)}`);
    await scatta(pagina, 'spedizioni-modale');
    await pagina.keyboard.press('Escape');
    await pagina.getByLabel('Days from the order').fill('4');
    await pagina.getByRole('button', { name: 'Save', exact: true }).click();
    await pagina.getByText('Fulfilment deadline saved').waitFor();
    check('Tempo massimo salvato dalla pagina', (await leggiSpedizioni()).regole.giorni_max_evasione === 4);
    await scatta(pagina, 'spedizioni', { fullPage: true });

    await salvaNegozio(negozioOriginale);
    await pagina.reload();
    await pagina.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Alerts' }).click();
    const interruttore = pagina.getByRole('switch', { name: 'Low stock' });
    await interruttore.waitFor();
    const acceso = await interruttore.getAttribute('aria-checked');
    await interruttore.click();
    await pagina.getByText('Preferences saved').first().waitFor();
    await pagina.reload();
    await pagina.getByRole('switch', { name: 'Low stock' }).waitFor();
    check('Preferenza salvata sul server dalla pagina', (await pagina.getByRole('switch', { name: 'Low stock' }).getAttribute('aria-checked')) !== acceso);
    check('Alerts: nessuna parola italiana', (await parolaItaliana(pagina)) === null, await parolaItaliana(pagina));

    const tema = () => pagina.evaluate(() => document.documentElement.dataset.tema);
    await pagina.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Appearance' }).click();
    await pagina.getByRole('radio', { name: /^Light/ }).click();
    check('Tema chiaro applicato', (await tema()) === 'chiaro');
    await pagina.waitForTimeout(300);
    check('I testi del tema restano dentro i riquadri', await pagina.evaluate(() => [...document.querySelectorAll('.impostazioni__temi button')].every((b) => b.scrollWidth <= b.clientWidth)));
    await scatta(pagina, 'aspetto-chiaro', { fullPage: true });
    await pagina.getByRole('radio', { name: /^Dark/ }).click();
    check('Tema scuro applicato', (await tema()) === 'scuro');
    await pagina.waitForTimeout(300);
    await scatta(pagina, 'aspetto-scuro', { fullPage: true });
    await pagina.getByRole('radio', { name: /^Match system/ }).click();
    check('Come il sistema: nessuna scelta salvata', (await pagina.evaluate(() => localStorage.getItem('ishtar-tema'))) === null);
    check('La scelta risulta selezionata', (await pagina.getByRole('radio', { name: /^Match system/ }).getAttribute('aria-checked')) === 'true');
    await pagina.emulateMedia({ colorScheme: 'light' });
    await pagina.waitForFunction(() => document.documentElement.dataset.tema === 'chiaro');
    check('Il tema segue il sistema mentre la pagina è aperta', true);
    await pagina.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Data' }).click();
    await pagina.emulateMedia({ colorScheme: 'dark' });
    await pagina.waitForFunction(() => document.documentElement.dataset.tema === 'scuro');
    check('Il tema segue il sistema anche nelle altre pagine', true);

    const scarica = async (nome) => {
      const [file] = await Promise.all([pagina.waitForEvent('download'), pagina.getByRole('button', { name: nome }).click()]);
      return { nome: file.suggestedFilename(), testo: fs.readFileSync(await file.path(), 'utf8') };
    };
    const csv = await scarica('Download Products as CSV');
    check('CSV scaricato con nome in inglese', /^ishtar-lab-products-\d{4}-\d{2}-\d{2}\.csv$/.test(csv.nome), csv.nome);
    check('CSV con intestazioni in inglese', csv.testo.startsWith('﻿ID;Title;Status'));
    check('CSV con tutte le righe', csv.testo.trim().split('\r\n').length === veri.prodotti + 1);
    const json = await scarica('Download Companies as JSON');
    check('JSON scaricato e valido', JSON.parse(json.testo).length === veri.aziende && json.nome.endsWith('.json'));
    check('Clienti: pulsanti spenti se non ci sono dati', veri.clienti > 0 || (await pagina.getByRole('button', { name: 'Download Customers as CSV' }).isDisabled()));
    await pagina.getByText('Restoring is not available').waitFor();
    check('Nessun ripristino finto: la pagina lo dice', true);
    check('Data: nessuna parola italiana', (await parolaItaliana(pagina)) === null, await parolaItaliana(pagina));
    await scatta(pagina, 'dati', { fullPage: true });

    await apriConRiprova(pagina, '/connettori', '**/connettori');
    await pagina.getByRole('heading', { name: 'Apps & connectors' }).waitFor();
    await pagina.locator('.connettore').first().waitFor();
    check('La sezione si chiama Apps & connectors', true);
    check('Il titolo contiene la parola Connectors', await pagina.getByRole('heading', { name: 'Connectors' }).isVisible());
    const ricercaApp = pagina.getByRole('searchbox', { name: 'Search apps' });
    check('La ricerca delle app ha la sua altezza', (await ricercaApp.boundingBox()).height < 60);
    await pagina.getByRole('group', { name: 'View' }).getByRole('button', { name: /Installed/ }).waitFor();
    await ricercaApp.fill('stripe');
    check('Ricerca di un servizio per nome', (await pagina.locator('.connettore').count()) === 1);
    await ricercaApp.fill('zzzzz');
    await pagina.getByText('No apps found').waitFor();
    check('Ricerca senza risultati: stato vuoto chiaro', true);
    await ricercaApp.fill('');
    check('Il servizio di prova è segnalato come tale', await pagina.locator('.connettore', { hasText: 'Servizio di prova' }).getByText('Test only').isVisible());
    await scatta(pagina, 'connettori', { fullPage: true });

    const telefonoPagina = await nuovaPagina({ viewport: { width: 390, height: 844 } });
    await accediAdminBrowser(telefonoPagina);
    for (const scheda of ['negozio', 'spedizioni', 'avvisi', 'aspetto', 'dati']) {
      await apriConRiprova(telefonoPagina, `/impostazioni/${scheda}`, `**/impostazioni/${scheda}`);
      await telefonoPagina.locator('.riquadro').first().waitFor();
      await telefonoPagina.waitForTimeout(400);
      check(`Telefono, ${scheda}: nessuno scorrimento laterale`, await telefonoPagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await scatta(telefonoPagina, `telefono-${scheda}`, { fullPage: true });
    }

    const aziendaPagina = await nuovaPagina();
    await accediAziendaBrowser(aziendaPagina, 'seller@mercur.dev');
    await aziendaPagina.goto(`${CONSOLE}/impostazioni`);
    await aziendaPagina.locator('.laterale').waitFor();
    await aziendaPagina.waitForTimeout(600);
    check("L'azienda non apre le impostazioni", !aziendaPagina.url().includes('impostazioni'));
    check('Nessun errore nel browser', errori.length === 0, errori.slice(0, 2).join(' | ').slice(0, 200));
  } finally {
    await browser.close();
  }
} finally {
  await ripristina();
}

const finale = await leggiNegozio();
const storeFinale = await leggiStore();
check('Metadati del negozio identici a prima', JSON.stringify(storeFinale.metadata ?? {}) === JSON.stringify(metadatiOriginali ?? {}), JSON.stringify(storeFinale.metadata));
check('Dati del negozio rimessi come prima', finale.nome === negozioOriginale.nome && finale.telefono === negozioOriginale.telefono && finale.prezzi_con_iva === negozioOriginale.prezzi_con_iva && finale.valuta === negozioOriginale.valuta);
const opzioneFinale = (await leggiSpedizioni()).opzioni.find((o) => o.id === opzione.id);
check('Opzione di spedizione rimessa come prima', JSON.stringify(opzioneFinale) === JSON.stringify(opzione));
check('Team senza il collaboratore di prova', !(await chiama('/admin/team', admin)).corpo.collaboratori.some((c) => c.email === collab?.email));

chiudi('Impostazioni verificate');
