import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attesaRiprova,esitoErrore,conModificheInAttesa,svuotaCoda,LIMITE_ERRORI_SERVER} from '../frontend/ishtar-lab/catalogo/collegamento.mjs';

test('tentativi senza limite, con attesa crescente fino a 30 secondi',()=>{
  assert.deepEqual([0,1,2,3,4,5,6,50].map(attesaRiprova),[1000,2000,4000,8000,16000,30000,30000,30000]);
});
test('rete assente, server non disponibile, conflitto da ripetere o accesso da sistemare: si riprova',()=>{
  // 409 in Medusa = conflitto di transazione («You may retry the request»); 401 = credenziali del proprietario rifiutate
  // anche dopo il rinnovo del ponte: la modifica resta in coda finché la configurazione non viene corretta.
  for(const stato of [0,401,408,409,425,429,502,503,504])assert.equal(esitoErrore(stato,99),'riprova',String(stato));
});
test('errore interno del server: si riprova per un numero limitato di volte, poi si scarta',()=>{
  for(let tentativi=0;tentativi<LIMITE_ERRORI_SERVER;tentativi++)assert.equal(esitoErrore(500,tentativi),'riprova',String(tentativi));
  assert.equal(esitoErrore(500,LIMITE_ERRORI_SERVER),'scarta');
});
test('dati rifiutati o accesso negato dal ponte: si scarta solo quella modifica',()=>{
  for(const stato of [400,403,404,413,415,422])assert.equal(esitoErrore(stato,0),'scarta',String(stato));
});

const prodotti=()=>[{id:'p1',name:'Borsa',sku:'SKU-1',description:'nuova',stock:4,price:420},{id:'p2',name:'Sciarpa',sku:'SKU-2',description:'d2',stock:0,price:90}];
const errore=stato=>Object.assign(Error('motivo '+stato),{stato});

test('catalogo riletto con salvataggi in coda: restano i campi modificati, il resto viene dal server',()=>{
  const coda=new Map([['p1',{stock:9}],['p9',{stock:1}]]);
  const risultato=conModificheInAttesa(prodotti(),coda);
  assert.deepEqual(risultato,[{...prodotti()[0],stock:9},prodotti()[1]]);
});
test('catalogo riletto senza salvataggi in coda: prodotti del server invariati',()=>{
  assert.deepEqual(conModificheInAttesa(prodotti(),undefined),prodotti());
  assert.deepEqual(conModificheInAttesa(prodotti(),new Map()),prodotti());
});

test('coda: ogni invio parte dalla copia più recente del prodotto, non da una copia vecchia',async()=>{
  const inviati=[],coda=new Map([['p1',{stock:9}]]);
  const esito=await svuotaCoda({coda,prodotto:id=>prodotti().find(p=>p.id===id),invia:async c=>{inviati.push(c);}});
  assert.deepEqual(inviati,[{...prodotti()[0],stock:9}]);
  assert.equal(inviati[0].description,'nuova');
  assert.equal(coda.size,0);
  assert.deepEqual(esito.salvati.map(s=>s.id),['p1']);
});
test('coda: con il server non raggiungibile la modifica resta in testa e le altre aspettano',async()=>{
  const coda=new Map([['p1',{stock:9}],['p2',{stock:3}]]);let chiamate=0;
  const esito=await svuotaCoda({coda,prodotto:id=>prodotti().find(p=>p.id===id),invia:async()=>{chiamate++;throw errore(503);}});
  assert.equal(chiamate,1);
  assert.deepEqual([...coda.keys()],['p1','p2']);
  assert.equal(esito.sospeso.stato,503);
});
test('coda: la modifica in corso di invio resta in coda fino alla risposta del server',async()=>{
  const coda=new Map([['p1',{stock:9}]]);let durante;
  await svuotaCoda({coda,prodotto:id=>prodotti().find(p=>p.id===id),invia:async()=>{durante=coda.has('p1');}});
  assert.equal(durante,true);
});
test('coda: una modifica più recente arrivata durante l\'invio non viene persa',async()=>{
  const coda=new Map([['p1',{stock:9}]]);const inviati=[];
  await svuotaCoda({coda,prodotto:id=>prodotti().find(p=>p.id===id),invia:async c=>{inviati.push(c.stock);if(inviati.length===1)coda.set('p1',{stock:12});}});
  assert.deepEqual(inviati,[9,12]);
  assert.equal(coda.size,0);
});
test('coda: un dato rifiutato scarta solo quella modifica e le altre proseguono',async()=>{
  const coda=new Map([['p1',{stock:9}],['p2',{stock:3}]]);const inviati=[];
  const esito=await svuotaCoda({coda,prodotto:id=>prodotti().find(p=>p.id===id),invia:async c=>{if(c.id==='p1')throw errore(400);inviati.push(c.id);}});
  assert.deepEqual(inviati,['p2']);
  assert.equal(coda.size,0);
  assert.deepEqual(esito.scartati,[{id:'p1',nome:'Borsa',motivo:'motivo 400'}]);
  assert.equal(esito.sospeso,null);
});
test('coda: prodotto non più nel catalogo tolto senza invio',async()=>{
  const coda=new Map([['p7',{stock:1}]]);let chiamate=0;
  await svuotaCoda({coda,prodotto:id=>prodotti().find(p=>p.id===id),invia:async()=>{chiamate++;}});
  assert.equal(chiamate,0);
  assert.equal(coda.size,0);
});
test('coda: errore interno ripetuto oltre il limite scartato, prima no',async()=>{
  const fallisce=async()=>{throw errore(500);};
  const coda=new Map([['p1',{stock:9}]]);
  const primo=await svuotaCoda({coda,prodotto:id=>prodotti().find(p=>p.id===id),invia:fallisce,erroriServer:0});
  assert.equal(primo.sospeso.stato,500);
  assert.equal(primo.erroriServer,1);
  assert.equal(coda.size,1);
  const ultimo=await svuotaCoda({coda,prodotto:id=>prodotti().find(p=>p.id===id),invia:fallisce,erroriServer:LIMITE_ERRORI_SERVER});
  assert.equal(ultimo.sospeso,null);
  assert.equal(ultimo.scartati.length,1);
  assert.equal(ultimo.erroriServer,0);
  assert.equal(coda.size,0);
});
test('coda: il conteggio degli errori interni non si azzera se nel frattempo il server era spento',async()=>{
  const coda=new Map([['p1',{stock:9}]]);
  const esito=await svuotaCoda({coda,prodotto:id=>prodotti().find(p=>p.id===id),invia:async()=>{throw errore(503);},erroriServer:2});
  assert.equal(esito.erroriServer,2);
  assert.equal(coda.size,1);
});
