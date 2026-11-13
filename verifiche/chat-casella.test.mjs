// Aiuti puri della pagina Chats (frontend/ishtar-lab/chat/casella.mjs): orari, nomi, importi, elenco, stato delle risposte.
process.env.TZ = 'Europe/Rome';
const {test} = await import('node:test');
const {default: assert} = await import('node:assert/strict');
const {
  etichettaCanale, etichettaStato, nomeContatto, quandoElenco, quandoMessaggio, soldi, statoOrdine,
  percorsoElenco, unisci, ultimoVisto, statoRisposta, testoErrore, nuovoId,
} = await import('../frontend/ishtar-lab/chat/casella.mjs');

// Venerdì 13 novembre 2026, 15:30 a Roma.
const ADESSO = new Date('2026-11-13T15:30:00+01:00').getTime();
const prima = ms => new Date(ADESSO - ms).toISOString();
const MIN = 60e3, ORA = 60 * MIN;

test('etichette di canali e stati, nome del contatto mai vuoto', () => {
  assert.deepEqual(['telegram', 'email', 'sito', 'whatsapp', 'instagram', 'messenger'].map(etichettaCanale),
    ['Telegram', 'Email', 'Site chat', 'WhatsApp', 'Instagram', 'Messenger']);
  assert.deepEqual(['aperta', 'in_attesa', 'chiusa'].map(etichettaStato), ['Open', 'Waiting for customer', 'Closed']);
  assert.equal(nomeContatto({nome: ' Giulia Bianchi ', recapito: '+39 333'}), 'Giulia Bianchi');
  assert.equal(nomeContatto({nome: '  ', recapito: '+39 333'}), '+39 333');
  assert.equal(nomeContatto({}), 'Customer');
  assert.equal(nomeContatto(null), 'Customer');
});

test("orari nell'elenco con l'orologio vero", () => {
  const casi = [
    [prima(30e3), 'now'],
    [new Date(ADESSO + 2 * MIN).toISOString(), 'now'], // orologi leggermente diversi: mai «fra 2 minuti»
    [prima(5 * MIN), '5 min'],
    [prima(59 * MIN), '59 min'],
    ['2026-11-13T09:05:00+01:00', '09:05'],
    ['2026-11-12T23:59:00+01:00', 'Yesterday'],
    ['2026-11-10T08:00:00+01:00', 'Tue'],
    ['2026-11-07T08:00:00+01:00', 'Sat'],
    ['2026-11-06T08:00:00+01:00', '6 Nov'],
    ['2025-12-25T08:00:00+01:00', '25 Dec 2025'],
  ];
  for (const [quando, atteso] of casi) assert.equal(quandoElenco(quando, ADESSO), atteso, quando);
});

test('orari sotto i messaggi', () => {
  assert.equal(quandoMessaggio('2026-11-13T09:05:00+01:00', ADESSO), '09:05');
  assert.equal(quandoMessaggio('2026-11-12T23:59:00+01:00', ADESSO), 'Yesterday, 23:59');
  assert.equal(quandoMessaggio('2026-11-10T14:00:00+01:00', ADESSO), '10 Nov, 14:00');
  assert.equal(quandoMessaggio('2025-12-25T14:00:00+01:00', ADESSO), '25 Dec 2025, 14:00');
});

test('importi nella valuta degli ordini, anche con un codice strano', () => {
  assert.equal(soldi(37.5), '€37.50');
  assert.equal(soldi(1987, 'eur'), '€1,987.00');
  assert.equal(soldi(10, 'usd'), 'US$10.00');
  assert.equal(soldi(5, 'x1'), '5.00 X1');
  assert.equal(soldi(null), '€0.00');
});

test('stato degli ordini con il tono dei pill del kit', () => {
  assert.deepEqual(statoOrdine('completed'), {testo: 'Completed', tono: 'good'});
  assert.deepEqual(statoOrdine('canceled'), {testo: 'Cancelled', tono: 'bad'});
  assert.deepEqual(statoOrdine('pending'), {testo: 'Pending', tono: 'warn'});
  assert.deepEqual(statoOrdine('requires_action'), {testo: 'Needs action', tono: 'warn'});
  assert.deepEqual(statoOrdine('archived'), {testo: 'Archived', tono: 'plain'});
  assert.deepEqual(statoOrdine('draft'), {testo: 'Draft', tono: 'plain'});
  assert.deepEqual(statoOrdine('partially_refunded'), {testo: 'Partially refunded', tono: 'plain'});
});

test("indirizzo dell'elenco: canale e ricerca solo se presenti, caratteri speciali codificati", () => {
  assert.equal(percorsoElenco({stato: 'aperte', canale: '', q: '', quante: 50}), '/api/conversazioni?stato=aperte&limit=50');
  assert.equal(percorsoElenco({stato: 'chiuse', canale: 'telegram', q: 'Rossi & co 100%', quante: 100}),
    '/api/conversazioni?stato=chiuse&limit=100&canale=telegram&q=Rossi+%26+co+100%25');
  assert.equal(percorsoElenco({stato: 'aperte', canale: '', q: '   ', quante: 50}), '/api/conversazioni?stato=aperte&limit=50');
});

test('risposte in attesa dopo i messaggi del server, una sola volta, solo della loro conversazione', () => {
  const m1 = {id: 'msgc_1', direzione: 'entrata', testo: 'Ciao'};
  const m2 = {id: 'msgc_2', direzione: 'uscita', testo: 'Salve', id_client: 'a'.repeat(32)};
  const inSospeso = [
    {id_client: 'a'.repeat(32), conversazione_id: 'conv_1', testo: 'Salve', fase: 'invio'},
    {id_client: 'b'.repeat(32), conversazione_id: 'conv_1', testo: 'Altro', fase: 'attesa'},
    {id_client: 'c'.repeat(32), conversazione_id: 'conv_2', testo: 'Altrove', fase: 'invio'},
  ];
  const visti = unisci([m1, m2], inSospeso, 'conv_1');
  assert.deepEqual(visti.map(m => m.id ?? m.id_client), ['msgc_1', 'msgc_2', 'b'.repeat(32)]);
  assert.equal(visti[2].locale, true);
  assert.equal(ultimoVisto([m1, m2]), 'msgc_2');
  assert.equal(ultimoVisto([]), null);
});

test('stato di una risposta: testo, tono e azione possibile', () => {
  const uscita = (stato_consegna, eta, errore = null) => ({direzione: 'uscita', stato_consegna, quando: prima(eta), errore});
  assert.deepEqual(statoRisposta(uscita('inviato', MIN), ADESSO), {testo: 'Sent', tono: 'good', azione: null});
  assert.deepEqual(statoRisposta(uscita('in_coda', 10e3), ADESSO), {testo: 'Sending…', tono: 'plain', azione: null});
  assert.deepEqual(statoRisposta(uscita('in_coda', 61e3), ADESSO), {testo: 'Still sending', tono: 'warn', azione: 'riprova'});
  assert.deepEqual(statoRisposta(uscita('fallito', MIN, 'Telegram is not connected'), ADESSO),
    {testo: 'Not sent: Telegram is not connected', tono: 'bad', azione: 'riprova'});
  assert.deepEqual(statoRisposta(uscita('fallito', MIN), ADESSO), {testo: 'Not sent', tono: 'bad', azione: 'riprova'});
  // Il motivo che comincia già con «Not sent» non si ripete.
  assert.equal(statoRisposta(uscita('fallito', MIN, 'Not sent: something went wrong before sending. Try again'), ADESSO).testo,
    'Not sent: something went wrong before sending. Try again');
  assert.deepEqual(statoRisposta(uscita('incerto', MIN, 'x'), ADESSO),
    {testo: 'Not confirmed: the customer may have received it.', tono: 'warn', azione: 'rimanda'});
  assert.deepEqual(statoRisposta({locale: true, fase: 'invio'}, ADESSO), {testo: 'Sending…', tono: 'plain', azione: null});
  assert.deepEqual(statoRisposta({locale: true, fase: 'attesa', errore: 'x'}, ADESSO), {testo: 'Not sent yet', tono: 'warn', azione: 'riprova'});
  assert.deepEqual(statoRisposta({locale: true, fase: 'rifiutato', errore: 'This conversation is closed: reopen it to reply'}, ADESSO),
    {testo: 'This conversation is closed: reopen it to reply', tono: 'bad', azione: 'modifica'});
  assert.equal(statoRisposta({direzione: 'entrata', stato_consegna: 'ricevuto'}, ADESSO), null);
});

test('messaggi degli errori in inglese, con il motivo del server quando c\'è', () => {
  assert.equal(testoErrore({stato: 0, message: 'Network error'}), "The panel's local server is not responding.");
  assert.equal(testoErrore({stato: 503, message: 'Backend Ishtar Lab non disponibile'}),
    'The Ishtar Lab server is not reachable. Start Ishtar Lab and try again.');
  assert.equal(testoErrore({stato: 400, message: 'Write a reply'}), 'Write a reply');
  assert.equal(testoErrore({stato: 500, message: ''}), 'Something went wrong (500).');
  assert.equal(testoErrore(new Error('boom')), 'boom');
  assert.equal(testoErrore(undefined), 'Something went wrong.');
});

test('id delle risposte: 32 caratteri esadecimali, sempre diversi', () => {
  const a = nuovoId(), b = nuovoId();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});
