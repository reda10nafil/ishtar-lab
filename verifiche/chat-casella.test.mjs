// Aiuti puri della pagina Chats (frontend/ishtar-lab/chat/casella.mjs): orari, nomi, importi, elenco, stato delle risposte.
process.env.TZ = 'Europe/Rome';
const {test} = await import('node:test');
const {default: assert} = await import('node:assert/strict');
const {
  etichettaCanale, etichettaStato, nomeContatto, quandoElenco, quandoMessaggio, soldi, statoOrdine,
  percorsoElenco, unisci, ultimoVisto, statoRisposta, testoErrore, nuovoId,
  oggettoRisposta, ultimaEmail, avvisoRispondiA, clienteConEmail, testoVerifica, testoCompleto,
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

test('riga del server con un nuovo tentativo in corso: «Sending…» senza azioni', () => {
  const id = 'd'.repeat(32);
  const server = [{id: 'msgc_3', direzione: 'uscita', stato_consegna: 'fallito', errore: 'x', quando: prima(MIN), id_client: id}];
  const visti = unisci(server, [{id_client: id, conversazione_id: 'conv_1', testo: 'Salve', fase: 'invio'}], 'conv_1');
  assert.equal(visti.length, 1);
  assert.equal(visti[0].inviando, true);
  assert.deepEqual(statoRisposta(visti[0], ADESSO), {testo: 'Sending…', tono: 'plain', azione: null});
  // Senza tentativi in corso la riga resta com'è.
  assert.equal(unisci(server, [], 'conv_1')[0].inviando, undefined);
});

test('server del pannello più vecchio della pagina: invito a riavviare Ishtar Lab', () => {
  const riavvia = 'Restart Ishtar Lab to use Chats: the panel server running now is older than this page.';
  assert.equal(testoErrore({stato: 404, message: 'Indirizzo del ponte non riconosciuto'}), riavvia);
  assert.equal(testoErrore({stato: 501, message: 'Request failed (501)'}), riavvia);
  assert.equal(testoErrore({stato: 404, message: 'Customer not found'}), 'Customer not found');
});

test('nuovo tentativo su una riga del server non riuscito: la riga mostra il suo esito', () => {
  const id = 'e'.repeat(32);
  const server = [{id: 'msgc_4', direzione: 'uscita', stato_consegna: 'fallito', errore: 'The customer blocked the bot or never started it', quando: prima(MIN), id_client: id}];
  const chiusa = unisci(server, [{id_client: id, conversazione_id: 'conv_1', testo: 'Salve', fase: 'rifiutato', errore: 'This conversation is closed: reopen it to reply'}], 'conv_1');
  assert.equal(chiusa.length, 1);
  assert.deepEqual(statoRisposta(chiusa[0], ADESSO), {testo: 'This conversation is closed: reopen it to reply', tono: 'bad', azione: 'riprova'});
  const rete = unisci(server, [{id_client: id, conversazione_id: 'conv_1', testo: 'Salve', fase: 'attesa', errore: "The panel's local server is not responding."}], 'conv_1');
  assert.deepEqual(statoRisposta(rete[0], ADESSO), {testo: 'Not sent yet', tono: 'warn', azione: 'riprova'});
  assert.equal(rete[0].tentativo.errore, "The panel's local server is not responding.");
});

test('risposta incerta già rimandata come nuova: nessun altro «Send again»', () => {
  const id = 'f'.repeat(32);
  const server = [{id: 'msgc_5', direzione: 'uscita', stato_consegna: 'incerto', errore: 'x', quando: prima(MIN), id_client: id}];
  const [riga] = unisci(server, [], 'conv_1', [id]);
  assert.equal(riga.rimandata, true);
  assert.deepEqual(statoRisposta(riga, ADESSO), {testo: 'Not confirmed: sent again as a new message.', tono: 'warn', azione: null});
});

test('email: oggetto della risposta con un solo «Re:», la stessa regola del server', () => {
  assert.equal(oggettoRisposta('Ordine 12'), 'Re: Ordine 12');
  assert.equal(oggettoRisposta('RE: R: Re: Ordine 12'), 'Re: Ordine 12');
  assert.equal(oggettoRisposta('AW: Sv: RIF: Spedizione'), 'Re: Spedizione');
  assert.equal(oggettoRisposta('Re[2]: Antw: Reso'), 'Re: Reso');
  assert.equal(oggettoRisposta('Recensione del prodotto'), 'Re: Recensione del prodotto');
  assert.equal(oggettoRisposta(''), 'Re: Your message');
  assert.equal(oggettoRisposta(null), 'Re: Your message');
});

test("email: l'ultima email del cliente, anche senza dettagli (segnaposto), e l'avviso sul Reply-To", () => {
  const dettagli = {oggetto: 'Re: Ordine', reply_to: 'altro@example.com', verifica: 'verificato', allegati: [], testo_completo: null};
  const messaggi = [
    {id: 'a', direzione: 'entrata', testo: 'Prima', email: {...dettagli, reply_to: null}},
    {id: 'b', direzione: 'entrata', testo: 'Seconda', email: dettagli},
    {id: 'c', direzione: 'uscita', testo: 'Risposta', email: {oggetto: 'Re: Ordine', reply_to: null, verifica: null, allegati: [], testo_completo: null}},
    {locale: true, id_client: 'x'.repeat(32), testo: 'In partenza', fase: 'invio'},
  ];
  assert.equal(ultimaEmail(messaggi).id, 'b');
  assert.equal(ultimaEmail([...messaggi, {id: 'd', direzione: 'entrata', testo: '[This email could not be read: open it in your mail app]'}]).id, 'd');
  assert.equal(ultimaEmail([]), null);
  assert.equal(ultimaEmail(undefined), null);
  assert.equal(avvisoRispondiA(messaggi[1], 'giulia@example.com'),
    "This email asks to reply to altro@example.com. Replies go to giulia@example.com, the sender's address.");
  assert.equal(avvisoRispondiA(messaggi[0], 'giulia@example.com'), null);
  assert.equal(avvisoRispondiA({email: {reply_to: ' Giulia@Example.com '}}, 'giulia@example.com'), null);
  assert.equal(avvisoRispondiA(null, 'giulia@example.com'), null);
});

test('email: cliente con lo stesso indirizzo (senza maiuscole); con più clienti nessuna proposta, solo l’elenco', () => {
  const giulia = {id: 'cus_1', email: 'Giulia@Example.com'};
  const omonima = {id: 'cus_2', email: ' giulia@example.com'};
  const simile = {id: 'cus_3', email: 'giulia@example.com.evil'};
  const senza = {id: 'cus_4', email: null};
  assert.deepEqual(clienteConEmail([giulia, simile, senza], ' giulia@EXAMPLE.com'), {proposta: giulia, elenco: [giulia]});
  assert.deepEqual(clienteConEmail([giulia, omonima, simile], 'giulia@example.com'), {proposta: null, elenco: [giulia, omonima]});
  assert.deepEqual(clienteConEmail([simile, senza], 'giulia@example.com'), {proposta: null, elenco: []});
  assert.deepEqual(clienteConEmail([giulia], ''), {proposta: null, elenco: []});
  assert.deepEqual(clienteConEmail(undefined, 'giulia@example.com'), {proposta: null, elenco: []});
});

test('email: verifica del mittente detta in chiaro, «verificato» solo con DMARC', () => {
  assert.equal(testoVerifica('verificato'), "The sender's domain is verified (DMARC)");
  for (const v of ['non_verificato', 'sconosciuto', null, undefined, 'boh']) assert.equal(testoVerifica(v), "The sender's address is not verified: it can be forged");
});

test('email: testo intero con le citazioni, con gli allegati come nel testo mostrato', () => {
  const m = {
    testo: 'Va bene\n\n[Attachment: foto.jpg, 2 KB]\n[Attachment: video.mp4, 3.5 MB]',
    email: {testo_completo: 'Va bene\n> Il pacco parte domani.', allegati: [{nome: 'foto.jpg', byte: 2048}, {nome: 'video.mp4', byte: 3.5 * 1024 * 1024}]},
  };
  assert.equal(testoCompleto(m), 'Va bene\n> Il pacco parte domani.\n\n[Attachment: foto.jpg, 2 KB]\n[Attachment: video.mp4, 3.5 MB]');
  assert.equal(testoCompleto({testo: 'Va bene', email: {testo_completo: 'Va bene\n> citato', allegati: [{nome: 'n.txt', byte: 10}]}}), 'Va bene\n> citato\n\n[Attachment: n.txt, 1 KB]');
  assert.equal(testoCompleto({testo: 'Solo testo'}), 'Solo testo');
  assert.equal(testoCompleto({testo: 'x', email: {testo_completo: null, allegati: []}}), 'x');
});
