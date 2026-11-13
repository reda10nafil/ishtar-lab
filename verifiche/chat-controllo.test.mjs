// Controllo della casella della pagina Chats (frontend/ishtar-lab/chat/controllo.mjs) con un server finto: ordine delle
// risposte del server, «letta», risposte mai doppie e mai perse in silenzio.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creaCasella} from '../frontend/ishtar-lab/chat/controllo.mjs';
import {ErroreRichiesta} from '../frontend/ishtar-lab/chat/api.mjs';
import {unisci} from '../frontend/ishtar-lab/chat/casella.mjs';

const ADESSO = Date.parse('2026-11-13T15:30:00Z');
const giro = () => new Promise(r => setImmediate(r));
const giri = async (n = 5) => { for (let i = 0; i < n; i++) await giro(); };
const rinviato = () => { let risolvi; const promessa = new Promise(r => { risolvi = r; }); return {promessa, risolvi}; };
let contatore = 0;
const nuovoId = () => String(++contatore).padStart(32, '0');

const riga = (id, extra = {}) => ({id, canale: 'telegram', stato: 'aperta', nome: `Cliente ${id}`, recapito: null, estratto: 'Ciao',
  oggetto: null, non_letti: 0, ultimo_messaggio_il: '2026-11-13T15:00:00Z', cliente_id: null, ...extra});
const elenco = (ids, conteggi = {aperte: ids.length, chiuse: 0, non_lette: 0}) => ({conversazioni: ids.map(id => riga(id)), conteggi, totale: ids.length});
const entrata = (id, testo = 'Ciao') => ({id, direzione: 'entrata', testo, quando: '2026-11-13T15:00:00Z', stato_consegna: 'ricevuto', errore: null, autore_nome: null, id_client: null});
const uscita = (id, id_client, stato_consegna = 'inviato', testo = 'Salve') =>
  ({id, direzione: 'uscita', testo, quando: '2026-11-13T15:01:00Z', stato_consegna, errore: null, autore_nome: 'Reda', id_client});
const dettaglio = (id, messaggi, extra = {}) => ({conversazione: riga(id, extra), messaggi, identita: {id: 'idc_1', canale: 'telegram', nome: `Cliente ${id}`, recapito: null, cliente_id: null}});

function fintoServer() {
  const chiamate = [], regole = [];
  async function richiesta(percorso, {metodo = 'GET', corpo} = {}) {
    const chiamata = {percorso, metodo, corpo};
    chiamate.push(chiamata);
    const regola = regole.find(r => r.metodo === metodo && (r.percorso instanceof RegExp ? r.percorso.test(percorso) : r.percorso === percorso));
    if (!regola) throw new ErroreRichiesta('Not found', {stato: 404});
    const esito = await regola.risposta(corpo, chiamata);
    if (esito instanceof Error) throw esito;
    return esito;
  }
  const su = (metodo, percorso, risposta) => regole.unshift({metodo, percorso, risposta});
  const di = (metodo, percorso) => chiamate.filter(c => c.metodo === metodo && (percorso instanceof RegExp ? percorso.test(c.percorso) : c.percorso === percorso));
  // Letture predefinite: elenco vuoto, conversazione A con un messaggio del cliente.
  su('GET', /^\/api\/conversazioni\?/, () => elenco([]));
  su('GET', '/api/conversazioni/conv_A', () => dettaglio('conv_A', [entrata('msgc_1')]));
  return {richiesta, chiamate, su, di};
}

function ambiente(extra = {}) {
  const avvisi = [];
  const stato = {visibile: true, inPrimoPiano: true, vista: 'conv_A', ...extra};
  return {
    avvisi, stato,
    adesso: () => ADESSO,
    visibile: () => stato.visibile,
    inPrimoPiano: () => stato.inPrimoPiano,
    vista: () => ({id: stato.vista}),
    avviso: testo => avvisi.push(testo),
  };
}

const crea = (server, amb = ambiente()) => creaCasella({richiesta: server.richiesta, ambiente: amb, nuovoId});

test("elenco: si applica solo la lettura più recente", async () => {
  const server = fintoServer(), prima = rinviato(), seconda = rinviato();
  let n = 0;
  server.su('GET', /^\/api\/conversazioni\?/, () => (++n === 1 ? prima.promessa : seconda.promessa));
  const casella = crea(server);
  const a = casella.aggiorna({elenco: true}), b = casella.aggiorna({elenco: true});
  seconda.risolvi(elenco(['conv_B']));
  await b;
  prima.risolvi(elenco(['conv_A']));
  await a;
  assert.deepEqual(casella.istantanea().elenco.righe.map(r => r.id), ['conv_B']);
});

test("dettaglio di un'altra conversazione non si applica", async () => {
  const server = fintoServer(), lettaA = rinviato(), lettaB = rinviato();
  server.su('GET', '/api/conversazioni/conv_A', () => lettaA.promessa);
  server.su('GET', '/api/conversazioni/conv_B', () => lettaB.promessa);
  const casella = crea(server, ambiente({vista: 'conv_B'}));
  casella.apri('conv_A');
  casella.apri('conv_B');
  lettaA.risolvi(dettaglio('conv_A', [entrata('msgc_1')]));
  await giri();
  assert.equal(casella.istantanea().aperta.id, 'conv_B');
  assert.equal(casella.istantanea().aperta.dati, null);
  lettaB.risolvi(dettaglio('conv_B', [entrata('msgc_2')]));
  await giri();
  assert.equal(casella.istantanea().aperta.dati.conversazione.id, 'conv_B');
});

test('letta solo con la pagina visibile, in primo piano e sulla conversazione', async () => {
  const server = fintoServer(), amb = ambiente({visibile: false});
  server.su('GET', /^\/api\/conversazioni\?/, () => elenco(['conv_A'], {aperte: 1, chiuse: 0, non_lette: 1}));
  server.su('GET', '/api/conversazioni/conv_A', () => dettaglio('conv_A', [entrata('msgc_1'), entrata('msgc_2')], {non_letti: 2}));
  server.su('POST', '/api/conversazioni/conv_A/letta', () => ({ok: true}));
  const casella = crea(server, amb);
  await casella.aggiorna({elenco: true});
  casella.istantanea().elenco.righe[0].non_letti = 2;
  casella.apri('conv_A');
  await giri();
  assert.equal(server.di('POST', '/api/conversazioni/conv_A/letta').length, 0, 'pagina nascosta');
  amb.stato.visibile = true;
  amb.stato.inPrimoPiano = false;
  await casella.segnaLetta();
  assert.equal(server.di('POST', '/api/conversazioni/conv_A/letta').length, 0, 'finestra non in primo piano');
  amb.stato.inPrimoPiano = true;
  amb.stato.vista = 'conv_B';
  await casella.segnaLetta();
  assert.equal(server.di('POST', '/api/conversazioni/conv_A/letta').length, 0, 'altra conversazione sullo schermo');
  amb.stato.vista = 'conv_A';
  await casella.segnaLetta();
  const lette = server.di('POST', '/api/conversazioni/conv_A/letta');
  assert.equal(lette.length, 1);
  assert.deepEqual(lette[0].corpo, {ultimo_visto: 'msgc_2'});
  const s = casella.istantanea();
  assert.equal(s.aperta.dati.conversazione.non_letti, 0);
  assert.equal(s.elenco.righe[0].non_letti, 0);
  assert.equal(s.elenco.conteggi.non_lette, 0);
});

test('risposta: stesso id e stesso testo nei nuovi tentativi', async () => {
  const server = fintoServer(), corpi = [];
  let fallisci = true, salvata = null;
  server.su('POST', '/api/conversazioni/conv_A/messaggi', corpo => {
    corpi.push(corpo);
    if (fallisci) return new ErroreRichiesta('Network error', {stato: 0});
    salvata = uscita('msgc_9', corpo.id, 'inviato', corpo.testo);
    return {messaggio: salvata};
  });
  // Come il server vero: una risposta salvata compare nelle letture successive.
  server.su('GET', '/api/conversazioni/conv_A', () => dettaglio('conv_A', [entrata('msgc_1'), ...(salvata ? [salvata] : [])]));
  const casella = crea(server);
  casella.apri('conv_A');
  await giri();
  await casella.rispondi('conv_A', '  Ciao  ');
  const [attesa] = casella.istantanea().inSospeso;
  assert.equal(attesa.fase, 'attesa');
  assert.equal(attesa.errore, "The panel's local server is not responding.");
  fallisci = false;
  await casella.riprova(attesa);
  assert.equal(corpi.length, 2);
  assert.equal(corpi[1].id, corpi[0].id);
  assert.equal(corpi[1].testo, 'Ciao');
  assert.equal(corpi[0].ultimo_visto, 'msgc_1');
  assert.deepEqual(casella.istantanea().inSospeso, []);
  assert.ok(casella.istantanea().aperta.dati.messaggi.some(m => m.id_client === corpi[0].id));
});

test('risposta: doppio invio o nuovo tentativo durante l\'invio, una sola richiesta', async () => {
  const server = fintoServer(), risposta = rinviato(), corpi = [];
  server.su('POST', '/api/conversazioni/conv_A/messaggi', corpo => { corpi.push(corpo); return risposta.promessa; });
  const casella = crea(server);
  casella.apri('conv_A');
  await giri();
  const invio = casella.rispondi('conv_A', 'Ciao');
  await casella.rispondi('conv_A', '');
  await casella.rispondi('conv_A', '   ');
  await casella.riprova(casella.istantanea().inSospeso[0]);
  assert.equal(corpi.length, 1);
  risposta.risolvi({messaggio: uscita('msgc_9', corpi[0].id)});
  await invio;
  assert.equal(corpi.length, 1);
});

test('risposta rifiutata: si riprende il testo per correggerlo', async () => {
  const server = fintoServer();
  server.su('POST', '/api/conversazioni/conv_A/messaggi', () => new ErroreRichiesta('This conversation is closed: reopen it to reply', {stato: 400}));
  const casella = crea(server);
  casella.apri('conv_A');
  await giri();
  await casella.rispondi('conv_A', 'Ciao');
  const [rifiutata] = casella.istantanea().inSospeso;
  assert.equal(rifiutata.fase, 'rifiutato');
  assert.equal(rifiutata.errore, 'This conversation is closed: reopen it to reply');
  assert.equal(casella.inAttesa(), true);
  assert.equal(casella.scarta(rifiutata.id_client), 'Ciao');
  assert.deepEqual(casella.istantanea().inSospeso, []);
  assert.equal(casella.inAttesa(), false);
});

test('la riga del server sostituisce la risposta in attesa', async () => {
  const server = fintoServer();
  let id;
  server.su('POST', '/api/conversazioni/conv_A/messaggi', corpo => { id = corpo.id; return new ErroreRichiesta('Bad gateway', {stato: 502}); });
  const casella = crea(server);
  casella.apri('conv_A');
  await giri();
  await casella.rispondi('conv_A', 'Ciao');
  assert.equal(casella.istantanea().inSospeso[0].fase, 'attesa');
  server.su('GET', '/api/conversazioni/conv_A', () => dettaglio('conv_A', [entrata('msgc_1'), uscita('msgc_9', id, 'inviato', 'Ciao')]));
  await casella.aggiorna({dettaglio: true});
  const s = casella.istantanea();
  assert.deepEqual(s.inSospeso, []);
  assert.deepEqual(unisci(s.aperta.dati.messaggi, s.inSospeso, 'conv_A').map(m => m.id), ['msgc_1', 'msgc_9']);
});

test('rimanda usa un id nuovo', async () => {
  const server = fintoServer(), corpi = [];
  const vecchio = 'f'.repeat(32);
  server.su('GET', '/api/conversazioni/conv_A', () => dettaglio('conv_A', [entrata('msgc_1'), uscita('msgc_9', vecchio, 'incerto', 'Ciao')]));
  server.su('POST', '/api/conversazioni/conv_A/messaggi', corpo => { corpi.push(corpo); return {messaggio: uscita('msgc_10', corpo.id, 'inviato', corpo.testo)}; });
  const casella = crea(server);
  casella.apri('conv_A');
  await giri();
  await casella.rimanda({testo: 'Ciao', conversazione_id: 'conv_A'});
  assert.equal(corpi.length, 1);
  assert.notEqual(corpi[0].id, vecchio);
  assert.equal(corpi[0].testo, 'Ciao');
});

test('chiusura con messaggi nuovi (412): avviso e conversazione riletta', async () => {
  const server = fintoServer(), amb = ambiente();
  server.su('POST', '/api/conversazioni/conv_A/stato', () =>
    new ErroreRichiesta('The customer wrote again: read the new messages before closing', {stato: 412, codice: 'conflitto', dati: {nuovi: 1}}));
  const casella = crea(server, amb);
  casella.apri('conv_A');
  await giri();
  const letture = server.di('GET', '/api/conversazioni/conv_A').length;
  assert.equal(await casella.cambiaStato('conv_A', 'chiusa'), false);
  assert.deepEqual(server.di('POST', '/api/conversazioni/conv_A/stato')[0].corpo, {stato: 'chiusa', ultimo_visto: 'msgc_1'});
  assert.deepEqual(amb.avvisi, ['The customer wrote again: read the new messages before closing']);
  await giri();
  assert.ok(server.di('GET', '/api/conversazioni/conv_A').length > letture);
});

test("errore di rete sull'elenco: righe conservate e messaggio", async () => {
  const server = fintoServer();
  server.su('GET', /^\/api\/conversazioni\?/, () => elenco(['conv_A']));
  const casella = crea(server);
  assert.equal(await casella.aggiorna({elenco: true}), true);
  server.su('GET', /^\/api\/conversazioni\?/, () => new ErroreRichiesta('Network error', {stato: 0}));
  assert.equal(await casella.aggiorna({elenco: true}), false);
  const {righe, errore} = casella.istantanea().elenco;
  assert.deepEqual(righe.map(r => r.id), ['conv_A']);
  assert.equal(errore, "The panel's local server is not responding.");
});

test('cliente cancellato: scheda mancante', async () => {
  const server = fintoServer();
  server.su('GET', '/api/clienti/cus_X', () => new ErroreRichiesta('Customer not found', {stato: 404}));
  const casella = crea(server);
  await casella.cliente('cus_X');
  assert.equal(casella.istantanea().schede.cus_X.mancante, true);
});

test('badge: non lette dalla lettura dei conteggi, senza toccare le righe', async () => {
  const server = fintoServer();
  server.su('GET', '/api/conversazioni?stato=aperte&limit=1', () => ({...elenco(['conv_Z']), conteggi: {aperte: 3, chiuse: 1, non_lette: 2}}));
  const casella = crea(server);
  await casella.aggiorna({conteggi: true});
  const {conteggi, righe} = casella.istantanea().elenco;
  assert.equal(conteggi.non_lette, 2);
  assert.deepEqual(righe, []);
});

test('risposta non riuscita con la conversazione chiusa sullo schermo: avviso', async () => {
  const server = fintoServer(), amb = ambiente({vista: 'conv_B'});
  server.su('GET', '/api/conversazioni/conv_B', () => dettaglio('conv_B', [entrata('msgc_5')]));
  server.su('POST', '/api/conversazioni/conv_A/messaggi', () => new Promise(r => setTimeout(() => r(new ErroreRichiesta('Network error', {stato: 0})), 5)));
  const casella = crea(server, amb);
  casella.apri('conv_A');
  await giri();
  const invio = casella.rispondi('conv_A', 'Ciao');
  casella.apri('conv_B');
  await invio;
  assert.equal(amb.avvisi.length, 1);
  assert.match(amb.avvisi[0], /not sent/i);
});
