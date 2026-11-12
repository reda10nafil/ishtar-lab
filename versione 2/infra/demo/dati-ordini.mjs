// Piano dei 120 ordini: quando, chi, dove e a che punto devono arrivare. Solo calcoli, nessuna chiamata.
// Si calcola una volta e resta nel registro: a ogni ripartenza il piano è lo stesso.
import { casuale, GIORNO } from './comune.mjs';

const FUSO = 'Europe/Rome';

/** [giorni fa da, a, quanti]: più ordini di recente, così Overview e Analytics hanno sempre qualcosa. */
const FASCE = [
  [0, 0, 3],
  [1, 6, 15],
  [7, 13, 10],
  [14, 29, 14],
  [30, 59, 16],
  [60, 119, 20],
  [120, 209, 24],
  [210, 364, 18],
];

const SEQUENZA_CANALI = ['online', 'online', 'cassa', 'online', 'ingrosso', 'online', 'online', 'cassa', 'online', 'online', 'cassa', 'online', 'online', 'ingrosso'];

const NOTE_ORDINE = ['Gift: please leave out the receipt.', 'Customer asked for delivery after 17:00.', 'Leave with the neighbour at number 12 if nobody answers.', 'Second pair for a friend, wrap separately.'];

/** Un reso per ogni punto del flusso: gli aperti negli ordini recenti, i chiusi in quelli vecchi. */
const RESI = [
  { fase: 'richiesto', motivo: 'demo-too-small' },
  { fase: 'richiesto', motivo: 'demo-changed-mind' },
  { fase: 'approvato', motivo: 'demo-too-big' },
  { fase: 'ricevuto', motivo: 'demo-arrived-damaged' },
  { fase: 'rimborsato', motivo: 'demo-too-small' },
  { fase: 'rimborsato', motivo: 'demo-changed-mind' },
  { fase: 'rimborsato', motivo: 'demo-too-big' },
  { fase: 'annullato', motivo: 'demo-changed-mind' },
];

function statoPerEta(eta, rng) {
  if (eta < 3) return rng.pesato([['nuovo', 3], ['confermato', 2], ['non_pagato', 2]]);
  if (eta < 6) return rng.pesato([['nuovo', 2], ['confermato', 1], ['preparato', 3], ['non_pagato', 1]]);
  if (eta < 9) return rng.pesato([['preparato', 2], ['spedito', 3]]);
  if (eta < 15) return rng.pesato([['spedito', 3], ['consegnato', 2]]);
  return 'consegnato';
}

const partiAlFuso = (data) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(data).map((p) => [p.type, Number(p.value)]));

function scartoDelFuso(data) {
  const qui = new Date(data.toLocaleString('en-US', { timeZone: FUSO }));
  const zero = new Date(data.toLocaleString('en-US', { timeZone: 'UTC' }));
  return qui.getTime() - zero.getTime();
}

function istanteLocale(data, ore, minuti) {
  const { year, month, day } = partiAlFuso(data);
  const grezzo = Date.UTC(year, month - 1, day, ore, minuti);
  return new Date(grezzo - scartoDelFuso(new Date(grezzo)));
}

/** `offerte` è { emailAzienda: [{ id, prodotto, peso }] }; `clienti` viene da `creaClienti()`. */
export function pianoOrdini({ ancora, offerte, clienti, codici }) {
  const rng = casuale(1793);
  const aziende = Object.keys(offerte);
  const privati = clienti.filter((c) => !c.rivenditore);
  const trade = clienti.filter((c) => c.rivenditore);
  const giaVisti = [];

  const pescaRighe = (azienda, quante, quantita) => {
    const scelte = new Map();
    for (let tiri = 0; scelte.size < quante && tiri < 40; tiri += 1) {
      const offerta = rng.pesato(offerte[azienda].map((o) => [o, o.peso]));
      if (![...scelte.values()].some((r) => r.prodotto === offerta.prodotto)) scelte.set(offerta.id, { offerta: offerta.id, prodotto: offerta.prodotto, azienda, quantita: quantita() });
    }
    return [...scelte.values()];
  };

  const scegliCliente = (canale) => {
    if (canale === 'ingrosso') return rng.scegli(trade);
    if (canale === 'cassa') return rng.prossimo() < 0.45 ? rng.scegli(privati) : null;
    return giaVisti.length > 6 && rng.prossimo() < 0.38 ? rng.scegli(giaVisti) : rng.scegli(privati);
  };

  const righePer = (canale, azienda) => {
    if (canale === 'ingrosso') return pescaRighe(azienda, rng.intero(2, 3), () => rng.intero(4, 12));
    if (canale === 'cassa') return pescaRighe(azienda, rng.intero(1, 2), () => 1);
    const righe = pescaRighe(azienda, rng.intero(1, 2), () => rng.pesato([[1, 5], [2, 1]]));
    return rng.prossimo() < 0.14 ? [...righe, ...pescaRighe(aziende.find((a) => a !== azienda), 1, () => 1)] : righe;
  };

  const momento = (eta) => {
    const ore = rng.pesato([[9, 1], [11, 2], [13, 2], [16, 2], [18, 3], [20, 4], [21, 4], [22, 2]]);
    const quando = istanteLocale(new Date(ancora.getTime() - eta * GIORNO), ore, rng.intero(0, 59));
    return quando > ancora ? new Date(ancora.getTime() - rng.intero(20, 110) * 60_000) : quando;
  };

  const date = FASCE.flatMap(([da, a, quanti]) => Array.from({ length: quanti }, () => momento(rng.intero(da, a))));
  const piano = date
    .sort((x, y) => x.getTime() - y.getTime())
    .map((quando, indice) => {
      const eta = (ancora.getTime() - quando.getTime()) / GIORNO;
      const canale = SEQUENZA_CANALI[indice % SEQUENZA_CANALI.length];
      const cliente = scegliCliente(canale);
      if (cliente && !cliente.rivenditore) giaVisti.push(cliente);
      const righe = righePer(canale, rng.scegli(aziende));
      const voce = {
        chiave: `ord-${String(indice + 1).padStart(3, '0')}`,
        quando: quando.toISOString(),
        eta: Math.floor(eta),
        canale,
        righe,
        aziende: [...new Set(righe.map((r) => r.azienda))],
        cliente,
        espresso: rng.prossimo() < 0.22,
        codice: canale === 'online' && rng.prossimo() < 0.16 ? rng.scegli(codici) : null,
        nota: rng.prossimo() < 0.09 ? rng.scegli(NOTE_ORDINE) : null,
        stato: canale === 'cassa' ? 'consegnato' : statoPerEta(eta, rng),
        reso: null,
      };
      if (canale === 'ingrosso' && eta > 14 && rng.prossimo() < 0.3) voce.stato = 'consegnato_senza_incasso';
      return voce;
    });

  // Annullati sparsi, mai negli ultimi due giorni: la coda di oggi resta piena.
  piano.filter((v) => v.eta > 2 && v.canale !== 'cassa').filter((_, i) => i % 23 === 11).forEach((v) => (v.stato = 'annullato'));

  const candidati = piano.filter((v) => v.canale === 'online' && v.stato === 'consegnato' && v.aziende.length === 1 && v.eta <= 150);
  const recenti = candidati.filter((v) => v.eta <= 45).reverse();
  const vecchi = candidati.filter((v) => v.eta > 45);
  for (const reso of RESI) {
    const fonte = ['richiesto', 'approvato', 'ricevuto'].includes(reso.fase) ? recenti : vecchi;
    const voce = fonte.shift() ?? recenti.shift() ?? vecchi.shift();
    if (voce) voce.reso = reso;
  }
  return piano;
}

/** Bozze: restano in Drafts, senza pagamento. */
export const BOZZE = [
  { chiave: 'boz-1', eta: 1, cliente: 'buying@bottegalumen.example.test', nota: 'Quote for the spring window, waiting for sizes.', righe: 3, quantita: 6 },
  { chiave: 'boz-2', eta: 3, cliente: 'chiara.fontana@example.test', nota: 'Phone order, confirm the colour before charging.', righe: 1, quantita: 1 },
  { chiave: 'boz-3', eta: 5, cliente: 'hugo.lefevre@example.test', nota: 'Replacement pair after a damaged parcel.', righe: 1, quantita: 1 },
  { chiave: 'boz-4', eta: 9, cliente: 'greta@nordsand.example.test', nota: 'Top-up for the Copenhagen shop.', righe: 2, quantita: 8 },
  { chiave: 'boz-5', eta: 12, cliente: 'imogen.clarke@example.test', nota: 'Styling loan for a shoot, keep as draft until returned.', righe: 2, quantita: 1 },
  { chiave: 'boz-6', eta: 16, cliente: 'marta.delgado@example.test', nota: 'Waiting for the customer to pick a size.', righe: 1, quantita: 1 },
];
