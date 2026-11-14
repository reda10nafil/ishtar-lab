// Stato puro e testi del widget della chat del sito (chat-sito/widget/src): nessun DOM, nessuna rete.
const {test} = await import('node:test');
const {default: assert} = await import('node:assert/strict');
const {
  statoIniziale, riduci, vista, etichetta, statoNegozio, attesa, intervalloLettura, configurazione, paginaCorrente, motivoErrore, rispostaNuova,
} = await import('../chat-sito/widget/src/stato.mjs');
const {testi, LINGUE} = await import('../chat-sito/widget/src/testi.mjs');

const t = testi('en');
const ADESSO = Date.parse('2026-11-14T12:00:00Z');
const scritta = (stato, testo, id_client) => riduci(riduci(stato, {tipo: 'bozza', testo}), {tipo: 'invia', id_client, adesso: ADESSO});
const riga = (id, creato_il, extra = {}) => ({id, direzione: 'entrata', testo: `testo ${id}`, firma: null, creato_il, importato: false, ...extra});

test('doppio clic su «Send»: un solo messaggio, perché l\'invio consuma la bozza', () => {
  let s = scritta(statoIniziale(), 'Avete l\'abito verde?', 'cliente-0001');
  s = riduci(s, {tipo: 'invia', id_client: 'cliente-0002', adesso: ADESSO});
  assert.equal(s.inSospeso.length, 1);
  assert.equal(s.inSospeso[0].id_client, 'cliente-0001');
  assert.equal(s.bozza, '');
  // Bozza vuota, solo spazi o troppo lunga: niente da mandare.
  assert.equal(scritta(statoIniziale(), '   ', 'x-00000001').inSospeso.length, 0);
  assert.equal(scritta(statoIniziale(), 'a'.repeat(4001), 'x-00000002').inSospeso.length, 0);
  assert.equal(scritta(statoIniziale(), 'a'.repeat(4000), 'x-00000003').inSospeso.length, 1);
});

test('«Sent» solo dopo la risposta della casella; «Not sent» con «Retry» sullo stesso id', () => {
  let s = scritta(statoIniziale(), 'Ciao', 'cliente-0001');
  assert.deepEqual(etichetta(vista(s)[0], t), {testo: 'Sending…', riprova: false});
  s = riduci(s, {tipo: 'non_inviato', id_client: 'cliente-0001', errore: 'rete'});
  assert.deepEqual(etichetta(vista(s)[0], t), {testo: 'Not sent', riprova: true});
  s = riduci(s, {tipo: 'riprova', id_client: 'cliente-0001'});
  assert.deepEqual(s.inSospeso.map(m => [m.id_client, m.fase]), [['cliente-0001', 'invio']]);
  s = riduci(s, {tipo: 'inviato', id_client: 'cliente-0001', id: 'srv-1', creato_il: '2026-11-14T12:00:01Z'});
  assert.deepEqual(etichetta(vista(s)[0], t), {testo: 'Sent', riprova: false});
  // «Retry» solo su un messaggio non inviato: su uno già inviato (o in invio) non cambia nulla.
  assert.deepEqual(riduci(s, {tipo: 'riprova', id_client: 'cliente-0001'}), s);
  // Un esito che arriva per un id sconosciuto non tocca nulla.
  assert.deepEqual(riduci(s, {tipo: 'inviato', id_client: 'altro-0001', id: 'srv-9', creato_il: 'x'}), s);
});

test('letture unite senza doppioni e in ordine; il messaggio in sospeso sparisce quando la lettura lo contiene', () => {
  let s = scritta(statoIniziale(), 'Terzo', 'cliente-0003');
  s = riduci(s, {tipo: 'inviato', id_client: 'cliente-0003', id: 'c', creato_il: '2026-11-14T12:00:03Z'});
  s = riduci(s, {tipo: 'letti', righe: [riga('b', '2026-11-14T12:00:02Z'), riga('a', '2026-11-14T12:00:01Z')]});
  assert.deepEqual(vista(s).map(m => m.id ?? m.id_client), ['a', 'b', 'c']);
  assert.equal(s.inSospeso.length, 1);
  s = riduci(s, {tipo: 'letti', righe: [riga('b', '2026-11-14T12:00:02Z', {importato: true}), riga('c', '2026-11-14T12:00:03Z', {testo: 'Terzo'}),
    riga('r', '2026-11-14T12:00:04Z', {direzione: 'uscita', testo: 'Ciao!', firma: 'Ishtar Hub', importato: true})]});
  assert.deepEqual(vista(s).map(m => m.id), ['a', 'b', 'c', 'r']);
  assert.equal(s.inSospeso.length, 0);
  assert.deepEqual(etichetta(vista(s)[1], t), {testo: 'Delivered', riprova: false});
  assert.deepEqual(etichetta(vista(s)[0], t), {testo: 'Sent', riprova: false});
  assert.equal(etichetta(vista(s)[3], t), null);
  // Prima l'istante di creazione, anche contro l'ordine degli id; nello stesso istante, l'id.
  s = riduci(statoIniziale(), {tipo: 'letti', righe: [riga('a', '2026-11-14T12:00:02Z'), riga('z', '2026-11-14T12:00:01Z')]});
  assert.deepEqual(vista(s).map(m => m.id), ['z', 'a']);
  // Orari scritti in fusi diversi: conta l'istante, non il testo.
  s = riduci(statoIniziale(), {tipo: 'letti', righe: [riga('a', '2026-11-14T12:00:02Z'), riga('z', '2026-11-14T13:00:01+02:00')]});
  assert.deepEqual(vista(s).map(m => m.id), ['z', 'a']);
  s = riduci(statoIniziale(), {tipo: 'letti', righe: [riga('z', '2026-11-14T12:00:00Z'), riga('k', '2026-11-14T12:00:00Z')]});
  assert.deepEqual(vista(s).map(m => m.id), ['k', 'z']);
});

test('righe lette con una forma sbagliata: scartate (solo testo, mai altro)', () => {
  const s = riduci(statoIniziale(), {tipo: 'letti', righe: [riga('a', '2026-11-14T12:00:01Z'), {id: 7, testo: 'x'}, null, {id: 'b', direzione: 'uscita', testo: {html: '<b>'}, creato_il: 'x'}]});
  assert.deepEqual(vista(s).map(m => m.id), ['a']);
  assert.deepEqual(riduci(statoIniziale(), {tipo: 'letti', righe: 'non un elenco'}).messaggi, []);
});

test('stato del negozio: online, away, offline dopo tre letture fallite, sconosciuto all\'inizio', () => {
  assert.equal(statoNegozio(statoIniziale()), null);
  let s = riduci(statoIniziale(), {tipo: 'negozio', online: true, nome: 'Ishtar Hub'});
  assert.equal(statoNegozio(s), 'online');
  s = riduci(s, {tipo: 'negozio', online: false, nome: 'Ishtar Hub'});
  assert.equal(statoNegozio(s), 'away');
  s = riduci(riduci(s, {tipo: 'errore_lettura'}), {tipo: 'errore_lettura'});
  assert.equal(statoNegozio(s), 'away');
  s = riduci(s, {tipo: 'errore_lettura'});
  assert.equal(statoNegozio(s), 'offline');
  s = riduci(s, {tipo: 'negozio', online: true, nome: 'Ishtar Hub'});
  assert.equal(s.erroriLettura, 0);
  assert.equal(statoNegozio(s), 'online');
});

test('attesa crescente con una parte casuale, entro il massimo', () => {
  const fisso = valore => () => valore;
  assert.equal(attesa(0, {base: 4000, massimo: 60000}, fisso(0.5)), 4000);
  assert.equal(attesa(1, {base: 4000, massimo: 60000}, fisso(0.5)), 8000);
  assert.equal(attesa(2, {base: 4000, massimo: 60000}, fisso(0.5)), 16000);
  assert.equal(attesa(10, {base: 4000, massimo: 60000}, fisso(0.5)), 60000);
  assert.equal(attesa(0, {base: 4000, massimo: 60000}, fisso(0)), 3200);
  assert.equal(attesa(0, {base: 4000, massimo: 60000}, fisso(0.999999)), 4800);
  assert.equal(intervalloLettura({aperta: true, conversazione: true, errori: 0}, fisso(0.5)), 4000);
  assert.equal(intervalloLettura({aperta: false, conversazione: true, errori: 0}, fisso(0.5)), 60000);
  assert.equal(intervalloLettura({aperta: false, conversazione: true, errori: 3}, fisso(0.5)), 300000);
  assert.equal(intervalloLettura({aperta: false, conversazione: false, errori: 0}, fisso(0.5)), null);
});

test('configurazione dallo script: progetto Supabase, chiave pubblicabile, lingua, ricorda, email', () => {
  const base = {url: 'https://abcdefghijklmnopqrst.supabase.co', chiave: 'sb_publishable_abc123'};
  assert.deepEqual(configurazione({...base, turnstile: '0x4AAAA', lingua: 'it', ricorda: 'si', email: 'Shop@Example.com'}), {
    url: 'https://abcdefghijklmnopqrst.supabase.co', chiave: 'sb_publishable_abc123', turnstile: '0x4AAAA', lingua: 'it', ricorda: true, email: 'shop@example.com',
  });
  assert.deepEqual(configurazione(base), {url: base.url, chiave: base.chiave, turnstile: null, lingua: 'en', ricorda: false, email: null});
  assert.equal(configurazione({...base, url: 'http://127.0.0.1:54321'}).url, 'http://127.0.0.1:54321');
  assert.equal(configurazione({...base, lingua: 'fr', email: 'non valida'}).lingua, 'en');
  assert.equal(configurazione({...base, email: 'non valida'}).email, null);
  for (const url of ['https://evil.example', 'https://abcdefghijklmnopqrst.supabase.co/rest', 'http://abcdefghijklmnopqrst.supabase.co', undefined]) {
    assert.match(configurazione({...base, url}).errore, /data-url/);
  }
  assert.match(configurazione({...base, chiave: ''}).errore, /data-chiave/);
  // La chiave segreta non deve mai stare nel sito: il widget non parte.
  assert.match(configurazione({...base, chiave: 'sb_secret_abc'}).errore, /secret/);
  const jwt = ruolo => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({role: ruolo})).toString('base64url'), 'firma'].join('.');
  assert.match(configurazione({...base, chiave: jwt('service_role')}).errore, /secret/);
  assert.equal(configurazione({...base, chiave: jwt('anon')}).chiave, jwt('anon'));
});

test('pagina corrente: solo origine e percorso, mai query e frammento', () => {
  assert.equal(paginaCorrente({origin: 'https://negozio.example', pathname: '/abiti/verde', search: '?email=a@b.c', hash: '#x'}), 'https://negozio.example/abiti/verde');
  assert.equal([...paginaCorrente({origin: 'https://n.example', pathname: `/${'a'.repeat(600)}`})].length, 500);
  assert.equal(paginaCorrente(null), null);
});

test('motivo di un invio non riuscito, dai codici fissi della casella', () => {
  assert.equal(motivoErrore({code: 'PT429', message: 'too_many_messages'}, t), 'Too many messages: wait a few minutes and try again');
  assert.equal(motivoErrore({code: 'PT503', message: 'mailbox_full'}, t), 'The chat is full right now: try again later');
  assert.equal(motivoErrore({message: 'Failed to fetch'}, t), null);
  assert.equal(motivoErrore(null, t), null);
});

test('testi in due lingue con le stesse voci; lingua sconosciuta: inglese', () => {
  assert.deepEqual(LINGUE, ['en', 'it']);
  assert.deepEqual(Object.keys(testi('it')).sort(), Object.keys(testi('en')).sort());
  assert.equal(testi('it').invia, 'Invia');
  assert.equal(testi('en').invia, 'Send');
  assert.equal(testi('fr'), testi('en'));
  for (const lingua of LINGUE) for (const [voce, testo] of Object.entries(testi(lingua))) assert.ok(typeof testo === 'string' && testo.trim(), `${lingua}.${voce}`);
  assert.deepEqual(etichetta(vista(scritta(statoIniziale(), 'Ciao', 'cliente-0001'))[0], testi('it')), {testo: 'Invio…', riprova: false});
});

test('pallino delle risposte nuove: una risposta mai vista è nuova, anche la prima', () => {
  assert.equal(rispostaNuova('r1', null), true);
  assert.equal(rispostaNuova('r2', 'r1'), true);
  assert.equal(rispostaNuova('r1', 'r1'), false);
  assert.equal(rispostaNuova(null, null), false);
  assert.equal(rispostaNuova(null, 'r1'), false);
});

test('risposta all\'invio persa: la lettura che contiene il messaggio (stesso id_client) toglie la copia «Non inviato»', () => {
  let s = scritta(statoIniziale(), 'Ciao', 'cliente-0001');
  s = riduci(s, {tipo: 'non_inviato', id_client: 'cliente-0001', errore: null});
  s = riduci(s, {tipo: 'letti', righe: [riga('srv-1', '2026-11-14T12:00:01Z', {testo: 'Ciao', id_client: 'cliente-0001'})]});
  assert.deepEqual(vista(s).map(m => [m.id, m.testo]), [['srv-1', 'Ciao']]);
  assert.equal(s.inSospeso.length, 0);
  // Anche ancora in invio (la lettura arriva prima della risposta all'invio): una sola bolla.
  let t = scritta(statoIniziale(), 'Ancora', 'cliente-0002');
  t = riduci(t, {tipo: 'letti', righe: [riga('srv-2', '2026-11-14T12:00:02Z', {testo: 'Ancora', id_client: 'cliente-0002'})]});
  assert.deepEqual(vista(t).map(m => m.id), ['srv-2']);
  // L'id_client della riga resta nei messaggi letti (solo come testo).
  assert.equal(t.messaggi[0].id_client, 'cliente-0002');
});
