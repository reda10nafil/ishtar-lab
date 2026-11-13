// Richieste della pagina Chats al ponte locale (frontend/ishtar-lab/chat/api.mjs), con un fetch finto.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {richiesta, ErroreRichiesta} from '../frontend/ishtar-lab/chat/api.mjs';

const finto = (stato, corpo, chiamate = []) => async (percorso, opzioni) => {
  chiamate.push({percorso, ...opzioni});
  return {ok: stato >= 200 && stato < 300, status: stato, json: async () => (typeof corpo === 'string' ? JSON.parse(corpo) : corpo)};
};

test('lettura: intestazione del pannello, nessun corpo', async () => {
  const chiamate = [];
  const dati = await richiesta('/api/conversazioni?stato=aperte', {fetch: finto(200, {conversazioni: []}, chiamate)});
  assert.deepEqual(dati, {conversazioni: []});
  assert.equal(chiamate.length, 1);
  assert.equal(chiamate[0].percorso, '/api/conversazioni?stato=aperte');
  assert.equal(chiamate[0].method, 'GET');
  assert.deepEqual(chiamate[0].headers, {'X-Ishtar-Local': '1'});
  assert.equal('body' in chiamate[0], false);
});

test('scrittura: corpo JSON con il suo tipo', async () => {
  const chiamate = [];
  await richiesta('/api/conversazioni/conv_1/messaggi', {metodo: 'POST', corpo: {testo: 'Ciao', id: 'x'.repeat(32)}, fetch: finto(200, {}, chiamate)});
  assert.equal(chiamate[0].method, 'POST');
  assert.deepEqual(chiamate[0].headers, {'X-Ishtar-Local': '1', 'Content-Type': 'application/json'});
  assert.equal(chiamate[0].body, JSON.stringify({testo: 'Ciao', id: 'x'.repeat(32)}));
});

test('eliminazione senza corpo', async () => {
  const chiamate = [];
  await richiesta('/api/risposte-rapide/rrap_1', {metodo: 'DELETE', fetch: finto(200, {eliminata: true}, chiamate)});
  assert.equal(chiamate[0].method, 'DELETE');
  assert.deepEqual(chiamate[0].headers, {'X-Ishtar-Local': '1'});
  assert.equal('body' in chiamate[0], false);
});

test('rete assente: stato 0', async () => {
  const errore = await richiesta('/api/conversazioni', {fetch: async () => { throw new TypeError('Failed to fetch'); }}).catch(e => e);
  assert.ok(errore instanceof ErroreRichiesta);
  assert.equal(errore.stato, 0);
});

test('risposta non JSON (pagina HTML di un proxy): stato HTTP', async () => {
  const errore = await richiesta('/api/conversazioni', {fetch: finto(502, '<html>')}).catch(e => e);
  assert.ok(errore instanceof ErroreRichiesta);
  assert.equal(errore.stato, 502);
});

test('rifiuto del server: messaggio, codice e dati (412 della chiusura)', async () => {
  const corpo = {message: 'The customer wrote again: read the new messages before closing', code: 'conflitto', nuovi: 2};
  const errore = await richiesta('/api/conversazioni/conv_1/stato', {metodo: 'POST', corpo: {stato: 'chiusa'}, fetch: finto(412, corpo)}).catch(e => e);
  assert.ok(errore instanceof ErroreRichiesta);
  assert.equal(errore.stato, 412);
  assert.equal(errore.message, corpo.message);
  assert.equal(errore.codice, 'conflitto');
  assert.equal(errore.dati.nuovi, 2);
});

test('200 con il corpo illeggibile: esito ignoto (stato 0), mai un rifiuto', async () => {
  const errore = await richiesta('/api/conversazioni/conv_1/messaggi', {metodo: 'POST', corpo: {}, fetch: async () => ({ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); }})}).catch(e => e);
  assert.ok(errore instanceof ErroreRichiesta);
  assert.equal(errore.stato, 0);
});
