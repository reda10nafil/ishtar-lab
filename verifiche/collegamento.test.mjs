import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attesaRiprova,esitoErrore,conModificheInAttesa,svuotaCoda,registraModifica,modificaDaScheda,LIMITE_ERRORI_SERVER} from '../frontend/ishtar-lab/catalogo/collegamento.mjs';

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

test('risposta 412 (valore cambiato altrove): non si ripete, la modifica viene scartata',()=>{
  assert.equal(esitoErrore(412,0),'scarta');
});

// Valori del pannello prima e dopo un'azione della pagina Prodotti (sincronizza.mjs, campi rapidi).
const rapidi=(extra={})=>({stock:4,price:420,cost:180,status:'active',incoming:0,reorder:5,...extra});
const contatore=()=>{let n=0;return ()=>`m${++n}`;};
const prodotti=()=>[{id:'p1',name:'Borsa',sku:'SKU-1',description:'nuova',stock:4,price:420,incoming:0},{id:'p2',name:'Sciarpa',sku:'SKU-2',description:'d2',stock:0,price:90,incoming:0}];
const errore=(stato,extra={})=>Object.assign(Error('motivo '+stato),{stato,...extra});
const trova=id=>prodotti().find(p=>p.id===id);

test('prezzo cambiato: in coda il solo campo, con il valore da cui si è partiti',()=>{
  const coda=new Map();registraModifica(coda,'p1',rapidi(),rapidi({price:430}),contatore());
  assert.deepEqual(coda.get('p1').campi,{price:{prima:[420],dopo:430}});
  assert.deepEqual(coda.get('p1').movimenti,[]);
});
test('prezzo cambiato due volte prima dell\'invio: resta il valore di partenza; riportato com\'era: niente da inviare',()=>{
  const coda=new Map(),id=contatore();
  registraModifica(coda,'p1',rapidi(),rapidi({price:430}),id);registraModifica(coda,'p1',rapidi({price:430}),rapidi({price:440}),id);
  assert.deepEqual(coda.get('p1').campi.price,{prima:[420],dopo:440});
  registraModifica(coda,'p1',rapidi({price:440}),rapidi(),id);
  assert.equal(coda.has('p1'),false);
});
test('+1 tre volte: una sola variazione +3 con un id; +1 e −1: nessuna variazione',()=>{
  const coda=new Map(),id=contatore();
  for(let s=4;s<7;s++)registraModifica(coda,'p1',rapidi({stock:s}),rapidi({stock:s+1}),id);
  assert.deepEqual(coda.get('p1').movimenti,[{id:'m1',differenza:3,in_arrivo:0,motivo:'rettifica'}]);
  const altra=new Map();registraModifica(altra,'p2',rapidi(),rapidi({stock:5}),id);registraModifica(altra,'p2',rapidi({stock:5}),rapidi(),id);
  assert.equal(altra.has('p2'),false);
});
test('«Ricevi» e «Ordina» sono rifornimenti (Ordina cambia solo la merce in arrivo); annullare «Ricevi» prima dell\'invio non lascia nulla',()=>{
  const coda=new Map(),id=contatore();
  registraModifica(coda,'p1',rapidi({incoming:5}),rapidi({stock:9,incoming:0}),id);
  assert.deepEqual(coda.get('p1').movimenti,[{id:'m1',differenza:5,in_arrivo:-5,motivo:'rifornimento'}]);
  registraModifica(coda,'p1',rapidi({stock:9,incoming:0}),rapidi({incoming:5}),id);
  assert.equal(coda.has('p1'),false);
  registraModifica(coda,'p2',rapidi(),rapidi({incoming:6}),id);
  assert.deepEqual(coda.get('p2').movimenti,[{id:'m2',differenza:0,in_arrivo:6,motivo:'rifornimento'}]);
});
test('corpo inviato: id, SKU, soli campi cambiati con il valore di partenza e variazioni con il loro id',async()=>{
  const coda=new Map(),inviati=[],id=contatore();
  registraModifica(coda,'p1',rapidi(),rapidi({price:430,stock:6}),id);
  await svuotaCoda({coda,prodotto:trova,invia:async c=>{inviati.push(structuredClone(c));return {product:{...trova('p1'),price:430,stock:6}};}});
  assert.deepEqual(inviati,[{modifica:{id:'p1',sku:'SKU-1',campi:{price:{prima:[420],dopo:430}},movimenti:[{id:'m1',differenza:2,in_arrivo:0,motivo:'rettifica'}]}}]);
});
test('dopo la risposta la modifica esce dalla coda e la copia del prodotto si aggiorna con quella del server',async()=>{
  const coda=new Map(),aggiornati=[];registraModifica(coda,'p1',rapidi(),rapidi({price:430}),contatore());
  const esito=await svuotaCoda({coda,prodotto:trova,invia:async()=>({product:{...trova('p1'),price:430,stock:3}}),aggiorna:(id,p)=>aggiornati.push([id,p.stock])});
  assert.equal(coda.size,0);
  assert.deepEqual(aggiornati,[['p1',3]]);
  assert.deepEqual(esito.salvati.map(s=>s.id),['p1']);
});
test('server non raggiungibile: la modifica resta in testa, le altre aspettano, e al nuovo invio le variazioni hanno lo stesso id',async()=>{
  const coda=new Map(),id=contatore(),inviati=[];
  registraModifica(coda,'p1',rapidi(),rapidi({stock:5}),id);registraModifica(coda,'p2',rapidi(),rapidi({price:95}),id);
  const esito=await svuotaCoda({coda,prodotto:trova,invia:async c=>{inviati.push(c.modifica.movimenti.map(m=>m.id));throw errore(503);}});
  assert.equal(esito.sospeso.stato,503);assert.deepEqual([...coda.keys()],['p1','p2']);
  registraModifica(coda,'p1',rapidi({stock:5}),rapidi({stock:6}),id);
  await svuotaCoda({coda,prodotto:trova,invia:async c=>{inviati.push(c.modifica.movimenti.map(m=>m.id));return {product:trova(c.modifica.id)};}});
  // La prima variazione, forse già salvata, riparte con lo stesso id (il server non la conta due volte); quella nuova ha un id suo.
  assert.deepEqual(inviati,[['m1'],['m1','m2'],[]]);
});
test('prezzo cambiato di nuovo dopo un invio senza risposta: vale come partenza anche il valore inviato, e tornare a quello di prima si invia',async()=>{
  const coda=new Map(),id=contatore();registraModifica(coda,'p1',rapidi(),rapidi({price:430}),id);
  await svuotaCoda({coda,prodotto:trova,invia:async()=>{throw errore(0);}});
  registraModifica(coda,'p1',rapidi({price:430}),rapidi({price:440}),id);
  assert.deepEqual(coda.get('p1').campi.price,{prima:[420,430],dopo:440,inviato:true});
  registraModifica(coda,'p1',rapidi({price:440}),rapidi(),id);
  assert.equal(coda.get('p1').campi.price.dopo,420);
});
test('modifica arrivata durante l\'invio: resta in coda e parte dal valore confermato dal server',async()=>{
  const coda=new Map(),id=contatore(),inviati=[];registraModifica(coda,'p1',rapidi(),rapidi({price:430}),id);
  await svuotaCoda({coda,prodotto:trova,invia:async c=>{inviati.push(structuredClone(c.modifica.campi));
    if(inviati.length===1)registraModifica(coda,'p1',rapidi({price:430}),rapidi({price:450,stock:5}),id);return {product:{...trova('p1'),price:c.modifica.campi.price.dopo}};}});
  assert.deepEqual(inviati,[{price:{prima:[420],dopo:430}},{price:{prima:[430],dopo:450}}]);
  assert.equal(coda.size,0);
});
test('valore cambiato altrove (412): modifica scartata e segnalata come conflitto, le altre proseguono',async()=>{
  const coda=new Map(),id=contatore(),inviati=[];
  registraModifica(coda,'p1',rapidi(),rapidi({price:430}),id);registraModifica(coda,'p2',rapidi(),rapidi({stock:5}),id);
  const esito=await svuotaCoda({coda,prodotto:trova,invia:async c=>{if(c.modifica.id==='p1')throw errore(412,{conflitti:[{campo:'price',attuale:450}]});inviati.push(c.modifica.id);return {product:trova('p2')};}});
  assert.deepEqual(inviati,['p2']);assert.equal(coda.size,0);
  assert.deepEqual(esito.scartati,[{id:'p1',nome:'Borsa',motivo:'motivo 412',conflitto:true}]);
});
test('412 sul prezzo: esce solo il prezzo, la variazione di scorte della stessa modifica riparte subito con lo stesso id',async()=>{
  const coda=new Map(),id=contatore(),corpi=[];
  registraModifica(coda,'p1',rapidi(),rapidi({price:430,stock:7}),id);
  const esito=await svuotaCoda({coda,prodotto:trova,invia:async c=>{corpi.push(structuredClone(c.modifica));
    if(corpi.length===1)throw errore(412,{conflitti:[{campo:'price',attuale:450,tuo:430}]});return {product:{...trova('p1'),stock:7}};}});
  assert.deepEqual(corpi.map(c=>[Object.keys(c.campi),c.movimenti.map(m=>m.id)]),[[['price'],['m1']],[[],['m1']]]);
  assert.equal(coda.size,0);assert.deepEqual(esito.salvati.map(s=>s.id),['p1']);assert.equal(esito.scartati[0].conflitto,true);
});
test('«Ricevi» già fatto altrove (412 sulla merce in arrivo): esce solo il «Ricevi», il + della stessa modifica si salva',async()=>{
  const coda=new Map(),id=contatore(),corpi=[];
  registraModifica(coda,'p1',rapidi({incoming:4}),rapidi({stock:8,incoming:0}),id);registraModifica(coda,'p1',rapidi({stock:8,incoming:0}),rapidi({stock:9,incoming:0}),id);
  await svuotaCoda({coda,prodotto:trova,invia:async c=>{corpi.push(c.modifica.movimenti.map(m=>`${m.id}:${m.differenza}/${m.in_arrivo}`));
    if(corpi.length===1)throw errore(412,{conflitti:[{campo:'incoming',attuale:0}]});return {product:trova('p1')};}});
  assert.deepEqual(corpi,[['m1:4/-4','m2:1/0'],['m2:1/0']]);assert.equal(coda.size,0);
});
test('scorte rifiutate (400 «scorte», per esempio più depositi): escono le variazioni, prezzo e stato si salvano',async()=>{
  const coda=new Map(),id=contatore(),corpi=[];registraModifica(coda,'p1',rapidi(),rapidi({price:430,status:'draft',stock:5}),id);
  await svuotaCoda({coda,prodotto:trova,invia:async c=>{corpi.push([Object.keys(c.modifica.campi).sort(),c.modifica.movimenti.length]);
    if(corpi.length===1)throw errore(400,{codice:'scorte'});return {product:trova('p1')};}});
  assert.deepEqual(corpi,[[['price','status'],1],[['price','status'],0]]);assert.equal(coda.size,0);
});
test('rifiuto senza indicazioni (400): esce ciò che era partito; quello che si è cambiato durante l\'invio resta e parte',async()=>{
  const coda=new Map(),id=contatore(),corpi=[];registraModifica(coda,'p1',rapidi(),rapidi({price:430}),id);
  await svuotaCoda({coda,prodotto:trova,invia:async c=>{corpi.push(structuredClone(c.modifica));
    if(corpi.length===1){registraModifica(coda,'p1',rapidi({price:430}),rapidi({price:430,stock:6}),id);throw errore(400);}return {product:trova('p1')};}});
  assert.deepEqual(corpi.map(c=>[Object.keys(c.campi),c.movimenti.map(m=>m.differenza)]),[[['price'],[]],[[],[2]]]);assert.equal(coda.size,0);
});
test('dato rifiutato (400): scartata solo quella modifica, senza conflitto',async()=>{
  const coda=new Map();registraModifica(coda,'p1',rapidi(),rapidi({price:430}),contatore());
  const esito=await svuotaCoda({coda,prodotto:trova,invia:async()=>{throw errore(400);}});
  assert.deepEqual(esito.scartati,[{id:'p1',nome:'Borsa',motivo:'motivo 400',conflitto:false}]);assert.equal(esito.sospeso,null);
});
test('prodotto non più nel catalogo: tolto dalla coda senza invio',async()=>{
  const coda=new Map();registraModifica(coda,'p7',rapidi(),rapidi({stock:5}),contatore());let chiamate=0;
  await svuotaCoda({coda,prodotto:trova,invia:async()=>{chiamate++;}});
  assert.equal(chiamate,0);assert.equal(coda.size,0);
});
test('errore interno ripetuto oltre il limite: scartato, prima no; il conteggio non si azzera se il server era spento',async()=>{
  const fallisce=stato=>async()=>{throw errore(stato);};
  const coda=new Map();registraModifica(coda,'p1',rapidi(),rapidi({stock:5}),contatore());
  const primo=await svuotaCoda({coda,prodotto:trova,invia:fallisce(500),erroriServer:0});
  assert.equal(primo.sospeso.stato,500);assert.equal(primo.erroriServer,1);assert.equal(coda.size,1);
  assert.equal((await svuotaCoda({coda,prodotto:trova,invia:fallisce(503),erroriServer:2})).erroriServer,2);
  const ultimo=await svuotaCoda({coda,prodotto:trova,invia:fallisce(500),erroriServer:LIMITE_ERRORI_SERVER});
  assert.equal(ultimo.sospeso,null);assert.equal(ultimo.scartati.length,1);assert.equal(ultimo.erroriServer,0);assert.equal(coda.size,0);
});
test('catalogo riletto con modifiche in coda: campi in attesa e variazioni sommate, il resto dal server',()=>{
  const coda=new Map(),id=contatore();
  registraModifica(coda,'p1',rapidi(),rapidi({price:430,stock:7}),id);registraModifica(coda,'p9',rapidi(),rapidi({stock:5}),id);
  assert.deepEqual(conModificheInAttesa(prodotti(),coda),[{...prodotti()[0],price:430,stock:7},prodotti()[1]]);
  assert.deepEqual(conModificheInAttesa(prodotti(),undefined),prodotti());
});
test('scheda e CSV: soli campi cambiati con il valore di partenza, campi personalizzati uno per uno, scorte come conteggio',()=>{
  const prima={id:'p1',sku:'SKU-1',name:'Borsa',description:'Pelle',stock:4,price:420,photos:['a'],custom:{fodera:'Seta',vuoto:''}};
  const dopo={...prima,name:'Borsa nera',stock:6,photos:['a','b'],custom:{fodera:'Lino',vuoto:'',nuovo:'x'}};
  assert.deepEqual(modificaDaScheda(prima,dopo,contatore()),{id:'p1',sku:'SKU-1',movimenti:[],
    campi:{name:{prima:['Borsa'],dopo:'Borsa nera'},photos:{prima:[['a']],dopo:['a','b']},'custom.fodera':{prima:['Seta'],dopo:'Lino'},'custom.nuovo':{prima:[null],dopo:'x'}},
    conteggio:{id:'m1',prima:[4],dopo:6}});
});
test('scheda salvata senza cambiare nulla: modifica vuota (nessun conteggio, vuoto e assente sono uguali)',()=>{
  const prima={id:'p1',sku:'SKU-1',name:'Borsa',stock:4,custom:{}};
  assert.deepEqual(modificaDaScheda(prima,{...prima,custom:{fodera:''}},contatore()),{id:'p1',sku:'SKU-1',campi:{},movimenti:[]});
});
