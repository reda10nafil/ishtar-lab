// Prova di Overview e Analytics: numeri calcolati da ordini veri, permessi e passaggio nel browser.
// Gli ordini nascono dalla Store API con clienti «Prova» e vengono annullati alla fine.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONSOLE, accediAdmin, accediAzienda, attendiBackend, chiama as chiamaBase, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';
import { CARTELLA_SCREENSHOT, accediAdminBrowser, accediAziendaBrowser, apriBrowser } from './lib-browser.mjs';
import { finestra, istante, partiNelFuso } from '../piattaforma/packages/api/src/api/admin/analisi/lib/periodi.ts';


/** Il backend riparte quando un altro lavoro salva un file: la richiesta si ripete quando torna. */
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
const collaboratori = [];
const ordini = [];

async function collaboratore(ruolo) {
  const email = `prova-${ruolo}-a${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  collaboratori.push(email);
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const messaggio = await emailPer(email, 240);
  const token = tokenDaEmail(messaggio)?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: ruolo } });
  return accediAdmin(email, password);
}

const pubblica = (await chiama('/admin/api-keys?type=publishable&limit=1', admin)).corpo.api_keys[0].token;
const negozio = { headers: { 'x-publishable-api-key': pubblica } };

/** Un acquisto vero dalla Store API, con il pagamento di sistema: l'ordine entra in Orders come uno del sito. */
async function acquista(offerta, quantita, nome) {
  const regione = (await chiama('/store/regions?limit=1&fields=id,*countries', null, negozio)).corpo.regions[0];
  const paese = regione.countries.find((c) => c.iso_2 === 'it')?.iso_2 ?? regione.countries[0].iso_2;
  const carrello = (await chiama('/store/carts', null, {
    ...negozio,
    corpo: { region_id: regione.id, email: `prova-${nome}-${stamp}@multioutfit.test`, shipping_address: { country_code: paese, first_name: 'Prova', last_name: nome, address_1: 'Via Prova 1', city: 'Roma', postal_code: '00100' } },
  })).corpo.cart;
  const riga = await chiama(`/store/carts/${carrello.id}/line-items`, null, { ...negozio, corpo: { offer_id: offerta.id, quantity: quantita } });
  if (riga.stato !== 200) throw new Error(`Riga non aggiunta: ${riga.corpo?.message}`);
  const opzioni = Object.values((await chiama(`/store/shipping-options?cart_id=${carrello.id}`, null, negozio)).corpo.shipping_options ?? {}).flat();
  await chiama(`/store/carts/${carrello.id}/shipping-methods`, null, { ...negozio, corpo: { option_id: opzioni[0]?.id } });
  const raccolta = (await chiama('/store/payment-collections', null, { ...negozio, corpo: { cart_id: carrello.id } })).corpo.payment_collection;
  await chiama(`/store/payment-collections/${raccolta.id}/payment-sessions`, null, { ...negozio, corpo: { provider_id: 'pp_system_default' } });
  const fine = await chiama(`/store/carts/${carrello.id}/complete`, null, { ...negozio, corpo: {} });
  const creato = fine.corpo.order_group?.orders?.[0];
  if (!creato) throw new Error(`Acquisto non riuscito: ${JSON.stringify(fine.corpo).slice(0, 200)}`);
  ordini.push(creato.id);
  const letto = (await chiama(`/admin/orders/${creato.id}?fields=id,total,display_id`, admin)).corpo.order;
  return { id: creato.id, totale: Number(letto.total), numero: letto.display_id, azienda: creato.seller?.id };
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

const annulla = (id) => chiama(`/admin/orders/${id}/cancel`, admin, { corpo: {} });
const panoramica = async () => (await chiama('/admin/analisi/panoramica', admin)).corpo;
const vicino = (x, y) => Math.abs(x - y) < 0.01;

try {
  // Finestre di tempo, senza database
  const fuso = 'Europe/Rome';
  const adesso = new Date('2026-11-06T18:30:00Z');
  const sette = finestra('7g', adesso, fuso);
  check('7 giorni: sette colonne fino a oggi', sette.secchi.length === 7 && sette.secchi[6].etichetta === 'Fri 6' && sette.secchi[0].etichetta === 'Sat 31', sette.secchi.map((s) => s.etichetta).join(', '));
  check("7 giorni: il confronto è la settimana prima, anche col cambio d'ora", sette.precedente.fine.getTime() === sette.inizio.getTime() && sette.precedente.inizio.getTime() === istante(2026, 10, 24, 0, fuso).getTime());
  const oggi = finestra('oggi', adesso, fuso);
  check('Oggi: 24 ore, le prossime segnate come future', oggi.secchi.length === 24 && oggi.secchi[19].futuro === false && oggi.secchi[20].futuro === true);
  check('Oggi: confronto con lo stesso giorno della settimana scorsa', adesso.getTime() - oggi.precedente.fine.getTime() === 7 * 86_400_000);
  const anno = finestra('12m', adesso, fuso);
  check('12 mesi: dodici colonne, finisce col mese in corso', anno.secchi.length === 12 && anno.secchi[11].etichetta === 'Nov' && anno.secchi[0].etichetta === 'Dec');
  check('La mezzanotte segue il fuso del negozio', istante(2026, 7, 1, 0, fuso).toISOString() === '2026-06-30T22:00:00.000Z' && istante(2026, 1, 1, 0, fuso).toISOString() === '2025-12-31T23:00:00.000Z');
  check('Ora legale: le parti leggono il fuso giusto', partiNelFuso(new Date('2026-07-01T22:30:00Z'), fuso).giorno === 2);

  // Numeri prima degli acquisti
  const offerte = (await chiama('/store/offers?limit=100', null, negozio)).corpo.offers.filter((o) => o.prices?.length !== 0);
  const mia = offerte.find((o) => o.seller_id === a.azienda);
  const altrui = offerte.find((o) => o.seller_id !== a.azienda);
  if (!mia || !altrui) throw new Error('Servono offerte di due aziende diverse');

  const prima = await panoramica();
  check('Overview leggibile con dati veri', prima.tipo === 'admin' && Boolean(prima.vendite?.['7g']) && Boolean(prima.coda));
  check('Quattro periodi di vendita', ['oggi', '7g', '30g', '12m'].every((p) => prima.vendite[p]?.assi.length));
  check('Tre canali come in Orders', prima.vendite['7g'].canali.map((c) => c.id).join() === 'online,cassa,ingrosso');
  if (!demoCaricati) {
    check('Senza dati dimostrativi: nessun visitatore', prima.in_diretta === null && prima.conversione === null && prima.spunto === null);
    check('Senza dati dimostrativi: Traffic vuoto', (await chiama('/admin/analisi/traffico', admin)).corpo.traffico === null);
    check('Senza dati dimostrativi: visite nel report respinte', (await chiama('/admin/analisi/report?metrica=visite&periodo=30g', admin)).corpo.message === "Visits aren't measured yet");
    await mettiDemo(DEMO_PROVA);
  }
  const conDemo = await panoramica();
  check('Right now pieno dai dati dimostrativi', conDemo.in_diretta?.visitatori > 0 && conDemo.conversione?.valore > 0);
  const traffico = (await chiama('/admin/analisi/traffico', admin)).corpo.traffico;
  check('Traffic: finestre di 14 e 30 giorni', traffico?.finestre['30'].giorni.length === 30 && traffico.finestre['14'].giorni.length === 14 && traffico.finestre['30'].visite > traffico.finestre['14'].visite);
  check('Traffic: variazione sul periodo prima', typeof traffico?.finestre['30'].variazione === 'number');
  check('Traffic: griglia 7 per 8 e ora più affollata', traffico?.ore.length === 7 && traffico.ore.every((r) => r.length === 8) && Boolean(traffico.ora?.giorno));
  check('Traffic: le quote delle fonti sommano a uno', vicino(traffico?.fonti.reduce((s, f) => s + f.quota, 0), 1));
  const reportVisite = (await chiama('/admin/analisi/report?metrica=visite&periodo=14g', admin)).corpo;
  check('Report: visite giorno per giorno', reportVisite.righe?.length === 14 && reportVisite.totale === traffico.finestre['14'].visite);
  check('Report: le visite non si raggruppano per azienda', (await chiama('/admin/analisi/report?metrica=visite&raggruppa=azienda', admin)).corpo.message === 'Visits can only be shown over time');
  check('Team activity con collegamenti', Array.isArray(conDemo.attivita?.voci) && conDemo.attivita.voci.every((v) => v.chi && v.azione));
  const venditePrima = (await chiama('/admin/analisi/vendite', admin)).corpo;
  const reportPrima = (await chiama('/admin/analisi/report?metrica=ordini&periodo=7g', admin)).corpo;
  const aziendaPrima = (await chiama('/vendor/analisi/panoramica', a)).corpo;

  // Acquisti veri
  const uno = await acquista(mia, 2, 'Analisi');
  const due = await acquista(altrui, 1, 'Altrui');
  check('Due acquisti creati dalla Store API', uno.totale > 0 && due.totale > 0, `${uno.totale} + ${due.totale}`);

  const dopo = await panoramica();
  const somma = uno.totale + due.totale;
  check('Le vendite salgono di quanto incassato', vicino(dopo.vendite['7g'].totale, prima.vendite['7g'].totale + somma), `${prima.vendite['7g'].totale} -> ${dopo.vendite['7g'].totale}`);
  check('Anche Oggi e il canale Online', vicino(dopo.vendite.oggi.totale, prima.vendite.oggi.totale + somma) && vicino(dopo.vendite['7g'].canali[0].totale, prima.vendite['7g'].canali[0].totale + somma));
  check('La serie del grafico somma al totale', vicino(dopo.vendite['7g'].canali.flatMap((c) => c.valori).reduce((s, v) => s + v, 0), dopo.vendite['7g'].totale));
  check('Il numero di ordini sale di due', dopo.indicatori.ordini.valore === prima.indicatori.ordini.valore + 2);
  check('Ordine medio calcolato', vicino(dopo.indicatori.ordine_medio.valore, dopo.vendite['7g'].totale / dopo.indicatori.ordini.valore));
  check('Le ultime vendite mostrano il nuovo ordine', dopo.ultime.some((o) => o.numero === due.numero && o.cliente?.includes('Prova')));
  check('Coda: i nuovi ordini sono da preparare', dopo.coda.da_preparare === prima.coda.da_preparare + 2, `${prima.coda.da_preparare} -> ${dopo.coda.da_preparare}, in coda ${dopo.coda.voci.map((v) => v.numero).join(' ')}, nuovi ${uno.numero} ${due.numero}`);
  check('Obiettivo: incasso di oggi aggiornato', vicino(dopo.obiettivo.incasso, prima.obiettivo.incasso + somma));
  check('Più venduti dagli ordini veri', dopo.migliori.some((m) => m.id === mia.product_id && m.unita >= 2));

  const vendite = (await chiama('/admin/analisi/vendite', admin)).corpo;
  check('Mesi: dodici, e l\'ultimo è in corso', vendite.mesi.length === 12 && vendite.mesi[11].in_corso === true);
  check('Totale dell\'anno aggiornato', vicino(vendite.riepilogo.totale, venditePrima.riepilogo.totale + somma));
  check('Per azienda: ogni azienda ha le sue vendite', vendite.aziende.some((x) => x.id === a.azienda));
  check('Per canale: le quote sommano a uno', vicino(vendite.canali.reduce((s, c) => s + c.quota, 0), 1));
  check('Migliori prodotti in 30 giorni', vendite.prodotti.some((p) => p.id === mia.product_id));
  check('Outfit: nessun dato inventato senza il legame sulle righe', Array.isArray(vendite.outfit));
  check('Il proprietario vede i margini', vendite.vede_margini === true && vendite.margine !== null);

  // Report
  const report = (await chiama('/admin/analisi/report?metrica=ordini&periodo=7g', admin)).corpo;
  check('Report: ordini nel tempo', report.totale === reportPrima.totale + 2 && report.righe.length === 7, `${reportPrima.totale} -> ${report.totale}`);
  const perAzienda = (await chiama('/admin/analisi/report?metrica=unita&periodo=30g&raggruppa=azienda', admin)).corpo;
  check('Report: unità per azienda', perAzienda.righe.some((r) => r.chiave === a.azienda && r.valore >= 2));
  const perProdotto = (await chiama('/admin/analisi/report?metrica=vendite&periodo=30g&raggruppa=prodotto', admin)).corpo;
  check('Report: vendite per prodotto', perProdotto.righe.some((r) => r.chiave === mia.product_id));
  const perCanale = (await chiama('/admin/analisi/report?metrica=vendite&periodo=30g&raggruppa=canale', admin)).corpo;
  check('Report: vendite per canale', perCanale.righe.some((r) => r.etichetta === 'Online'));
  const soloIngrosso = (await chiama('/admin/analisi/report?metrica=vendite&periodo=7g&canale=ingrosso', admin)).corpo;
  check('Report: il filtro per canale esclude gli altri', soloIngrosso.totale < report.totale * 1000 && !soloIngrosso.righe.some((r) => r.valore === uno.totale && perCanale.righe.length === 1));
  check('Report: metrica sconosciuta respinta in inglese', (await chiama('/admin/analisi/report?metrica=boh', admin)).corpo.message === 'Choose a measure');

  // Il canale sta in order.metadata.canale: un ordine di cassa finisce sotto Shop
  const tornati = (await chiama('/admin/analisi/report?metrica=ordini&periodo=12m&raggruppa=canale', admin)).corpo.righe;
  check('Canali del report solo fra i tre previsti', tornati.every((r) => ['Online', 'Shop', 'Wholesale'].includes(r.etichetta)), tornati.map((r) => r.etichetta).join(', '));
  const totaleCanali = dopo.vendite['12m'].canali.reduce((s, c) => s + c.totale, 0);
  check('La somma dei canali fa il totale: nessun ordine resta fuori', vicino(totaleCanali, dopo.vendite['12m'].totale), `${totaleCanali}`);

  // Azienda: solo i propri dati, senza prezzi né clienti
  const azienda = (await chiama('/vendor/analisi/panoramica', a)).corpo;
  check('Azienda: le unità salgono solo per il suo ordine', azienda.unita['7g'].totale === aziendaPrima.unita['7g'].totale + 2, `${aziendaPrima.unita['7g'].totale} -> ${azienda.unita['7g'].totale}`);
  check('Azienda: un ordine in più, non due', azienda.indicatori.ordini.valore === aziendaPrima.indicatori.ordini.valore + 1);
  const testo = JSON.stringify(azienda);
  check('Azienda: nessun importo di vendita', !/"(vendite|importo|incasso|totale_vendite)":/.test(testo) && azienda.coda.voci.every((v) => v.totale === null));
  check('Azienda: nessun nome di cliente', azienda.coda.voci.every((v) => v.cliente === null) && !testo.includes('Prova'));
  check('Azienda: nessun ordine altrui', !azienda.ultime.some((o) => o.numero === due.numero));
  check('Azienda: niente rotte di Analytics', negato(await chiama('/admin/analisi/vendite', a)) && negato(await chiama('/admin/analisi/panoramica', a)));
  check('Senza accesso: respinto', negato(await chiama('/admin/analisi/vendite', null)) && negato(await chiama('/vendor/analisi/panoramica', null)));

  // Ruoli
  const marketing = await collaboratore('marketing');
  const senzaMargini = (await chiama('/admin/analisi/vendite', marketing)).corpo;
  check('Senza `margini`: nessun margine in risposta', senzaMargini.vede_margini === false && senzaMargini.margine === null && !JSON.stringify(senzaMargini).includes('"margine":{') && senzaMargini.mesi.every((m) => m.margine === undefined));
  check('Senza `margini`: report sul margine respinto', (await chiama('/admin/analisi/report?metrica=margine', marketing)).stato === 403);
  const operatore = await collaboratore('ordini');
  check('Senza `analisi`: Analytics respinta', negato(await chiama('/admin/analisi/vendite', operatore)) && negato(await chiama('/admin/analisi/report', operatore)));
  const suaPanoramica = (await chiama('/admin/analisi/panoramica', operatore)).corpo;
  check('Operatore ordini: Overview con vendite e coda', Boolean(suaPanoramica.vendite) && Boolean(suaPanoramica.coda));
  const catalogo = await collaboratore('catalogo');
  const suaCatalogo = (await chiama('/admin/analisi/panoramica', catalogo)).corpo;
  check('Ruolo senza `orders` né `evasioni`: niente coda', suaCatalogo.coda === null && Boolean(suaCatalogo.vendite));
  check('Ruolo senza `orders` né `customers`: niente nomi di clienti', suaCatalogo.ultime.every((o) => o.cliente === null));

  // Browser
  const { browser, nuovaPagina, errori } = await apriBrowser();
  const pagina = await nuovaPagina();
  await accediAdminBrowser(pagina);
  await pagina.goto(CONSOLE);
  const titolo = pagina.locator('h1');
  await titolo.waitFor();
  check('Browser: saluto per ora del giorno', /Good (morning|afternoon|evening)/.test((await titolo.getAttribute('aria-label')) ?? ''), await titolo.getAttribute('aria-label'));
  check('Browser: lettere separate per il saluto animato', (await pagina.locator('h1 .lettera').count()) > 5);
  const vendite7 = pagina.getByRole('region', { name: 'Sales' });
  await vendite7.getByText('Sales · last 7 days').waitFor();
  await pagina.getByText('Right now').waitFor();
  check('Browser: Right now pieno, con la pillola Live', await pagina.locator('.pan-stato--vivo').isVisible());
  check('Browser: visitatori dai dati', (await pagina.locator('.pan-adesso__numero > b').innerText()) !== '–');
  check('Browser: conversione dai dati', (await pagina.locator('.tessera', { hasText: 'Conversion' }).locator('.tessera__valore').innerText()) !== '–');
  await pagina.getByRole('heading', { name: 'Packing queue' }).waitFor();
  check('Browser: tutti i blocchi del pannello', (await Promise.all(['Best sellers', 'Running low', 'Team activity'].map((n) => pagina.getByRole('heading', { name: n }).isVisible()))).every(Boolean));
  check('Browser: blocco Insight con Plan a send', await pagina.getByRole('button', { name: 'Plan a send' }).isVisible());
  await pagina.getByRole('button', { name: 'Plan a send' }).click();
  const campagna = pagina.getByRole('dialog', { name: 'New campaign' });
  await campagna.waitFor();
  check('Browser: Plan a send apre New campaign sopra Overview', new URL(pagina.url()).pathname === '/');
  await pagina.keyboard.press('Escape');
  await campagna.waitFor({ state: 'hidden' });
  await pagina.getByRole('button', { name: 'New order' }).click();
  await pagina.getByRole('dialog', { name: 'New order' }).waitFor({ timeout: 45000 });
  check('Browser: New order apre il modulo sopra Overview', new URL(pagina.url()).pathname === '/');
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(600);
  await pagina.goto(CONSOLE);
  await pagina.getByRole('heading', { name: 'Packing queue' }).waitFor();
  const rigaCoda = pagina.getByRole('button', { name: `Open order #${dopo.ultime.find((o) => o.numero === due.numero).numero}` });
  await rigaCoda.waitFor();
  await rigaCoda.click();
  await pagina.waitForURL(/ordine=/);
  await pagina.getByText(`#${due.numero}`, { exact: false }).first().waitFor();
  check('Browser: la riga della coda apre la scheda sopra Overview', new URL(pagina.url()).pathname === '/');
  await pagina.keyboard.press('Escape');
  await pagina.waitForURL((u) => !u.search.includes('ordine='));
  const incasso = await chiama(`/admin/ordini/${due.id}/incassa`, admin, { corpo: {} });
  check('Ordine incassato per poterlo preparare', incasso.stato === 200, `HTTP ${incasso.stato} ${incasso.corpo?.message ?? ''}`);
  await pagina.goto(CONSOLE);
  const rigaPagata = pagina.getByRole('button', { name: `Open order #${due.numero}` });
  await rigaPagata.waitFor();
  await rigaPagata.getByRole('button', { name: 'Pack' }).click();
  await pagina.getByText(`#${due.numero} packed`).waitFor();
  await rigaPagata.getByRole('button', { name: 'Ship' }).waitFor();
  check('Browser: Pack prepara davvero e offre Ship', (await chiama(`/admin/ordini/${due.id}`, admin)).corpo.ordine?.evasione === 'fulfilled');
  await pagina.getByRole('button', { name: 'Undo' }).first().click();
  await rigaPagata.getByRole('button', { name: 'Pack' }).waitFor({ timeout: 30000 });
  check('Browser: Undo riporta l\'ordine da preparare', (await chiama(`/admin/ordini/${due.id}`, admin)).corpo.ordine?.evasione === 'not_fulfilled');
  const rifornisci = pagina.locator('.pan-scorte__riga').getByRole('button', { name: 'Restock' }).first();
  if (await rifornisci.count()) {
    await rifornisci.click();
    await pagina.getByText('requested', { exact: false }).first().waitFor();
    check('Browser: Restock chiede il rifornimento', true);
    await pagina.getByRole('button', { name: 'Undo' }).first().click();
    await pagina.waitForTimeout(1500);
    check('Browser: Undo annulla il rifornimento', await pagina.locator('.pan-scorte__riga').getByRole('button', { name: 'Restock' }).first().isVisible());
  } else {
    console.log('Restock non provato: nessun articolo sotto soglia da rifornire');
  }
  const voceTeam = pagina.locator('.pan-team li a').first();
  if (await voceTeam.count()) {
    const dove = await voceTeam.getAttribute('href');
    await voceTeam.click();
    await pagina.waitForURL((u) => u.pathname === dove || u.pathname.startsWith(`${dove}/`));
    check('Browser: le voci di Team activity portano alla sezione', true, dove);
    await pagina.goto(CONSOLE);
    await pagina.getByRole('heading', { name: 'Packing queue' }).waitFor();
  }
  check('Browser: azioni Full report e New order', (await pagina.getByRole('button', { name: 'Full report' }).isVisible()) && (await pagina.getByRole('button', { name: 'New order' }).isVisible()));
  await pagina.waitForTimeout(1500);
  await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'overview-scuro.png'), fullPage: true });
  await vendite7.getByRole('button', { name: '12 months' }).click();
  await vendite7.getByText('Sales · last 12 months').waitFor();
  check('Browser: il periodo cambia il blocco', await vendite7.getByText('a month on average').isVisible());
  await vendite7.getByRole('button', { name: '7 days' }).click();
  await pagina.waitForTimeout(1200);
  const cifra = () => vendite7.locator('.pan-cifra__valore').innerText();
  const tutto = await cifra();
  await vendite7.getByRole('button', { name: /Online/ }).click();
  await pagina.waitForTimeout(1200);
  check('Browser: spegnere un canale toglie il suo importo', (await cifra()) !== tutto, `${tutto} -> ${await cifra()}`);
  await vendite7.getByRole('button', { name: /Online/ }).click();
  const scatola = await vendite7.locator('.graf').boundingBox();
  await pagina.mouse.move(scatola.x + scatola.width - 40, scatola.y + 200);
  await pagina.locator('.graf__nota').waitFor();
  check('Browser: il mirino mostra i valori del punto', await pagina.locator('.graf__mirino').isVisible());
  await pagina.mouse.move(5, 5);

  await pagina.goto(`${CONSOLE}/analisi`);
  await pagina.getByRole('heading', { name: 'Sales by month' }).waitFor();
  check('Browser: /analisi apre Sales', pagina.url().endsWith('/analisi/vendite'));
  check('Browser: blocchi di Sales', (await Promise.all(['Month by month', 'Top earners', 'By company', 'By outfit'].map((n) => pagina.getByRole('heading', { name: n }).isVisible()))).every(Boolean));
  await pagina.getByRole('link', { name: 'Traffic', exact: true }).first().click();
  await pagina.getByRole('heading', { name: 'When people visit' }).waitFor();
  check('Browser: Traffic pieno dai dati', await pagina.getByText('Dashed line', { exact: false }).isVisible());
  await pagina.getByRole('group', { name: 'Visits window' }).getByRole('button', { name: '14 days' }).click();
  await pagina.getByText('last 14 days').waitFor();
  check('Browser: Traffic cambia finestra', true);
  check('Browser: griglia, fonti e pagine', (await pagina.locator('.ana-griglia-ore i').count()) === 56 && (await pagina.locator('.ana-pagine li').count()) > 0);
  await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'analisi-traffico.png'), fullPage: true });
  await pagina.getByRole('link', { name: 'Report builder', exact: true }).first().click();
  await pagina.getByRole('button', { name: 'Export CSV' }).waitFor();
  await pagina.getByRole('button', { name: 'Orders', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Orders · last 30 days' }).waitFor();
  await pagina.getByRole('button', { name: 'Visits', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Visits · last 30 days' }).waitFor();
  check('Browser: Visits nel report dai dati', await pagina.getByLabel('Group by').isDisabled());
  await pagina.getByRole('button', { name: 'Orders', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Orders · last 30 days' }).waitFor();
  await pagina.getByRole('group', { name: 'Chart type' }).getByRole('button', { name: 'Bars' }).click();
  await pagina.locator('.graf__colonna').first().waitFor();
  check('Browser: il grafico passa a colonne', true);
  await pagina.getByRole('group', { name: 'Chart type' }).getByRole('button', { name: 'Line' }).click();
  await pagina.getByLabel('Group by').selectOption('azienda');
  await pagina.locator('.graf__colonna').first().waitFor();
  check('Browser: raggruppando per azienda il grafico passa a colonne', (await pagina.locator('.graf__colonna').count()) > 0);
  const [scaricato] = await Promise.all([pagina.waitForEvent('download'), pagina.getByRole('button', { name: 'Export CSV' }).click()]);
  const csv = fs.readFileSync(await scaricato.path(), 'utf8');
  check('Browser: CSV scaricato con i dati del report', csv.includes('Company;Orders') && csv.split('\r\n').length > 1, scaricato.suggestedFilename());
  check('Browser: esportazione confermata', await pagina.getByText('of orders exported', { exact: false }).first().isVisible());
  await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'analisi-report.png'), fullPage: true });

  const chiara = await nuovaPagina({ colorScheme: 'light' });
  await chiara.addInitScript("try { localStorage.setItem('ishtar-tema', 'chiaro') } catch {}");
  await accediAdminBrowser(chiara);
  await chiara.getByRole('heading', { name: 'Packing queue' }).waitFor();
  await chiara.waitForTimeout(1500);
  await chiara.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'overview-chiaro.png'), fullPage: true });
  check('Browser: tema chiaro', (await chiara.evaluate(() => document.documentElement.dataset.tema)) === 'chiaro');

  const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
  await accediAdminBrowser(telefono).catch(() => undefined);
  for (const [rotta, nome] of [['/', 'overview'], ['/analisi/vendite', 'analisi-vendite'], ['/analisi/traffico', 'analisi-traffico'], ['/analisi/report', 'analisi-report']]) {
    await telefono.goto(`${CONSOLE}${rotta}`);
    await telefono.locator('main').waitFor();
    await telefono.waitForTimeout(1800);
    const larga = await telefono.evaluate(() => document.documentElement.scrollWidth);
    check(`Telefono: ${nome} senza scorrimento laterale`, larga <= 390, `${larga} px`);
    await telefono.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `${nome}-telefono.png`), fullPage: true });
  }

  const portale = await nuovaPagina();
  await accediAziendaBrowser(portale, 'seller@mercur.dev').catch(async () => {
    await attendiBackend();
    await accediAziendaBrowser(portale, 'seller@mercur.dev');
  });
  await portale.getByText('Units sold · last 7 days').waitFor();
  check('Browser azienda: stessa impostazione, in unità', await portale.getByRole('heading', { name: 'Packing queue' }).isVisible());
  const paginaAzienda = await portale.locator('main').innerText();
  check('Browser azienda: nessun blocco di vendite in valuta', !/Sales ·|Margin|Team activity/.test(paginaAzienda));
  await portale.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'overview-azienda.png'), fullPage: true });
  const veri = errori.filter((e) => !/Failed to fetch|401|Server unavailable/.test(e));
  check('Browser: nessun errore in pagina', veri.length === 0, veri.slice(0, 2).join(' | ').slice(0, 240));
  await browser.close();

  if (!demoCaricati) {
    await mettiDemo(null);
    const pulito = await panoramica();
    check('Tolti i dati dimostrativi i blocchi tornano vuoti', pulito.in_diretta === null && pulito.conversione === null);
  }

  // Annullare riporta i numeri indietro
  const annullato = await annulla(uno.id);
  check('Ordine annullato', annullato.stato === 200, `HTTP ${annullato.stato}`);
  await annulla(due.id);
  ordini.length = 0;
  const finale = await panoramica();
  check('Gli ordini annullati non contano nelle vendite', vicino(finale.vendite['7g'].totale, prima.vendite['7g'].totale), `${finale.vendite['7g'].totale}`);
  check('Né nella coda', finale.coda.da_preparare === prima.coda.da_preparare);
  check('Né fra gli ordini', finale.indicatori.ordini.valore === prima.indicatori.ordini.valore);
} finally {
  if (!demoCaricati && (await leggiStore()).metadata?.demo) await mettiDemo(null);
  for (const id of ordini) await annulla(id).catch(() => undefined);
  const { collaboratori: persone = [], inviti = [] } = (await chiama('/admin/team', admin)).corpo;
  for (const email of collaboratori) {
    const persona = persone.find((p) => p.email === email)?.id;
    if (persona) await chiama(`/admin/team/${persona}`, admin, { metodo: 'DELETE' });
    const invito = inviti.find((p) => p.email === email)?.id;
    if (invito) await chiama(`/admin/team/inviti/${invito}`, admin, { metodo: 'DELETE' });
  }
}

chiudi('Overview e Analytics calcolate da ordini veri, permessi rispettati');
