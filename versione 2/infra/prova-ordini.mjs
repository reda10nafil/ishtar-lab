// Prova di Orders e Fulfilment su un ordine vero: carrello, offerta, spedizione, pagamento pp_system_default.
// Stripe e il sito pubblico non si toccano. Email e nomi iniziano con «prova»: a fine prova gli ordini si
// annullano e, poiché Medusa non ha una rotta per eliminarli, si nascondono nel database solo quelli con quel prefisso.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONSOLE, accediAdmin as accediAdminBase, accediAzienda as accediAziendaBase, attendiBackend, chiama as chiamaBase, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';
import { CARTELLA_SCREENSHOT, accediAdminBrowser, accediAziendaBrowser, apriBrowser } from './lib-browser.mjs';
import { evasioneDi, richiesteDi } from '../piattaforma/packages/api/src/api/admin/ordini/lib/richieste.ts';

/** Il backend riparte quando un altro lavoro salva un file: la richiesta si ripete quando torna. */
const ritenta = async (lavoro) => {
  for (let tentativo = 0; ; tentativo += 1) {
    try {
      return await lavoro();
    } catch (errore) {
      if (tentativo >= 6) throw errore;
      await attendiBackend();
    }
  }
};
const chiama = (...a) => ritenta(() => chiamaBase(...a));
const accediAdmin = (...a) => ritenta(() => accediAdminBase(...a));
const accediAzienda = (...a) => ritenta(() => accediAziendaBase(...a));
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

const { check, chiudi } = nuovaProva();
await attendiBackend(240);
const stamp = Date.now();
const admin = await accediAdmin();
const a = await accediAzienda('seller@mercur.dev');
const b = await accediAzienda('kickz@mercur.dev');
const emailDi = (nome) => `prova-ordini-${nome}-${stamp}@multioutfit.test`;

const chiave = (await chiama('/admin/api-keys?type=publishable&limit=1&fields=id,token', admin)).corpo.api_keys[0].token;
const negozio = { headers: { 'x-publishable-api-key': chiave } };
const regione = (await chiama('/store/regions?limit=1&fields=id,*countries', null, negozio)).corpo.regions[0];
const indirizzo = { first_name: 'Prova', last_name: 'Cliente', address_1: 'Via Prova 1', city: 'Roma', postal_code: '00100', country_code: 'it', phone: '+39060000000' };

/** Solo offerte con scorte: nel database ci sono anche articoli esauriti. */
const offerteDi = async (sessione) => {
  const { righe } = (await chiama('/vendor/magazzino?limit=200', sessione)).corpo;
  const libere = new Map(righe.map((r) => [r.articolo_id, r.disponibili]));
  const { offers } = (await chiama(`/admin/offers?limit=100&seller_id=${sessione.azienda}`, admin)).corpo;
  return offers.filter((o) => o.prices?.some((p) => p.currency_code === 'eur') && (libere.get(o.inventory_items?.[0]?.id) ?? 0) >= 10);
};
const [offertaA, offertaA2] = await offerteDi(a);
const [offertaB] = await offerteDi(b);

/** Un ordine vero dal carrello: Mercur lo divide per azienda e restituisce il gruppo. */
async function checkout(email, offerte) {
  const { cart } = (await chiama('/store/carts', null, { ...negozio, corpo: { region_id: regione.id, email, shipping_address: indirizzo, billing_address: indirizzo } })).corpo;
  for (const o of offerte) await chiama(`/store/carts/${cart.id}/line-items`, null, { ...negozio, corpo: { offer_id: o.id, quantity: 1 } });
  const { shipping_options: opzioni } = (await chiama(`/store/shipping-options?cart_id=${cart.id}`, null, negozio)).corpo;
  for (const elenco of Object.values(opzioni)) await chiama(`/store/carts/${cart.id}/shipping-methods`, null, { ...negozio, corpo: { option_id: elenco[0].id } });
  const { payment_collection: incasso } = (await chiama('/store/payment-collections', null, { ...negozio, corpo: { cart_id: cart.id } })).corpo;
  await chiama(`/store/payment-collections/${incasso.id}/payment-sessions`, null, { ...negozio, corpo: { provider_id: 'pp_system_default' } });
  return (await chiama(`/store/carts/${cart.id}/complete`, null, { ...negozio, corpo: {} })).corpo;
}

const scheda = async (id) => (await chiama(`/admin/ordini/${id}`, admin)).corpo.ordine;
const inElenco = async (q, extra = '') => (await chiama(`/admin/ordini?q=${encodeURIComponent(q)}${extra}`, admin)).corpo;
const giacenza = async (sessione, sku) => (await chiama(`/vendor/magazzino?q=${encodeURIComponent(sku)}`, sessione)).corpo.righe?.find((r) => r.sku === sku)?.giacenza;

async function collaboratore(ruolo) {
  const email = `prova-${ruolo}-o${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  collaboratori.push({ email });
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const messaggio = await emailPer(email, 240);
  if (!messaggio) throw new Error(`Email per ${email} non arrivata`);
  const token = tokenDaEmail(messaggio)?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: ruolo } });
  return accediAdmin(email, password);
}

const collaboratori = [];
const clienti = new Set();
const gruppi = [];
const ordiniSolti = [];
const bozze = [];
let motivoReso = null;

const tieni = (risposta) => {
  if (risposta.order_group?.id) gruppi.push(risposta.order_group.id);
  if (risposta.order_group?.customer_id) clienti.add(risposta.order_group.customer_id);
  return risposta;
};

try {
  // --- Regole senza database ---
  const vecchio = { id: 'o', display_id: 1, status: 'pending', created_at: new Date(Date.now() - 10 * 86_400_000).toISOString(), metadata: {}, fulfillments: [], items: [{ id: 'r', title: 'Prova', quantity: 1, unit_price: 5, total: 5, detail: {} }] };
  const legami = { gruppi: new Map(), aziende: new Map([['o', ['s']]]), nomi: new Map([['s', 'Prova']]) };
  check('Oltre il tempo massimo la richiesta è in ritardo', richiesteDi(vecchio, legami, 3)[0].in_ritardo === true);
  check('Dentro il tempo massimo no', richiesteDi(vecchio, legami, 30)[0].in_ritardo === false);
  check('Senza tempo massimo nessun ritardo', richiesteDi(vecchio, legami, null)[0].scadenza === null);
  check('Stato dalle quantità', evasioneDi([{ quantita: 2, preparate: 2, spedite: 1, consegnate: 0 }]) === 'partially_shipped' && evasioneDi([{ quantita: 1, preparate: 1, spedite: 1, consegnate: 1 }]) === 'delivered');

  // --- Ordine vero con due aziende ---
  const emailCliente = emailDi('cliente');
  const fatto = tieni(await checkout(emailCliente, [offertaA, offertaB]));
  check('Checkout completato: un gruppo con due ordini', fatto.type === 'order_group' && fatto.order_group.orders.length === 2, fatto.order_group?.id);
  const gruppo = fatto.order_group.id;
  const ordineA = fatto.order_group.orders.find((o) => o.seller.id === a.azienda);
  const ordineB = fatto.order_group.orders.find((o) => o.seller.id === b.azienda);

  await attendi(4500); // L'elenco tiene una fotografia di pochi secondi.
  const elenco = await inElenco(emailCliente);
  check('In All compare una riga sola per il cliente', elenco.conteggio === 1 && elenco.ordini[0].id === gruppo);
  check('Riga: due aziende, To pack, autorizzato', elenco.ordini[0].aziende.length === 2 && elenco.ordini[0].evasione === 'not_fulfilled' && elenco.ordini[0].pagamento === 'authorized');
  check('Filtri a pillola con i conteggi', Object.keys(elenco.conteggi).length === 7 && elenco.conteggi.tutti >= 1 && elenco.conteggi.non_pagati >= 1);
  check('Canali contati', typeof elenco.canali.online === 'number');
  check('Filtro To pack lo trova', (await inElenco(emailCliente, '&filtro=da_preparare')).conteggio === 1);
  check('Filtro Delivered no', (await inElenco(emailCliente, '&filtro=consegnati')).conteggio === 0);
  check('Filtro Unpaid lo trova', (await inElenco(emailCliente, '&filtro=non_pagati')).conteggio === 1);
  check('Filtro di canale', (await inElenco(emailCliente, '&canale=online')).conteggio === 1 && (await inElenco(emailCliente, '&canale=cassa')).conteggio === 0);
  check('Ricerca per numero', (await inElenco(`#${elenco.ordini[0].numero}`)).ordini.some((o) => o.id === gruppo));
  check('Filtro sconosciuto respinto', (await chiama('/admin/ordini?filtro=xx', admin)).stato === 400);

  const prima = await scheda(gruppo);
  check('Scheda: una richiesta per azienda', prima.richieste.length === 2 && prima.richieste.every((r) => r.stato === 'da_confermare'));
  check('Scheda: righe, cliente, indirizzo, importi', prima.righe.length === 2 && prima.cliente.email === emailCliente && prima.indirizzo.citta === 'Roma' && prima.importi.totale > 0);
  check('Scheda: pagamento e cronologia', prima.pagamenti.length === 1 && prima.cronologia.at(-1).titolo.startsWith('Order placed'));
  check('Stessa scheda dall\'id di un singolo ordine', (await scheda(ordineA.id)).id === gruppo);
  check('Ordine inesistente: non trovato', (await chiama('/admin/ordini/order_inesistente', admin)).stato === 404);

  // --- Isolamento fra aziende: il limite è sul server ---
  const propri = (await chiama('/vendor/ordini', a)).corpo;
  const mio = propri.ordini.find((o) => o.id === ordineA.id);
  check('L\'azienda vede il suo ordine', Boolean(mio));
  check('L\'azienda non vede l\'ordine dell\'altra', !propri.ordini.some((o) => o.id === ordineB.id));
  check('Scheda altrui: non trovata', (await chiama(`/vendor/ordini/${ordineB.id}`, a)).stato === 404);
  const cartaAzienda = (await chiama(`/vendor/ordini/${ordineA.id}`, a)).corpo.ordine;
  const testoAzienda = JSON.stringify(cartaAzienda);
  check('Solo le proprie righe', cartaAzienda.richiesta.righe.length === 1);
  check('Destinatario: nome, indirizzo e telefono', cartaAzienda.destinatario.nome === 'Prova Cliente' && cartaAzienda.destinatario.indirizzo === 'Via Prova 1' && cartaAzienda.destinatario.telefono === indirizzo.phone);
  check('Nessuna email del cliente', !testoAzienda.includes(emailCliente) && !/"email"/.test(testoAzienda));
  check('Nessun prezzo di vendita né pagamento', !/"prezzo"|"totale"|"unit_price"|"pagamento"|"payment/.test(testoAzienda));
  check('Nessun dato dell\'altra azienda', !testoAzienda.includes(b.nome) && !testoAzienda.includes(offertaB.sku));
  const coda = (await chiama('/vendor/evasioni', a)).corpo;
  check('Coda azienda senza prezzi di vendita', coda.richieste.length >= 1 && !/"prezzo"|"totale"/.test(JSON.stringify(coda.richieste)));
  check('Il parametro azienda non apre le altre', (await chiama(`/vendor/evasioni?azienda=${b.azienda}`, a)).corpo.richieste.every((r) => r.azienda_id === a.azienda));
  check('Azione su ordine altrui respinta', negato(await chiama(`/vendor/evasioni/${ordineB.id}/conferma`, a, { corpo: {} })));
  const rottaMercur = await chiama('/vendor/orders?limit=5', a);
  check('La rotta di Mercur non dà email né prezzi', rottaMercur.stato === 200 && !/email|total|payment|address/.test(JSON.stringify(rottaMercur.corpo.orders)));
  check('Il dettaglio di Mercur è chiuso', negato(await chiama(`/vendor/orders/${ordineA.id}`, a)));
  check('Azienda fuori da /admin/ordini', negato(await chiama('/admin/ordini', { token: a.token })));

  // --- Avvisi ---
  const avvisiAdmin = (await chiama('/admin/avvisi', admin)).corpo.avvisi;
  check('Avviso amministratore: nuovo ordine', avvisiAdmin.some((x) => x.chiave === `ordine:${gruppo}` && x.a === `/ordini/tutti/${gruppo}`));
  const avvisiAzienda = (await chiama('/vendor/avvisi', a)).corpo.avvisi;
  check('Avviso azienda: ordine da confermare', avvisiAzienda.some((x) => x.chiave.startsWith(`richiesta-evasione:${ordineA.id}`)));
  check('Le aziende non ricevono gli avvisi altrui', !avvisiAzienda.some((x) => x.chiave.includes(ordineB.id)));

  // --- Pagamento ---
  const incasso = await chiama(`/admin/ordini/${gruppo}/incassa`, admin, { corpo: {} });
  check('Mark paid incassa', incasso.stato === 200);
  let pagato = await scheda(gruppo);
  for (let i = 0; i < 20 && pagato.pagamenti.length < 2; i += 1) {
    await attendi(500);
    pagato = await scheda(gruppo);
  }
  check('Pagato, diviso fra gli ordini', pagato.pagamento === 'captured' && pagato.pagamenti.length === 2 && pagato.incassato === prima.importi.totale, `${pagato.incassato}`);
  check('Secondo incasso respinto', (await chiama(`/admin/ordini/${gruppo}/incassa`, admin, { corpo: {} })).stato === 400);

  // --- Evasione dell'azienda ---
  const skuA = offertaA.sku;
  const prova1 = await giacenza(a, skuA);
  check('Spedire prima di preparare è respinto', (await chiama(`/vendor/evasioni/${ordineA.id}/spedisci`, a, { corpo: { tracking: 'X' } })).stato === 400);
  check('Conferma', (await chiama(`/vendor/evasioni/${ordineA.id}/conferma`, a, { corpo: {} })).stato === 200);
  check('Seconda conferma respinta', (await chiama(`/vendor/evasioni/${ordineA.id}/conferma`, a, { corpo: {} })).stato === 400);
  check('Prepara', (await chiama(`/vendor/evasioni/${ordineA.id}/prepara`, a, { corpo: {} })).stato === 200);
  const dopoPreparazione = await giacenza(a, skuA);
  check('La giacenza scende di uno', dopoPreparazione === prova1 - 1, `${prova1} → ${dopoPreparazione}`);
  const movimenti = (await chiama(`/vendor/magazzino/movimenti?q=${encodeURIComponent(skuA)}`, a)).corpo.movimenti;
  check('La vendita è nello storico delle scorte', movimenti.some((m) => m.nota?.includes('packed') && m.differenza === -1), movimenti[0]?.nota);
  check('Undo packing', (await chiama(`/vendor/evasioni/${ordineA.id}/riapri`, a, { corpo: {} })).stato === 200);
  check('La giacenza torna', (await giacenza(a, skuA)) === prova1);
  check('Prepara di nuovo', (await chiama(`/vendor/evasioni/${ordineA.id}/prepara`, a, { corpo: {} })).stato === 200);
  check('Azienda senza tracking respinta', (await chiama(`/vendor/evasioni/${ordineA.id}/spedisci`, a, { corpo: {} })).stato === 400);
  check('Link di tracking sbagliato respinto', (await chiama(`/vendor/evasioni/${ordineA.id}/spedisci`, a, { corpo: { tracking: 'X', tracking_url: 'non-valido' } })).stato === 400);
  const tracking = `PROVA${stamp}`;
  check('Segna spedito col tracking', (await chiama(`/vendor/evasioni/${ordineA.id}/spedisci`, a, { corpo: { corriere: 'Prova Express', tracking, tracking_url: `https://example.com/${tracking}` } })).stato === 200);
  const metaStrada = await scheda(gruppo);
  const parteA = metaStrada.richieste.find((r) => r.azienda_id === a.azienda);
  const parteB = metaStrada.richieste.find((r) => r.azienda_id === b.azienda);
  check('L\'amministratore vede il tracking', parteA.stato === 'spedita' && parteA.colli[0].tracking === tracking && parteA.colli[0].corriere === 'Prova Express');
  check('L\'altra azienda non è bloccata né toccata', parteB.stato === 'da_confermare');
  check('Ordine parzialmente spedito', metaStrada.evasione === 'partially_shipped');
  check('In cronologia', metaStrada.cronologia.some((v) => v.titolo.includes(tracking)));
  check('Annullare con un pacco partito è respinto', (await chiama(`/admin/ordini/${gruppo}/annulla`, admin, { corpo: {} })).stato === 400);
  check('Segna consegnato', (await chiama(`/vendor/evasioni/${ordineA.id}/consegna`, a, { corpo: {} })).stato === 200);

  // --- Evasione da amministratore e «Move on» ---
  const adminEvasioni = (await chiama('/admin/evasioni', admin)).corpo;
  check('Coda amministratore con aziende e riquadri', adminEvasioni.richieste.some((r) => r.ordine_id === ordineB.id) && adminEvasioni.aziende.length >= 2 && typeof adminEvasioni.riquadri.in_ritardo === 'number');
  check('Filtro per azienda', (await chiama(`/admin/evasioni?azienda=${b.azienda}`, admin)).corpo.richieste.every((r) => r.azienda_id === b.azienda));
  check('Conferma da amministratore', (await chiama(`/admin/evasioni/${ordineB.id}/${b.azienda}/conferma`, admin, { corpo: {} })).stato === 200);
  check('Azione sconosciuta respinta', (await chiama(`/admin/evasioni/${ordineB.id}/${b.azienda}/vola`, admin, { corpo: {} })).stato === 400);
  for (let passo = 0; passo < 3; passo += 1) {
    const mossa = await chiama('/admin/ordini/blocco', admin, { corpo: { azione: 'avanza', ids: [gruppo] } });
    if (mossa.corpo.riusciti !== 1) check(`Move on, passo ${passo + 1}`, false, JSON.stringify(mossa.corpo));
  }
  const finito = await scheda(gruppo);
  check('Move on porta tutto a consegnato', finito.evasione === 'delivered' && finito.azioni.passo === null, finito.evasione);
  check('Azione in blocco sconosciuta respinta', (await chiama('/admin/ordini/blocco', admin, { corpo: { azione: 'x', ids: [gruppo] } })).stato === 400);

  // --- Resi ---
  const motivo = await chiama('/admin/return-reasons', admin, { corpo: { value: `prova_${stamp}`, label: `Prova motivo ${stamp}` } });
  motivoReso = motivo.corpo.return_reason?.id;
  check('Motivo di reso creato', Boolean(motivoReso));
  const rigaA = finito.righe.find((r) => r.azienda_id === a.azienda);
  const rigaB = finito.righe.find((r) => r.azienda_id === b.azienda);
  check('Reso con due aziende respinto', (await chiama('/admin/ordini/resi', admin, { corpo: { ordine_id: ordineA.id, righe: [{ id: rigaA.id, quantita: 1 }, { id: rigaB.id, quantita: 1 }] } })).stato === 400);
  check('Quantità eccessiva respinta', (await chiama('/admin/ordini/resi', admin, { corpo: { ordine_id: ordineA.id, righe: [{ id: rigaA.id, quantita: 5 }] } })).stato === 400);
  const reso = await chiama('/admin/ordini/resi', admin, { corpo: { ordine_id: ordineA.id, motivo_id: motivoReso, nota: 'Prova', righe: [{ id: rigaA.id, quantita: 1 }] } });
  check('Reso richiesto', reso.stato === 201, JSON.stringify(reso.corpo).slice(0, 120));
  const idReso = reso.corpo.id;
  const leggiReso = async () => (await chiama('/admin/ordini/resi?vista=tutti', admin)).corpo.resi.find((r) => r.id === idReso);
  const richiesto = await leggiReso();
  check('Fase Requested con motivo e importo', richiesto.fase === 'richiesto' && richiesto.voci[0].motivo === `Prova motivo ${stamp}` && richiesto.importo === rigaA.totale, `${richiesto.importo}`);
  check('Nei resi aperti', (await chiama('/admin/ordini/resi', admin)).corpo.resi.some((r) => r.id === idReso));
  check('Ricevere prima di approvare è respinto', (await chiama(`/admin/ordini/resi/${idReso}/ricevi`, admin, { corpo: {} })).stato === 400);
  check('Approvazione', (await chiama(`/admin/ordini/resi/${idReso}/approva`, admin, { corpo: {} })).stato === 200);
  const scorteAvanti = await giacenza(a, skuA);
  check('Ricezione', (await chiama(`/admin/ordini/resi/${idReso}/ricevi`, admin, { corpo: {} })).stato === 200);
  check('La merce rientra in magazzino', (await giacenza(a, skuA)) === scorteAvanti + 1);
  const movimentiReso = (await chiama(`/vendor/magazzino/movimenti?q=${encodeURIComponent(skuA)}`, a)).corpo.movimenti;
  check('Il reso è nello storico delle scorte', movimentiReso.some((m) => m.motivo === 'reso' && m.differenza === 1), movimentiReso[0]?.nota);
  const ricevuto = await leggiReso();
  check('Fase Received, con il dovuto', ricevuto.fase === 'ricevuto' && ricevuto.rimborsabile >= ricevuto.importo, `${ricevuto.rimborsabile}`);
  check('Rimborso eccessivo respinto', (await chiama(`/admin/ordini/resi/${idReso}/rimborsa`, admin, { corpo: { importo: ricevuto.rimborsabile + 1000 } })).stato === 400);
  const rimborso = await chiama(`/admin/ordini/resi/${idReso}/rimborsa`, admin, { corpo: { importo: ricevuto.importo } });
  check('Rimborso', rimborso.stato === 200, JSON.stringify(rimborso.corpo).slice(0, 200));
  const rimborsato = await leggiReso();
  check('Fase Refunded', rimborsato.fase === 'rimborsato' && rimborsato.rimborso.importo === ricevuto.importo);
  const conReso = await scheda(gruppo);
  check('Il rimborso è sull\'ordine', conReso.rimborsato === ricevuto.importo && conReso.pagamento === 'partially_refunded', conReso.pagamento);
  check('Riquadri dei resi', (await chiama('/admin/ordini/resi', admin)).corpo.riquadri.rimborsato >= ricevuto.importo);

  // --- Bozze ---
  const opzioni = (await chiama('/admin/ordini/bozze/opzioni', admin)).corpo;
  check('Opzioni del modulo: offerte e consegne', opzioni.offerte.length > 0 && opzioni.consegne.length > 0);
  const emailBozza = emailDi('bozza');
  const spedire = { nome: 'Prova Bozza', via: 'Via Prova 2', citta: 'Milano', cap: '20100', paese: 'it' };
  check('Bozza senza righe respinta', (await chiama('/admin/ordini/bozze', admin, { corpo: { email: emailBozza, righe: [] } })).stato === 400);
  const nuova = await chiama('/admin/ordini/bozze', admin, { corpo: { email: emailBozza, nota: 'Prova nota', consegna: opzioni.consegne[0], indirizzo: spedire, righe: [{ offerta_id: offertaA2.id, quantita: 2 }] } });
  check('Bozza creata', nuova.stato === 201, JSON.stringify(nuova.corpo).slice(0, 120));
  bozze.push(nuova.corpo.id);
  const leggiBozza = async (id) => (await chiama('/admin/ordini/bozze', admin)).corpo.bozze.find((x) => x.id === id);
  const bozza = await leggiBozza(nuova.corpo.id);
  check('Bozza reale, con nota e righe', bozza?.nota === 'Prova nota' && bozza.righe[0].quantita === 2 && Boolean((await chiama(`/admin/draft-orders/${bozza.id}`, admin)).corpo.draft_order));
  const manuale = await chiama('/admin/draft-orders', admin, { corpo: { region_id: regione.id, email: emailDi('ingrosso'), metadata: { ingrosso_trattativa_id: 'prova' }, items: [{ title: 'Prova articolo', quantity: 1, unit_price: 10 }] } });
  bozze.push(manuale.corpo.draft_order.id);
  check('Le bozze di Wholesale compaiono qui', (await leggiBozza(manuale.corpo.draft_order.id))?.origine === 'ingrosso');
  const senzaIndirizzo = await chiama(`/admin/ordini/bozze/${manuale.corpo.draft_order.id}/conferma`, admin, { corpo: {} });
  check('Conferma senza indirizzo respinta', senzaIndirizzo.stato === 400, senzaIndirizzo.corpo?.message);
  check('Bozza eliminata', (await chiama(`/admin/draft-orders/${manuale.corpo.draft_order.id}`, admin, { metodo: 'DELETE' })).stato === 200);
  check('Non è più in elenco', !(await leggiBozza(manuale.corpo.draft_order.id)));
  const convertita = await chiama(`/admin/ordini/bozze/${bozza.id}/conferma`, admin, { corpo: {} });
  check('Bozza convertita in ordine', convertita.stato === 200, JSON.stringify(convertita.corpo).slice(0, 120));
  ordiniSolti.push(bozza.id);
  bozze.length = 0;
  const daBozza = await scheda(bozza.id);
  check('Ordine vero con la richiesta dell\'azienda', daBozza.richieste.length === 1 && daBozza.richieste[0].azienda_id === a.azienda && daBozza.pagamento === 'not_paid');
  check('L\'azienda lo riceve', (await chiama(`/vendor/ordini/${bozza.id}`, a)).stato === 200);
  check('Non è più una bozza', !(await leggiBozza(bozza.id)));
  check('Le scorte sono riservate', (await chiama(`/vendor/magazzino?q=${encodeURIComponent(offertaA2.sku)}`, a)).corpo.righe.find((r) => r.sku === offertaA2.sku)?.riservate >= 2);
  check('Mark paid su ordine senza pagamento', (await chiama(`/admin/ordini/${bozza.id}/incassa`, admin, { corpo: {} })).stato === 200);
  await attendi(500);
  check('Risulta pagato', (await scheda(bozza.id)).pagamento === 'captured');

  const dueAziende = await chiama('/admin/ordini/bozze', admin, { corpo: { email: emailDi('doppia'), indirizzo: spedire, conferma: true, righe: [{ offerta_id: offertaA2.id, quantita: 1 }, { offerta_id: offertaB.id, quantita: 1 }] } });
  check('Bozza con due aziende confermata', dueAziende.stato === 201, JSON.stringify(dueAziende.corpo).slice(0, 120));
  ordiniSolti.push(dueAziende.corpo.id);
  const doppia = await scheda(dueAziende.corpo.id);
  check('Una richiesta per ciascuna azienda', doppia.richieste.length === 2 && doppia.senza_azienda.length === 0);
  const vistaA = (await chiama(`/vendor/ordini/${dueAziende.corpo.id}`, a)).corpo.ordine;
  check('Ognuna vede solo le sue righe', vistaA.richiesta.righe.length === 1 && !JSON.stringify(vistaA).includes(offertaB.product_variant?.sku ?? '§'));
  check('Prepara solo la propria parte', (await chiama(`/vendor/evasioni/${dueAziende.corpo.id}/prepara`, a, { corpo: {} })).stato === 200 && (await scheda(dueAziende.corpo.id)).evasione === 'partially_fulfilled');
  check('Annullare con una parte imballata è respinto', (await chiama(`/admin/ordini/${dueAziende.corpo.id}/annulla`, admin, { corpo: {} })).stato === 400);
  await chiama(`/vendor/evasioni/${dueAziende.corpo.id}/riapri`, a, { corpo: {} });

  // --- Annullamento ---
  const daAnnullare = tieni(await checkout(emailDi('annullo'), [offertaA2]));
  const idAnnullo = daAnnullare.order_group.id;
  check('Note sull\'ordine', (await chiama(`/admin/ordini/${idAnnullo}/note`, admin, { corpo: { testo: 'Prova nota' } })).stato === 201 && (await scheda(idAnnullo)).note[0].testo === 'Prova nota');
  check('Nota vuota respinta', (await chiama(`/admin/ordini/${idAnnullo}/note`, admin, { corpo: { testo: ' ' } })).stato === 400);
  check('Annullamento', (await chiama(`/admin/ordini/${idAnnullo}/annulla`, admin, { corpo: {} })).stato === 200);
  const annullato = await scheda(idAnnullo);
  check('Risulta annullato', annullato.annullato && annullato.evasione === 'canceled' && annullato.azioni.annulla === false);
  check('Le azioni sull\'annullato sono respinte', (await chiama(`/vendor/evasioni/${annullato.ordini[0].id}/conferma`, a, { corpo: {} })).stato === 400);

  // --- Ruoli ---
  const lettura = await collaboratore('contabilita');
  check('Sola lettura vede gli ordini', (await chiama('/admin/ordini', lettura)).stato === 200);
  check('Sola lettura non annulla', negato(await chiama(`/admin/ordini/${gruppo}/annulla`, lettura, { corpo: {} })));
  check('Sola lettura non crea bozze', negato(await chiama('/admin/ordini/bozze', lettura, { corpo: { email: emailDi('x'), righe: [{ offerta_id: offertaA.id, quantita: 1 }] } })));
  check('Sola lettura non fa resi', negato(await chiama(`/admin/ordini/resi/${idReso}/approva`, lettura, { corpo: {} })));
  check('Sola lettura non incassa', negato(await chiama(`/admin/ordini/${gruppo}/incassa`, lettura, { corpo: {} })));
  check('Sola lettura non avanza le evasioni', negato(await chiama(`/admin/evasioni/${ordineB.id}/${b.azienda}/conferma`, lettura, { corpo: {} })));
  check('Blocco controllato per azione', negato(await chiama('/admin/ordini/blocco', lettura, { corpo: { azione: 'avanza', ids: [gruppo] } })));
  const registro = (await chiama('/admin/registro', admin)).corpo.voci.map((v) => v.azione);
  for (const frase of ['Order marked as paid', 'Return approved', 'Draft turned into an order', 'Order cancelled']) check(`Registro: ${frase}`, registro.includes(frase));

  // --- Browser: ordine fresco per le azioni sullo schermo ---
  const inVista = tieni(await checkout(emailDi('vista'), [offertaA, offertaB]));
  const { browser, nuovaPagina: pagina0, errori } = await apriBrowser();
  // Il backend è condiviso: sotto carico una risposta può durare decine di secondi.
  const nuovaPagina = async (opzioni) => {
    const nuova = await pagina0(opzioni);
    nuova.setDefaultTimeout(70000);
    return nuova;
  };
  const pagina = await nuovaPagina();
  await pagina.addInitScript(() => {
    window.print = () => {
      window.__fogli = [...document.querySelectorAll('.ord-foglio')].map((f) => f.textContent);
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  await accediAdminBrowser(pagina);
  await pagina.goto(`${CONSOLE}/ordini/tutti`);
  await pagina.getByRole('heading', { name: 'Orders' }).waitFor();
  await pagina.locator('.ord-tabella tbody tr').first().waitFor();

  for (const scheda1 of ['All orders', 'Drafts', 'Returns', 'Fulfilment']) check(`Scheda ${scheda1}`, (await pagina.getByRole('link', { name: scheda1 }).count()) > 0);
  for (const testo of ['To pack', 'Ready to ship', 'Unpaid', 'Returns open']) check(`Riquadro ${testo}`, (await pagina.locator('.ord-tessera', { hasText: testo }).count()) === 1);
  for (const nome of ['All', 'To pack', 'Packed', 'Shipped', 'Delivered', 'Unpaid', 'Refunded']) check(`Filtro ${nome}`, (await pagina.locator('.filtri button', { hasText: nome }).count()) >= 1);
  for (const nome of ['All', 'Online', 'Shop', 'Wholesale']) check(`Canale ${nome}`, (await pagina.locator('.selettore button', { hasText: nome }).count()) === 1);
  for (const nome of ['Order', 'Date', 'Customer', 'Channel', 'Items', 'Payment', 'Fulfilment', 'Total']) check(`Colonna ${nome}`, (await pagina.locator('.ord-tabella th', { hasText: nome }).count()) >= 1);
  await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'ordini-elenco.png'), fullPage: true });

  const cerca = pagina.getByRole('searchbox', { name: 'Search orders' });
  await cerca.fill(emailDi('vista'));
    await pagina.waitForFunction(() => document.querySelectorAll('.ord-tabella tbody tr').length === 1 && document.querySelector('.ord-tabella tbody tr').textContent.includes('Prova Cliente'));
  check('Ricerca nel browser', true);
  await cerca.fill('zzzzzz');
  await pagina.getByText('No orders match “zzzzzz”').waitFor();
  await pagina.getByRole('button', { name: 'Clear filters' }).click();
  await pagina.locator('.ord-tabella tbody tr').first().waitFor();
  check('Vuoto con Clear filters', true);

  await pagina.locator('.ord-tabella th button', { hasText: 'Total' }).click();
  await pagina.locator('.ord-tabella th[aria-sort="descending"]', { hasText: 'Total' }).waitFor();
  await pagina.locator('.ord-tabella th button', { hasText: 'Date' }).click();
  await pagina.locator('.ord-tabella th[aria-sort="descending"]', { hasText: 'Date' }).waitFor();
  check('Ordinamento dalle intestazioni', true);

  const [scaricato] = await Promise.all([pagina.waitForEvent('download'), pagina.getByRole('button', { name: 'Export' }).click()]);
  const csv = fs.readFileSync(await scaricato.path(), 'utf8');
  check('Esportazione CSV in inglese', /^ishtar-lab-orders-\d{4}-\d{2}-\d{2}\.csv$/.test(scaricato.suggestedFilename()) && csv.includes('Order;Date;Customer;Channel;Items;Payment;Fulfilment;Total') && csv.includes(emailDi('vista')));

  await pagina.getByRole('checkbox', { name: 'Select every order that can move on' }).click();
  await pagina.locator('.ord-blocco').waitFor();
  for (const nome of ['Move on', 'Mark paid', 'Print slips', 'Cancel orders', 'Clear']) check(`Azione in blocco ${nome}`, (await pagina.locator('.ord-blocco button', { hasText: nome }).count()) === 1);
  await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'ordini-blocco.png') });
  await pagina.locator('.ord-blocco button', { hasText: 'Clear' }).click();
  await pagina.locator('.ord-blocco').waitFor({ state: 'detached' });

  await cerca.fill(emailDi('vista'));
  await pagina.waitForFunction(() => document.querySelectorAll('.ord-tabella tbody tr').length === 1);
  await pagina.locator('.ord-tabella tbody tr').first().locator('button[role="checkbox"]').click();
  await pagina.locator('.ord-blocco button', { hasText: 'Print slips' }).click();
  await pagina.waitForFunction(() => window.__fogli);
  const fogli = await pagina.evaluate(() => window.__fogli);
  check('Distinte: una per azienda, senza prezzi', fogli.length >= 1 && fogli.every((f) => f.includes('Packing slip') && !/[€£$]/.test(f)), `${fogli.length} fogli`);
  await pagina.evaluate(() => { delete window.__fogli; });
  await pagina.getByText(/packing slips? sent to the printer/).first().waitFor();
  check('Avviso dopo Print slips', true);
  await pagina.locator('.ord-blocco button', { hasText: 'Clear' }).click();

  await pagina.goto(`${CONSOLE}/ordini/tutti/${inVista.order_group.id}`);
  const cassetto = pagina.getByRole('dialog', { name: /^Order #/ });
  await cassetto.waitFor();
  await cassetto.getByText('Timeline', { exact: true }).waitFor();
  for (const testo of ['Items', 'Customer', 'Delivery', 'Payment', 'Fulfilment', 'Timeline', 'Notes']) check(`Scheda: blocco ${testo}`, (await cassetto.locator('.ord-etichetta', { hasText: testo }).count()) === 1);
  for (const nome of ['Cancel order', 'Packing slip', 'Mark paid', 'Mark packed']) check(`Scheda: azione ${nome}`, (await cassetto.getByRole('button', { name: nome }).count()) === 1);
  await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'ordini-scheda.png') });
  await cassetto.getByRole('button', { name: 'Packing slip' }).click();
  await pagina.waitForFunction(() => window.__fogli);
  const fogliScheda = await pagina.evaluate(() => window.__fogli.length);
  check('Distinta dalla scheda', fogliScheda === 2, String(fogliScheda));
  await cassetto.getByRole('button', { name: 'Mark paid' }).click();
  await cassetto.getByRole('button', { name: 'Mark paid' }).waitFor({ state: 'detached' });
  check('Mark paid dalla scheda', true);
  await cassetto.getByLabel('Note').fill('Prova nota dal browser');
  await cassetto.getByRole('button', { name: 'Add', exact: true }).click();
  await cassetto.getByText('Prova nota dal browser').first().waitFor();
  check('Nota dalla scheda', true);
  await pagina.keyboard.press('Escape');
  await cassetto.waitFor({ state: 'detached' });
  await pagina.waitForURL(`${CONSOLE}/ordini/tutti`);
  check('Esc chiude la scheda e resta l\'elenco', true);

  await pagina.goto(`${CONSOLE}/ordini/bozze?nuovo=1`);
  const modulo = pagina.getByRole('dialog', { name: 'New order' });
  await modulo.waitFor();
  await modulo.getByLabel('Add a product').locator('option').nth(1).waitFor({ state: 'attached' });
  await modulo.getByLabel('Email, for a new customer').fill(emailDi('modulo'));
  await modulo.getByLabel('Add a product').selectOption(offertaA2.id);
  await modulo.getByRole('button', { name: 'Add', exact: true }).click();
  await modulo.getByRole('button', { name: /^One more/ }).click();
  await modulo.getByRole('button', { name: /^One fewer/ }).click();
  check('Passetti della quantità nel modulo', (await modulo.locator('.ord-passetti span').first().innerText()) === '1');
  await modulo.getByLabel('Recipient').fill('Prova Modulo');
  await modulo.getByLabel('Street and number').fill('Via Prova 3');
  await modulo.getByLabel('City').fill('Torino');
  await modulo.getByLabel('Postcode').fill('10100');
  await modulo.getByLabel('Note').fill('Prova dal browser');
  await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'ordini-nuovo.png') });
  await modulo.getByRole('button', { name: 'Save draft' }).click();
  const biglietto = pagina.locator('.ord-bozza', { hasText: 'Prova dal browser' });
  await biglietto.waitFor();
  await pagina.waitForFunction(() => !location.search.includes('nuovo'));
  check('New order con ?nuovo=1 salva una bozza', true);
  await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'ordini-bozze.png'), fullPage: true });
  await biglietto.getByRole('button', { name: 'Delete' }).click();
  await pagina.getByRole('button', { name: 'Delete draft' }).click();
  await biglietto.waitFor({ state: 'detached' });
  check('Bozza eliminata dal browser', true);

  const daConvertire = (await chiama('/admin/ordini/bozze', admin, { corpo: { email: emailDi('converti'), nota: 'Prova da convertire', indirizzo: spedire, righe: [{ offerta_id: offertaA2.id, quantita: 1 }] } })).corpo;
  bozze.push(daConvertire.id);
  await pagina.goto(`${CONSOLE}/ordini/bozze`);
  const carta = pagina.locator('.ord-bozza', { hasText: 'Prova da convertire' });
  await carta.getByRole('button', { name: 'Make it an order' }).click();
  const conversione = pagina.getByRole('dialog', { name: `Convert D-${daConvertire.numero} to an order` });
  await conversione.waitFor();
  await conversione.getByRole('button', { name: /^One more/ }).click();
  await conversione.getByRole('button', { name: 'Create order' }).click();
  await pagina.waitForURL(`${CONSOLE}/ordini/tutti/${daConvertire.id}`);
  ordiniSolti.push(daConvertire.id);
  bozze.length = 0;
  await pagina.getByRole('dialog', { name: /^Order #/ }).getByText('× 2').waitFor();
  check('Make it an order apre il modulo e la quantità cambiata resta', true);
  await pagina.keyboard.press('Escape');

  await pagina.goto(`${CONSOLE}/ordini/resi`);
  await pagina.locator('.selettore button', { hasText: 'All returns' }).click();
  const biglietti = pagina.locator('.ord-reso');
  await biglietti.first().waitFor();
  check('Resi: passi Requested, Approved, Received, Refunded', (await pagina.locator('.ord-passi').first().locator('li').count()) === 4);
  for (const testo of ['Open returns', 'Refunded this month', 'Return rate, 30 days']) check(`Riquadro ${testo}`, (await pagina.locator('.ord-tessera', { hasText: testo }).count()) === 1);
  await pagina.locator('.selettore button', { hasText: 'Open' }).click();
  await pagina.locator('.selettore button', { hasText: 'All returns' }).click();
  await pagina.getByRole('button', { name: 'Return reasons' }).click();
  await pagina.getByRole('dialog', { name: 'Return reasons' }).getByText(`Prova motivo ${stamp}`).waitFor();
  check('Gestione dei motivi di reso', true);
  await pagina.keyboard.press('Escape');
  await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'ordini-resi.png'), fullPage: true });

  await pagina.goto(`${CONSOLE}/evasioni`);
  await pagina.locator('.ord-tabella tbody tr').first().waitFor();
  check('Fulfilment con le stesse schede', (await pagina.getByRole('link', { name: 'Drafts' }).count()) > 0);
  await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'ordini-evasioni.png'), fullPage: true });

  // Azienda nel browser
  const azienda = await nuovaPagina();
  await accediAziendaBrowser(azienda, 'seller@mercur.dev');
  await azienda.goto(`${CONSOLE}/ordini/tutti`);
  await azienda.locator('.ord-tabella tbody tr').first().waitFor();
  const testoElenco = await azienda.locator('main').innerText();
  check('Azienda: niente Drafts né Returns', (await azienda.getByRole('link', { name: 'Drafts' }).count()) === 0 && (await azienda.getByRole('link', { name: 'Returns' }).count()) === 0);
  check('Azienda: nessuna email del cliente a schermo', !testoElenco.includes('@multioutfit.test'));
  await azienda.goto(`${CONSOLE}/evasioni`);
  const numeroA = inVista.order_group.orders.find((o) => o.seller.id === a.azienda).display_id;
  await azienda.getByRole('searchbox', { name: 'Search requests' }).fill(String(numeroA));
  const rigaCoda = azienda.locator('.ord-tabella tbody tr', { hasText: '#' + numeroA }).first();
  await rigaCoda.getByRole('button', { name: 'Confirm' }).waitFor();
  await rigaCoda.getByRole('button', { name: 'Confirm' }).click();
  await rigaCoda.getByRole('button', { name: 'Mark packed' }).waitFor();
  check('Azienda: Confirm dalla coda', true);
  await azienda.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'ordini-azienda.png'), fullPage: true });
  await rigaCoda.getByRole('button', { name: 'Mark packed' }).click();
  await rigaCoda.getByRole('button', { name: 'Mark shipped' }).waitFor();
  await rigaCoda.getByRole('button', { name: 'Mark shipped' }).click();
  const spedizione = azienda.getByRole('dialog', { name: 'Mark shipped' });
  await spedizione.getByLabel('Tracking number').fill(`PROVA-${stamp}`);
  await spedizione.getByRole('button', { name: 'Mark shipped' }).click();
  await rigaCoda.getByRole('button', { name: 'Mark delivered' }).waitFor();
  check('Azienda: prepara e spedisce col tracking', true);
  await azienda.close();

  // Tema chiaro e telefono
  const chiara = await nuovaPagina({ colorScheme: 'light' });
  await chiara.addInitScript(() => localStorage.setItem('ishtar-tema', 'chiaro'));
  await accediAdminBrowser(chiara);
  await chiara.goto(`${CONSOLE}/ordini/tutti`);
  await chiara.locator('.ord-tabella tbody tr').first().waitFor();
  await chiara.waitForTimeout(1500);
  await chiara.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'ordini-chiaro.png'), fullPage: true });
  await chiara.close();

  const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
  await accediAdminBrowser(telefono);
  for (const [rotta, nome] of [['/ordini/tutti', 'elenco'], ['/ordini/bozze', 'bozze'], ['/ordini/resi', 'resi'], ['/evasioni', 'evasioni']]) {
    await telefono.goto(`${CONSOLE}${rotta}`);
    await telefono.locator('.ord').waitFor();
    await telefono.waitForTimeout(2500);
    await telefono.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `ordini-telefono-${nome}.png`) });
    const largo = await telefono.evaluate(() => document.documentElement.scrollWidth);
    check(`Telefono ${nome}: nessuno scorrimento laterale`, largo <= 390, `${largo}`);
  }
  await telefono.close();
  check('Nessun errore nel browser', errori.length === 0, errori.slice(0, 2).join(' | ').slice(0, 300));
  await browser.close();
} catch (errore) {
  check('La prova arriva in fondo', false, errore.message.slice(0, 400));
} finally {
  // Pulizia: prima con le rotte vere, poi si nascondono gli ordini che Medusa non lascia annullare.
  for (const id of gruppi) {
    const { corpo } = await chiama(`/admin/ordini/${id}`, admin);
    for (const r of corpo.ordine?.richieste ?? []) if (r.stato === 'preparata') await chiama(`/admin/evasioni/${r.ordine_id}/${r.azienda_id}/riapri`, admin, { corpo: {} });
    await chiama(`/admin/ordini/${id}/annulla`, admin, { corpo: {} });
  }
  for (const id of ordiniSolti) await chiama(`/admin/ordini/${id}/annulla`, admin, { corpo: {} });
  for (const id of bozze) await chiama(`/admin/draft-orders/${id}`, admin, { metodo: 'DELETE' });
  if (motivoReso) await chiama(`/admin/return-reasons/${motivoReso}`, admin, { metodo: 'DELETE' });
  for (const id of clienti) await chiama(`/admin/customers/${id}`, admin, { metodo: 'DELETE' });
  const { collaboratori: persone = [], inviti = [] } = (await chiama('/admin/team', admin)).corpo;
  for (const { email } of collaboratori) {
    const persona = persone.find((p) => p.email === email)?.id;
    if (persona) await chiama(`/admin/team/${persona}`, admin, { metodo: 'DELETE' });
    const invito = inviti.find((p) => p.email === email)?.id;
    if (invito) await chiama(`/admin/team/inviti/${invito}`, admin, { metodo: 'DELETE' });
  }
  const nascondi = `
    update "return" set deleted_at = now() where deleted_at is null and order_id in (select id from "order" where email like 'prova-ordini-%' or email like 'prova-bozza-%');
    update "order" set deleted_at = now() where deleted_at is null and (email like 'prova-ordini-%' or email like 'prova-bozza-%');
  `;
  const esito = spawnSync('docker', ['exec', '-i', 'multi-outfit-postgres-1', 'sh', '-c', 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], { input: nascondi, encoding: 'utf8' });
  check('Ordini di prova tolti dal database', esito.status === 0, (esito.stderr ?? '').slice(0, 200));
  const rimasti = (await chiama('/admin/ordini?q=prova-ordini', admin)).corpo.conteggio;
  check('Nessun ordine di prova in elenco', rimasti === 0, `${rimasti}`);
}

chiudi('Orders e Fulfilment su un ordine vero');
process.exit();
