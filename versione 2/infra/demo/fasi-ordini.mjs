// Ordini veri dalla Store API con pp_system_default, poi portati allo stato voluto con le rotte normali.
// La data si cambia con SQL solo sugli ordini del registro. Ogni passo fatto resta scritto: si può ripartire.
import { casuale, chiama, deve, elencoSql, giorniFa, racconta, sql } from './comune.mjs';
import { creaClienti } from './dati-clienti.mjs';
import { CORRIERI, NEGOZIO } from './dati-negozio.mjs';
import { BOZZE, pianoOrdini } from './dati-ordini.mjs';
import { PRODOTTI } from './dati-prodotti.mjs';
import { CODICI_NEGLI_ORDINI, MOTIVI_RESO, OUTFIT, TRATTATIVE } from './dati-sezioni.mjs';

export const AZIENDE = ['seller@mercur.dev', 'kickz@mercur.dev', 'trailhead@mercur.dev'];
const PARALLELI = 3;
const FASI_RESO = ['richiesto', 'approvato', 'ricevuto', 'rimborsato'];

/** Offerte dei prodotti riempiti, con prezzo in euro e voce di magazzino: il negozio vende solo queste. */
async function offerteVendibili(admin) {
  const popolarita = new Map(PRODOTTI.map((p) => [p.handle, p.popolarita]));
  const righe = sql(`
    select o.id, s.email, s.id, p.handle
    from offer o
    join product p on p.id = o.product_id
    join seller s on s.id = o.seller_id
    where o.deleted_at is null and p.deleted_at is null and p.status = 'published'
      and s.email in (${elencoSql(AZIENDE)}) and p.handle in (${elencoSql([...popolarita.keys()])})
    order by o.id`);
  const risultato = Object.fromEntries(AZIENDE.map((email) => [email, []]));
  for (const email of AZIENDE) {
    const proprie = righe.filter((riga) => riga[1] === email);
    if (!proprie.length) continue;
    const { offers } = await deve(`/admin/offers?limit=500&seller_id=${proprie[0][2]}`, admin);
    const vendibili = new Set(offers.filter((o) => o.prices?.some((p) => p.currency_code === 'eur') && o.inventory_items?.length).map((o) => o.id));
    risultato[email] = proprie.filter(([id]) => vendibili.has(id)).map(([id, , , handle]) => ({ id, prodotto: handle, peso: popolarita.get(handle) }));
  }
  return risultato;
}

const indirizzoDi = (c) =>
  c
    ? { first_name: c.nome, last_name: c.cognome, company: c.azienda ?? undefined, address_1: c.via, city: c.citta, postal_code: c.cap, country_code: c.paese, phone: c.telefono }
    : { first_name: 'Walk-in', last_name: 'customer', address_1: NEGOZIO.indirizzo.split(',')[0], city: 'Milano', postal_code: '20144', country_code: 'it', phone: NEGOZIO.telefono };

async function negozioPubblico(admin) {
  const { api_keys: chiavi } = await deve('/admin/api-keys?type=publishable&limit=1&fields=id,token', admin);
  const opzioni = { headers: { 'x-publishable-api-key': chiavi[0].token } };
  const { regions } = await deve('/store/regions?limit=1&fields=id', null, opzioni);
  return { opzioni, regione: regions[0].id };
}

/** Un ordine su quattro nasce da un outfit pubblicato: la riga lo dice, per il blocco By outfit di Analytics. */
function outfitDellaRiga(r, voce, riga) {
  if (Number(voce.chiave.slice(-3)) % 4) return undefined;
  const outfit = OUTFIT.find((o) => o.stato === 'pubblicato' && o.capi.includes(riga.prodotto));
  return outfit ? r.outfit[outfit.chiave]?.id : undefined;
}

async function carrello(r, negozio, voce, metadati) {
  const { opzioni, regione } = negozio;
  const indirizzo = indirizzoDi(voce.cliente);
  const { cart } = await deve('/store/carts', null, {
    ...opzioni,
    corpo: { region_id: regione, ...(voce.cliente ? { email: voce.cliente.email } : {}), shipping_address: indirizzo, billing_address: indirizzo, metadata: metadati },
  });
  for (const riga of voce.righe) {
    const outfit = outfitDellaRiga(r, voce, riga);
    await deve(`/store/carts/${cart.id}/line-items`, null, { ...opzioni, corpo: { offer_id: riga.offerta, quantity: riga.quantita, ...(outfit ? { metadata: { outfit_id: outfit } } : {}) } });
  }
  if (voce.codice) await chiama(`/store/carts/${cart.id}/promotions`, null, { ...opzioni, corpo: { promo_codes: [voce.codice] } });
  return cart.id;
}

async function chiudiCarrello(negozio, carrelloId, voce) {
  const { opzioni } = negozio;
  const { shipping_options: perAzienda } = await deve(`/store/shipping-options?cart_id=${carrelloId}`, null, opzioni);
  for (const elenco of Object.values(perAzienda)) {
    const scelta = (voce.espresso && elenco.find((o) => /express|priority/i.test(o.name))) || elenco.find((o) => /standard/i.test(o.name)) || elenco[0];
    await deve(`/store/carts/${carrelloId}/shipping-methods`, null, { ...opzioni, corpo: { option_id: scelta.id } });
  }
  const { payment_collection: incasso } = await deve('/store/payment-collections', null, { ...opzioni, corpo: { cart_id: carrelloId } });
  await deve(`/store/payment-collections/${incasso.id}/payment-sessions`, null, { ...opzioni, corpo: { provider_id: 'pp_system_default' } });
  const esito = await deve(`/store/carts/${carrelloId}/complete`, null, { ...opzioni, corpo: {} });
  if (esito.type !== 'order_group') throw new Error(`checkout ${voce.chiave}: ${JSON.stringify(esito).slice(0, 300)}`);
  return esito.order_group.orders.map((o) => o.id);
}

/** Se il checkout si è interrotto a metà, l'ordine può esistere già: il legame con il carrello lo dice. */
const ordiniDelCarrello = (carrelloId) => sql(`select order_id from order_cart where cart_id = ${elencoSql([carrelloId])}`).map(([id]) => id);

async function scrivi(admin, ordine, metadati) {
  const { order } = await deve(`/admin/orders/${ordine}?fields=id,metadata`, admin);
  await deve(`/admin/orders/${ordine}`, admin, { corpo: { metadata: { ...(order.metadata ?? {}), ...metadati } } });
}

function trackingDi(rng, chiave) {
  return { corriere: rng.scegli(CORRIERI), tracking: `IL${chiave.replace(/\D/g, '')}${rng.intero(100000, 999999)}` };
}

const PASSI = { nuovo: [], non_pagato: [], confermato: ['conferma'], preparato: ['conferma', 'prepara'], spedito: ['conferma', 'prepara', 'spedisci'], consegnato: ['conferma', 'prepara', 'spedisci', 'consegna'], consegnato_senza_incasso: ['conferma', 'prepara', 'spedisci', 'consegna'], annullato: [] };

async function evasione(admin, voce, stato) {
  const { ordine } = await deve(`/admin/ordini/${stato.ordini[0]}`, admin);
  const rng = casuale(Number(voce.chiave.replace(/\D/g, '')) * 7);
  for (const richiesta of ordine.richieste) {
    const chiave = `${richiesta.ordine_id}|${richiesta.azienda_id}`;
    stato.evasi[chiave] ??= [];
    for (const passo of PASSI[voce.stato]) {
      if (stato.evasi[chiave].includes(passo)) continue;
      const corpo = passo === 'spedisci' ? trackingDi(rng, voce.chiave) : {};
      await deve(`/admin/evasioni/${richiesta.ordine_id}/${richiesta.azienda_id}/${passo}`, admin, { corpo });
      stato.evasi[chiave].push(passo);
    }
  }
}

async function reso(admin, r, voce, stato) {
  const { fase, motivo } = voce.reso;
  const { ordine: scheda } = await deve(`/admin/ordini/${stato.ordini[0]}`, admin);
  const righe = scheda.righe.slice(0, 1).map((x) => ({ id: x.id, quantita: 1 }));
  stato.reso ??= {};
  if (!stato.reso.id) {
    const { id } = await deve('/admin/ordini/resi', admin, { corpo: { ordine_id: stato.ordini[0], motivo_id: r.motivi_reso[motivo], nota: 'Customer sent a photo with the request.', righe } });
    stato.reso.id = id;
    stato.reso.passi = [];
  }
  if (fase === 'annullato') {
    if (!stato.reso.passi.includes('annulla')) await deve(`/admin/ordini/resi/${stato.reso.id}/annulla`, admin, { corpo: {} });
    stato.reso.passi.push('annulla');
    return;
  }
  const arrivo = FASI_RESO.indexOf(fase);
  if (arrivo >= 1 && !stato.reso.passi.includes('approva')) {
    await deve(`/admin/ordini/resi/${stato.reso.id}/approva`, admin, { corpo: {} });
    stato.reso.passi.push('approva');
  }
  if (arrivo >= 2 && !stato.reso.passi.includes('ricevi')) {
    await deve(`/admin/ordini/resi/${stato.reso.id}/ricevi`, admin, { corpo: {} });
    stato.reso.passi.push('ricevi');
  }
  if (arrivo >= 3 && !stato.reso.passi.includes('rimborsa')) {
    const { resi } = await deve('/admin/ordini/resi?vista=tutti', admin);
    const riga = resi.find((x) => x.id === stato.reso.id);
    const importo = Math.round(Math.max(riga?.rimborsabile ?? 0, riga?.importo ?? 0) * 100) / 100;
    if (importo > 0) await deve(`/admin/ordini/resi/${stato.reso.id}/rimborsa`, admin, { corpo: { importo: Math.min(importo, riga?.rimborsabile || importo), nota: 'Refunded to the original payment.' } });
    stato.reso.passi.push('rimborsa');
  }
}

async function portaAllo(admin, r, voce, stato, salva) {
  if (!stato.ordini?.length) return;
  if (voce.canale === 'cassa') return;
  if (voce.stato === 'annullato') {
    if (!stato.annullato) await deve(`/admin/ordini/${stato.ordini[0]}/annulla`, admin, { corpo: {} });
    stato.annullato = true;
    salva();
    return;
  }
  if (!['non_pagato', 'consegnato_senza_incasso'].includes(voce.stato) && !stato.pagato) {
    await deve(`/admin/ordini/${stato.ordini[0]}/incassa`, admin, { corpo: {} });
    stato.pagato = true;
    salva();
  }
  stato.evasi ??= {};
  await evasione(admin, voce, stato);
  salva();
  if (voce.nota && !stato.nota) {
    await deve(`/admin/ordini/${stato.ordini[0]}/note`, admin, { corpo: { testo: voce.nota } });
    stato.nota = true;
    salva();
  }
  if (voce.reso) {
    await reso(admin, r, voce, stato);
    salva();
  }
}

/** Crea i motivi di reso una volta sola: chiave `value`, così una ripartenza li ritrova. */
async function motiviReso({ r, admin, salva }) {
  const { return_reasons: presenti = [] } = await deve('/admin/return-reasons?limit=100&fields=id,value', admin);
  for (const m of MOTIVI_RESO) {
    r.motivi_reso[m.value] ??= presenti.find((p) => p.value === m.value)?.id ?? (await deve('/admin/return-reasons', admin, { corpo: m })).return_reason.id;
    salva();
  }
}

export function applicaDate(r) {
  const coppie = Object.values(r.ordini).flatMap((s) => (s.ordini ?? []).map((id) => [id, s.quando]));
  const bozze = Object.values(r.bozze).filter((b) => b.id).map((b) => [b.id, b.quando]);
  const voci = [...coppie, ...bozze].filter(([, quando]) => quando);
  if (!voci.length) return;
  const valori = voci.map(([id, quando]) => `(${elencoSql([id])}, ${elencoSql([quando])}::timestamptz)`).join(',\n');
  sql(`update "order" o set created_at = v.quando from (values ${valori}) as v(id, quando) where o.id = v.id;`);
  racconta(`date: ${voci.length} ordini distribuiti nel tempo`);
}

/** Gli ordini all'ingrosso nascono da una trattativa chiusa: `canaleDi` riconosce il canale da questo legame. */
function trattativaDi(r, voce) {
  const chiuse = TRATTATIVE.filter((t) => ['accordo', 'spedito'].includes(t.fase)).map((t) => r.trattative[t.chiave]?.id).filter(Boolean);
  return chiuse[Number(voce.chiave.slice(-3)) % chiuse.length];
}

const metodoDi = (voce) => (Number(voce.chiave.slice(-1)) % 3 ? 'carta' : 'contanti');

let filaCassa = Promise.resolve();

/**
 * La cassa ha la sua rotta: gli ordini con canale `cassa` non passano dall'evasione, quindi dal carrello
 * resterebbero «da preparare» per sempre. Una vendita alla volta: la rotta tiene un lucchetto breve.
 */
function venditaInCassa(r, admin, voce) {
  const lavoro = filaCassa.then(async () => {
    const parametri = voce.righe.map((x) => `riga=${x.offerta}:${x.quantita}`).join('&');
    const { totale } = await deve(`/admin/cassa/anteprima?${parametri}`, admin);
    const metodo = metodoDi(voce);
    const { vendita } = await deve('/admin/cassa/vendite', admin, {
      corpo: {
        righe: voce.righe.map((x) => ({ offerta_id: x.offerta, quantita: x.quantita })),
        cliente_id: voce.cliente ? r.clienti[voce.cliente.email]?.id : null,
        metodo,
        ...(metodo === 'contanti' ? { ricevuto: Math.ceil(totale / 10) * 10 } : {}),
        totale_atteso: totale,
      },
    });
    await scrivi(admin, vendita.id, { demo: true, demo_chiave: voce.chiave });
    return [vendita.id];
  });
  filaCassa = lavoro.catch(() => undefined);
  return lavoro;
}

async function ordineDalCarrello(c, negozio, voce, stato) {
  const { r, admin, salva } = c;
  if (stato.carrello) stato.ordini = ordiniDelCarrello(stato.carrello);
  if (stato.ordini?.length) return;
  const metadati = { demo: true, demo_chiave: voce.chiave, canale: voce.canale, ...(voce.canale === 'ingrosso' ? { ingrosso_trattativa_id: trattativaDi(r, voce) } : {}) };
  stato.carrello = await carrello(r, negozio, voce, metadati);
  salva();
  stato.ordini = await chiudiCarrello(negozio, stato.carrello, voce);
  salva();
  const { order } = await deve(`/admin/orders/${stato.ordini[0]}?fields=id,metadata`, admin);
  if (!order.metadata?.demo) for (const id of stato.ordini) await scrivi(admin, id, metadati);
}

async function unOrdine(c, negozio, voce) {
  const { r, admin, salva } = c;
  const stato = (r.ordini[voce.chiave] ??= { quando: voce.quando, stato_voluto: voce.stato });
  const partenza = Date.now();
  if (!stato.ordini?.length) {
    if (voce.canale === 'cassa') {
      stato.ordini = await venditaInCassa(r, admin, voce);
      salva();
    } else {
      await ordineDalCarrello(c, negozio, voce, stato);
    }
  }
  const creato = Date.now();
  await portaAllo(admin, r, voce, stato, salva);
  stato.finito = true;
  salva();
  racconta(`${voce.chiave} ${voce.canale} ${voce.stato}${voce.reso ? ` reso:${voce.reso.fase}` : ''} (${Math.round((creato - partenza) / 1000)}+${Math.round((Date.now() - creato) / 1000)} s)`);
}

/** Tre ordini alla volta: i numeri restano in ordine di data, a meno di pochi posti. */
export async function ordini(c, { limite = Infinity } = {}) {
  const { r, admin, salva, ancora } = c;
  await motiviReso(c);
  if (!r.piano_ordini) {
    const offerte = await offerteVendibili(admin);
    for (const email of AZIENDE) racconta(`offerte vendibili ${email}: ${offerte[email].length}`);
    r.piano_ordini = pianoOrdini({ ancora, offerte, clienti: creaClienti(), codici: CODICI_NEGLI_ORDINI });
    salva();
  }
  const negozio = await negozioPubblico(admin);
  const coda = r.piano_ordini.filter((v) => !r.ordini[v.chiave]?.finito).slice(0, limite);
  const errori = [];
  await Promise.all(
    Array.from({ length: PARALLELI }, async () => {
      while (coda.length) {
        const voce = coda.shift();
        try {
          await unOrdine(c, negozio, voce);
        } catch (errore) {
          errori.push(voce.chiave);
          racconta(`${voce.chiave}: ${errore.message}`);
        }
      }
    })
  );
  applicaDate(r);
  const finiti = Object.values(r.ordini).filter((s) => s.finito).length;
  racconta(`ordini: ${finiti} di ${r.piano_ordini.length}`);
  if (errori.length) throw new Error(`Da riprendere: ${errori.join(', ')}`);
}

export async function bozze({ r, admin, salva, ancora }) {
  const { offerte, consegne } = await deve('/admin/ordini/bozze/opzioni', admin);
  const scelte = offerte.filter((o) => o.miniatura?.includes('cdn.jsdelivr.net') && o.prezzo);
  const clienti = creaClienti();
  for (const [indice, b] of BOZZE.entries()) {
    if (r.bozze[b.chiave]?.id) continue;
    const cliente = clienti.find((c) => c.email === b.cliente);
    const dati = r.clienti[b.cliente];
    if (!cliente || !dati) continue;
    const prima = (indice * 37) % Math.max(scelte.length - b.righe, 1);
    const { id } = await deve('/admin/ordini/bozze', admin, {
      corpo: {
        cliente_id: dati.id,
        email: b.cliente,
        indirizzo: { nome: `${cliente.nome} ${cliente.cognome}`, via: cliente.via, citta: cliente.citta, cap: cliente.cap, paese: cliente.paese, telefono: cliente.telefono },
        nota: b.nota,
        ...(consegne[0] ? { consegna: consegne[0] } : {}),
        righe: scelte.slice(prima, prima + b.righe).map((o) => ({ offerta_id: o.id, quantita: b.quantita })),
      },
    });
    r.bozze[b.chiave] = { id, quando: giorniFa(ancora, b.eta).toISOString() };
    salva();
  }
  applicaDate(r);
  racconta(`bozze: ${Object.keys(r.bozze).length}`);
}
