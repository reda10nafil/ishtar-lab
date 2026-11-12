// Dati delle sezioni: sconti, carte regalo, rivenditori, trattative, proposte, outfit, assistenza e campagne.
// Le date sono scritte in giorni da oggi: `popola-demo.mjs` le converte al momento di creare.

export const SCONTI = [
  { codice: 'FIRSTLOOK10', descrizione: 'First order, from the sign-up banner', tipo: 'percentuale', valore: 10 },
  { codice: 'INSIDER15', descrizione: 'Newsletter Insiders, autumn lookbook', tipo: 'percentuale', valore: 15, limite_usi: 300, inizio: -20, fine: 24 },
  { codice: 'STUDIO25', descrizione: '25 EUR off baskets from the studio sale flyer', tipo: 'importo', valore: 25 },
  { codice: 'SHIPITFREE', descrizione: 'Free delivery for the VIP Circle', tipo: 'spedizione' },
  { codice: 'PAIRUP20', descrizione: 'Two pairs, one basket: spring promotion', tipo: 'percentuale', valore: 20, inizio: -170, fine: -130 },
  { codice: 'RIVIERA30', descrizione: 'End of summer, last sizes only', tipo: 'percentuale', valore: 30, limite_usi: 80, inizio: -75, fine: -44 },
  { codice: 'BLACKWEEK25', descrizione: 'Black Week early access', tipo: 'percentuale', valore: 25, limite_usi: 500, inizio: 16, fine: 24 },
  { codice: 'WINTERPREVIEW', descrizione: 'Winter capsule preview for stockists', tipo: 'importo', valore: 40, inizio: 30, fine: 60 },
  { codice: 'FRIENDS18', descrizione: 'Friends of the Studio, on hold until the next drop', tipo: 'percentuale', valore: 18, attivo: false },
  { codice: 'SAMPLESALE35', descrizione: 'Sample sale at the Milano studio, paused', tipo: 'percentuale', valore: 35, attivo: false, inizio: -12, fine: 40 },
];

export const CODICI_NEGLI_ORDINI = ['FIRSTLOOK10', 'INSIDER15', 'STUDIO25'];

export const MOTIVI_RESO = [
  { value: 'demo-too-small', label: 'Too small' },
  { value: 'demo-too-big', label: 'Too big' },
  { value: 'demo-changed-mind', label: 'Changed their mind' },
  { value: 'demo-arrived-damaged', label: 'Arrived damaged' },
];

/** `azioni` si applica dopo l'emissione: importo negativo = speso, `gelata`, `annullata`. */
export const CARTE = [
  { chiave: 'c01', importo: 100, nome: 'Giulia Marchetti', email: 'giulia.marchetti@example.test', nota: 'Birthday present from her sister', scadenza: 340 },
  { chiave: 'c02', importo: 150, nome: 'Camille Durand', email: 'camille.durand@example.test', nota: null, scadenza: 300, spesa: [[-64, 'Redeemed in the online shop']] },
  { chiave: 'c03', importo: 75, nome: 'Jonas Keller', email: 'jonas.keller@example.test', nota: 'Staff thank-you', scadenza: 200, spesa: [[-75, 'Redeemed at the shop till']] },
  { chiave: 'c04', importo: 200, nome: 'Imogen Clarke', email: 'imogen.clarke@example.test', nota: 'Wedding list', scadenza: 330, spesa: [[-82.5, 'Redeemed in the online shop'], [-49, 'Redeemed at the shop till']] },
  { chiave: 'c05', importo: 50, nome: null, email: null, nota: 'Unassigned, issued for the Milano pop-up raffle', scadenza: 120 },
  { chiave: 'c06', importo: 120, nome: 'Paula Iglesias', email: 'paula.iglesias@example.test', nota: 'Goodwill after a delayed parcel', scadenza: 180, spesa: [[-35, 'Redeemed in the online shop']] },
  { chiave: 'c07', importo: 60, nome: 'Oskar Berg', email: 'oskar.berg@example.test', nota: 'Customer asked to pause it while travelling', scadenza: 260, gelata: true },
  { chiave: 'c08', importo: 250, nome: 'Freja Nielsen', email: 'freja.nielsen@example.test', nota: null, scadenza: 350, spesa: [[-250, 'Redeemed in the online shop']] },
  { chiave: 'c09', importo: 40, nome: 'Alessio Bruno', email: 'alessio.bruno@example.test', nota: 'Issued twice by mistake', annullata: 'Duplicate of an earlier card' },
  { chiave: 'c10', importo: 90, nome: 'Lena Hoffmann', email: 'lena.hoffmann@example.test', nota: 'Referral reward', scadenza: 150 },
];

export const RIVENDITORI = [
  { chiave: 'lumen', nome: 'Bottega Lumen', referente: 'Noemi Sartori', email: 'buying@bottegalumen.example.test', telefono: '+39 051 555 0118', partita_iva: 'IT09990002345', indirizzo: 'Via Saragozza 41', citta: 'Bologna', cap: '40125', paese: 'it', condizione: 'sconto', sconto_percentuale: 40, pagamento: 'Net 30', ordine_minimo: 600, appunti: 'Prefers Tuesday deliveries, two windows on the street.' },
  { chiave: 'verbena', nome: 'Casa Verbena', referente: 'Elio Bassani', email: 'orders@casaverbena.example.test', telefono: '+39 011 555 0143', partita_iva: 'IT09990003456', indirizzo: 'Via della Consolata 9', citta: 'Torino', cap: '10122', paese: 'it', condizione: 'listino', listino: 'Trade 2026', pagamento: 'Net 30', ordine_minimo: 450, appunti: 'Family shop, reorders little and often.' },
  { chiave: 'solene', nome: 'Atelier Solène', referente: 'Solène Arnaud', email: 'solene@ateliersolene.example.test', telefono: '+33 5 55 50 1420', partita_iva: 'FR90000123456', indirizzo: 'Rue Sainte-Colombe 14', citta: 'Bordeaux', cap: '33000', paese: 'fr', condizione: 'sconto', sconto_percentuale: 38, pagamento: 'Net 14', ordine_minimo: 500, appunti: null },
  { chiave: 'alize', nome: 'Maison Alizé', referente: 'Margaux Vidal', email: 'achats@maisonalize.example.test', telefono: '+33 4 55 50 1877', partita_iva: 'FR90000234567', indirizzo: 'Rue Burdeau 22', citta: 'Lyon', cap: '69001', paese: 'fr', condizione: 'listino', listino: 'Trade 2026', pagamento: 'Prepaid', ordine_minimo: 300, appunti: 'Wants a shared lookbook for each season.' },
  { chiave: 'nord', nome: 'Nord & Sand', referente: 'Greta Paulsen', email: 'greta@nordsand.example.test', telefono: '+45 55 50 1136', partita_iva: 'DK90001234', indirizzo: 'Gammel Mønt 7', citta: 'København', cap: '1160', paese: 'dk', condizione: 'sconto', sconto_percentuale: 42, pagamento: 'Net 30', ordine_minimo: 800, appunti: 'Largest Nordic account. Pays on time.' },
  { chiave: 'kiosk', nome: 'Fräulein Kiosk', referente: 'Katrin Weber', email: 'einkauf@fraeuleinkiosk.example.test', telefono: '+49 40 5550 1294', partita_iva: 'DE900012345', indirizzo: 'Schanzenstraße 31', citta: 'Hamburg', cap: '20357', paese: 'de', condizione: 'sconto', sconto_percentuale: 35, pagamento: 'Net 14', ordine_minimo: 350, appunti: 'Small space, only takes two styles at a time.' },
  { chiave: 'mayor', nome: 'Calle Mayor 12', referente: 'Rocío Campos', email: 'rocio@callemayor12.example.test', telefono: '+34 955 50 1362', partita_iva: 'ES900012345', indirizzo: 'Calle Mayor 12', citta: 'Sevilla', cap: '41003', paese: 'es', condizione: 'listino', listino: 'Trade 2026', pagamento: 'Net 30', ordine_minimo: 400, appunti: null },
  { chiave: 'linnea', nome: 'Linnea Butik', referente: 'Astrid Falk', email: 'astrid@linneabutik.example.test', telefono: '+46 31 555 0172', partita_iva: 'SE900012345601', indirizzo: 'Haga Nygata 18', citta: 'Göteborg', cap: '41128', paese: 'se', condizione: 'sconto', sconto_percentuale: 40, pagamento: 'Prepaid', ordine_minimo: 500, appunti: 'Opening a second shop in Malmö next spring.' },
];

export const TRATTATIVE = [
  { chiave: 'd01', titolo: 'Spring window order', rivenditore: 'nord', unita: 64, valore_stimato: 3360, fase: 'richiesta', note: ['Greta asked for the Riviera Days line sheet.'] },
  { chiave: 'd02', titolo: 'Second shop opening in Malmö', rivenditore: 'linnea', unita: 90, valore_stimato: 4250, fase: 'richiesta', note: ['Opening planned for March, wants a full size run.'] },
  { chiave: 'd03', titolo: 'First order, City Walk styles', rivenditore: 'alize', unita: 36, valore_stimato: 2180, fase: 'richiesta', note: [] },
  { chiave: 'd04', titolo: 'Sample pairs for the buying team', rivenditore: 'kiosk', unita: 12, valore_stimato: 540, fase: 'campione', note: ['Samples left the studio on Monday.', 'Katrin wants to try the gum sole first.'] },
  { chiave: 'd05', titolo: 'Clog capsule for the winter window', rivenditore: 'verbena', unita: 40, valore_stimato: 1960, fase: 'campione', note: ['Sent two sizes of each clog.'] },
  { chiave: 'd06', titolo: 'Pool Club summer top-up', rivenditore: 'mayor', unita: 48, valore_stimato: 1720, fase: 'campione', note: [] },
  { chiave: 'd07', titolo: 'Autumn restock', rivenditore: 'lumen', unita: 54, valore_stimato: 2640, fase: 'accordo', note: ['Agreed 40% off list, payment in 30 days.'] },
  { chiave: 'd08', titolo: 'Golden Hour display', rivenditore: 'solene', unita: 30, valore_stimato: 1290, fase: 'accordo', note: [] },
  { chiave: 'd09', titolo: 'Nordic autumn drop', rivenditore: 'nord', unita: 72, valore_stimato: 3890, fase: 'accordo', note: ['Split delivery across two weeks.'] },
  { chiave: 'd10', titolo: 'September restock', rivenditore: 'verbena', unita: 28, valore_stimato: 1320, fase: 'spedito', note: ['Parcel signed for on Friday.'] },
  { chiave: 'd11', titolo: 'Summer essentials', rivenditore: 'kiosk', unita: 24, valore_stimato: 980, fase: 'spedito', note: [] },
  { chiave: 'd12', titolo: 'Festival weekend pop-up', rivenditore: 'mayor', unita: 44, valore_stimato: 1780, fase: 'spedito', note: ['Sold through in nine days.'] },
];

export const PROPOSTE = [
  { chiave: 'p01', azienda: 'seller@mercur.dev', titolo: 'Clearance on last season slides', tipo: 'percentuale', valore: 20, inizio: 2, fine: 21, motivo: 'We need the warehouse space before the winter stock lands.' },
  { chiave: 'p02', azienda: 'kickz@mercur.dev', titolo: 'Weekend offer on runners', tipo: 'percentuale', valore: 15, inizio: 5, fine: 8, motivo: 'A short push before the next delivery of the same style.' },
  { chiave: 'p03', azienda: 'trailhead@mercur.dev', titolo: 'Ten euros off any clog', tipo: 'importo', valore: 10, inizio: 3, fine: 30, motivo: 'Clogs are selling slower than planned this autumn.' },
  { chiave: 'p04', azienda: 'seller@mercur.dev', titolo: 'Autumn welcome offer', tipo: 'percentuale', valore: 12, inizio: -2, fine: 30, motivo: 'To support the new autumn colours in the catalogue.', esito: 'approva', codice: 'SOLEAUTUMN12', nota: 'Approved for one month.' },
  { chiave: 'p05', azienda: 'kickz@mercur.dev', titolo: 'Half price on everything', tipo: 'percentuale', valore: 50, inizio: 1, fine: 10, motivo: 'We would like to clear the whole range quickly.', esito: 'rifiuta', nota: 'Too deep for the whole range. Please propose a smaller selection.' },
  { chiave: 'p06', azienda: 'trailhead@mercur.dev', titolo: 'Five euros off walking styles', tipo: 'importo', valore: 5, inizio: 1, fine: 25, motivo: 'A small thank-you for repeat buyers of our walking styles.', esito: 'approva', codice: 'TRAILFIVE', nota: null },
];

/** Prezzi proposti dalle aziende su prodotti online: restano in attesa di decisione. */
export const PROPOSTE_PREZZI = [
  { azienda: 'seller@mercur.dev', fattore: 1.06 },
  { azienda: 'kickz@mercur.dev', fattore: 1.04 },
];

export const OUTFIT = [
  { chiave: 'o1', nome: 'Long Lunch on the Coast', descrizione: 'Buckled sandals and an easy slide for a day that starts at the market and ends by the water.', capi: ['meridian-twin-strap-buckle-sandal', 'cloudpeak-golden-slide'], stato: 'pubblicato', modalita: 'somma' },
  { chiave: 'o2', nome: 'City Commute', descrizione: 'A runner for the morning, a high top for after work.', capi: ['vantage-204-runner', 'cityline-canvas-high-top'], stato: 'pubblicato', modalita: 'fisso', sconto: 0.9 },
  { chiave: 'o3', nome: 'Studio Floor', descrizione: 'Two clogs for long days on your feet.', capi: ['meridian-clog-slide', 'meridian-wire-buckle-clog'], stato: 'pubblicato', modalita: 'somma' },
  { chiave: 'o4', nome: 'Pool Bag Pair', descrizione: 'Two light pairs that take up no room in the bag.', capi: ['apex-pool-slides', 'nimbus-classic-clog'], stato: 'pubblicato', modalita: 'fisso', sconto: 0.85 },
  { chiave: 'o5', nome: 'Golden Evening', descrizione: 'Draft for the next lookbook: soft metallics for dinner outdoors.', capi: ['cloudpeak-golden-sandal', 'cloudpeak-starlet-sandal'], stato: 'bozza', modalita: 'somma' },
  { chiave: 'o6', nome: 'Spring Errands', descrizione: 'Retired after the spring campaign.', capi: ['strive-mule-slides', 'meridian-twin-strap-sandal'], stato: 'archiviato', modalita: 'somma' },
];

export const RICHIESTE = [
  { chiave: 'r1', azienda: 'seller@mercur.dev', oggetto: 'Change of pick-up time for parcels', categoria: 'spedizioni', testo: 'Our courier now collects at 11:00 instead of 15:00. Can this be updated on the order cut-off?', risposte: ['Thanks for telling us. We have noted the new time and will update the cut-off this week.'], stato: 'in_attesa' },
  { chiave: 'r2', azienda: 'kickz@mercur.dev', oggetto: 'Order shows packed but the label failed', categoria: 'ordini', testo: 'We packed an order this morning but the shipping label did not print. Could you check it?', risposte: ['We can see the parcel. Please try again now, the label should come through.', 'It worked, thank you.'], stato: 'chiusa' },
  { chiave: 'r3', azienda: 'trailhead@mercur.dev', oggetto: 'New colourway for the winter range', categoria: 'prodotti', testo: 'We are adding a forest green to the walking range. Do you need samples before we list it?', risposte: [], stato: 'aperta' },
  { chiave: 'r4', azienda: 'seller@mercur.dev', oggetto: 'Stock count does not match after return', categoria: 'magazzino', testo: 'A returned pair went back on the shelf but the stock count stayed the same. Is there a delay?', risposte: ['There is no delay on our side. Could you send the return number?'], stato: 'in_attesa' },
  { chiave: 'r5', azienda: 'kickz@mercur.dev', oggetto: 'Adding a second person to our account', categoria: 'altro', testo: 'Our new warehouse manager needs to see orders. How do we add her?', risposte: ['You can invite her from Settings, under Team. Let us know if the invite does not arrive.'], stato: 'chiusa' },
  { chiave: 'r6', azienda: 'trailhead@mercur.dev', oggetto: 'Parcel lost in transit to Sevilla', categoria: 'spedizioni', testo: 'The tracking stopped five days ago. Can we open a claim and send a replacement?', risposte: [], stato: 'aperta' },
  { chiave: 'r7', azienda: 'seller@mercur.dev', oggetto: 'Question about supply price review', categoria: 'prodotti', testo: 'We sent new supply prices last week. When can we expect a decision?', risposte: ['They are in the review queue, you should hear back by Friday.'], stato: 'in_attesa' },
  { chiave: 'r8', azienda: null, oggetto: 'Photo guidelines for the winter catalogue', categoria: 'altro', testo: 'Reminder for the team: share the new photo guidelines with all companies before the winter upload.', risposte: [], stato: 'aperta' },
];

/** Campagne vere: si possono inviare, modificare ed eliminare. Nessuna parte da qui: restano bozza o programmata. */
export const CAMPAGNE = [
  { chiave: 'k1', nome: 'Black Week early access', oggetto: 'Your early access starts now', testo: 'Subscribers shop Black Week a full day before everyone else.\n\nUse your code at checkout.', pubblico: 'tutti', stato: 'programmata', tra_giorni: 15 },
  { chiave: 'k2', nome: 'Winter capsule teaser', oggetto: 'Something warm is on its way', testo: 'We are putting the last touches on the winter capsule.\n\nMore soon.', pubblico: 'tutti', stato: 'bozza' },
];

/** Campagne solo dimostrative, in `store.metadata.demo.campagne`: nessuna email parte davvero. */
export const CAMPAGNE_DIMOSTRATIVE = [
  { nome: 'Back in stock: Studio Clogs', canale: 'email', oggetto: 'The clogs you missed are back', stato: 'in_invio', giorni_fa: 1, destinatari: 1320, inviati: 860, aperture: 0.38, clic: 0.124 },
  { nome: 'The making of a clog', canale: 'instagram', oggetto: 'From cork to finished pair', stato: 'inviata', giorni_fa: 6, destinatari: 12400, inviati: 12400, aperture: 0.46, clic: 0.031, incasso: 940, ordini: 17 },
  { nome: 'Autumn lookbook', canale: 'email', oggetto: 'Warm tones for the first cold mornings', stato: 'inviata', giorni_fa: 17, destinatari: 5240, inviati: 5240, aperture: 0.47, clic: 0.126, incasso: 3120, ordini: 41 },
  { nome: 'New in: City Walk', canale: 'email', oggetto: 'Shoes that handle a full day on foot', stato: 'inviata', giorni_fa: 58, destinatari: 4960, inviati: 4960, aperture: 0.44, clic: 0.109, incasso: 2240, ordini: 29 },
  { nome: 'Last sizes of summer', canale: 'email', oggetto: 'A final call for the Riviera pairs', stato: 'inviata', giorni_fa: 84, destinatari: 4710, inviati: 4710, aperture: 0.52, clic: 0.148, incasso: 4260, ordini: 63 },
];

export const SPUNTO = {
  titolo: 'The Autumn lookbook email brought in 3,120 EUR',
  testo: 'Orders climbed in the two days after it landed. A Black Week teaser before the weekend would land in the same window.',
};

export const AUTOMAZIONI = {
  benvenuto: { oggetto: 'Welcome to Ishtar Lab', testo: 'Thanks for joining us.\n\nHere is a small welcome: use FIRSTLOOK10 for 10% off your first order.', attiva: true, inviate: 214, incasso: 1780 },
  carrello: { oggetto: 'You left something behind', testo: 'Your basket is still waiting for you.\n\nCome back whenever you are ready, we have kept it just as you left it.' },
  riacquisto: { oggetto: 'Ready for a new pair?', testo: 'It has been a while since your last order.\n\nHere is what is new in the studio.' },
  recensione: { oggetto: 'How are the new shoes?', testo: 'We would love to know how your order is wearing in.\n\nA short review helps other customers choose their size.' },
};

/** Viste e vendite degli outfit non hanno una fonte: stanno in `store.metadata.demo.outfit`, per nome. */
export const RISULTATI_OUTFIT = {
  'Long Lunch on the Coast': { viste: 3180, vendite: 46, incasso: 8740, capi_sostituiti: 4 },
  'City Commute': { viste: 2640, vendite: 38, incasso: 7980, capi_sostituiti: 2 },
  'Studio Floor': { viste: 1820, vendite: 21, incasso: 4410, capi_sostituiti: 3 },
  'Pool Bag Pair': { viste: 1490, vendite: 27, incasso: 2970, capi_sostituiti: 1 },
  'Spring Errands': { viste: 980, vendite: 12, incasso: 2040, capi_sostituiti: 0 },
};
