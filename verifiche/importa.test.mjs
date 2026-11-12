import {test} from 'node:test';
import assert from 'node:assert/strict';
import {destinazione,valoreDemo,valoreStato,prodottoDaRiga,campiCambiati,convenzioneColonna,ambigui,normalizza} from '../frontend/ishtar-lab/catalogo/importa.mjs';

const categorie=[{name:'Borse'},{name:'Pellicce'}];
const campi=[{id:'altezza',label:'Altezza (cm)',type:'number',category:'Borse',required:false},{id:'fodera',label:'Fodera',type:'text',category:'',required:true}];
const segnaposto='/brand/segnaposto-prodotto.svg';
const esistente={id:'prod_1',sku:'ISH-1',name:'Borsa Luna',description:'Pelle pieno fiore',category:'Borse',gender:'Donna',size:'Unica',color:'Nero',material:'Pelle',
  price:420,cost:180,stock:4,status:'active',incoming:2,reorder:3,demo:false,photos:['http://127.0.0.1:59730/ishtar-lab-assets/luna.png'],custom:{fodera:'Seta',altezza:32}};
const mappatura=['sku','name','price','stock','photos','description','custom'];
const conColonne=(riga,extra={})=>prodottoDaRiga(riga,{mappatura,campi,categorie,campiExtra:{6:'fodera'},...extra});

test('intestazioni riconosciute anche con accenti, simboli e maiuscole',()=>{
  assert.equal(destinazione('Quantità Stock'),'stock');assert.equal(destinazione('Quantita Stock'),'stock');
  assert.equal(destinazione('Prezzo (€)'),'price');assert.equal(destinazione('Prezzo Vendita'),'price');
  assert.equal(destinazione('Taglia/Variante'),'size');assert.equal(destinazione('Stato'),'skip');assert.equal(destinazione('Brand'),'custom');
});

test('aggiornamento: cambiano solo le celle piene, il resto del prodotto resta intatto',()=>{
  const p=conColonne(['ISH-1','Borsa Luna nera','','6','','',''],{esistente});
  assert.equal(p.id,'prod_1');assert.equal(p.name,'Borsa Luna nera');assert.equal(p.stock,6);
  assert.equal(p.price,420);assert.equal(p.description,'Pelle pieno fiore');assert.equal(p.status,'active');
  assert.equal(p.incoming,2);assert.equal(p.reorder,3);assert.equal(p.gender,'Donna');
  assert.deepEqual(p.photos,esistente.photos);assert.deepEqual(p.custom,{fodera:'Seta',altezza:32});
});

test('aggiornamento: il prodotto esistente non viene modificato in memoria',()=>{
  const copia=structuredClone(esistente);conColonne(['ISH-1','Altro nome','1','1','','',''],{esistente});
  assert.deepEqual(esistente,copia);
});

test('foto: il segnaposto non sostituisce né si aggiunge alle foto vere',()=>{
  assert.deepEqual(conColonne(['ISH-1','Borsa','','',segnaposto,'',''],{esistente}).photos,esistente.photos);
  const nuova='https://esempio.it/luna-retro.jpg';
  assert.deepEqual(conColonne(['ISH-1','Borsa','','',nuova,'',''],{esistente}).photos,[nuova,...esistente.photos]);
  const soloSegnaposto={...esistente,photos:[segnaposto]};
  assert.deepEqual(conColonne(['ISH-1','Borsa','','',nuova,'',''],{esistente:soloSegnaposto}).photos,[nuova]);
});

test('nuovo prodotto: valori predefiniti come prima',()=>{
  const p=prodottoDaRiga(['ISH-9','Stola','Pellicce','','',''],{mappatura:['sku','name','category','price','stock','photos'],campi:[],categorie,campiExtra:{}});
  assert.equal(p.id,undefined);assert.equal(p.category,'Pellicce');assert.equal(p.price,0);assert.equal(p.stock,0);
  assert.deepEqual(p.photos,[]);assert.equal(p.demo,false);assert.equal(p.gender,'Unisex');
});

test('nuovo prodotto: nome, SKU e categoria obbligatori',()=>{
  const m={mappatura:['sku','name','category'],campi:[],categorie,campiExtra:{}};
  assert.throws(()=>prodottoDaRiga(['ISH-9','','Borse'],m),/Nome e SKU/);
  assert.throws(()=>prodottoDaRiga(['ISH-9','Stola',''],m),/Categoria/);
  assert.throws(()=>prodottoDaRiga(['ISH-9','Stola','Scarpe'],m),/Categoria/);
});

test('aggiornamento: categoria vuota conservata, categoria indicata normalizzata',()=>{
  const m={mappatura:['sku','category'],campi:[],categorie,esistente,campiExtra:{}};
  assert.equal(prodottoDaRiga(['ISH-1',''],m).category,'Borse');assert.equal(prodottoDaRiga(['ISH-1','pellicce'],m).category,'Pellicce');
});

test('campo obbligatorio: vale il valore già salvato; per un nuovo prodotto manca',()=>{
  assert.equal(conColonne(['ISH-1','Borsa','','','','',''],{esistente}).custom.fodera,'Seta');
  assert.throws(()=>prodottoDaRiga(['ISH-2','Borsa','Borse',''],{mappatura:['sku','name','category','custom'],campi,categorie,campiExtra:{3:'fodera'}}),/Fodera/);
});

test('campi numerici personalizzati: migliaia lette bene e celle vuote conservate',()=>{
  const m={mappatura:['sku','custom'],campi,categorie,esistente,campiExtra:{1:'altezza'}};
  assert.equal(prodottoDaRiga(['ISH-1','1.200'],m).custom.altezza,1200);assert.equal(prodottoDaRiga(['ISH-1',''],m).custom.altezza,32);
});

test('scorte non intere rifiutate',()=>assert.throws(()=>conColonne(['ISH-1','Borsa','','2,5','','',''],{esistente}),/intera/));

test('dati dimostrativi: solo valori espliciti',()=>{
  for(const v of ['DEMO','demo','sì','Si','true','1','dimostrativo'])assert.equal(valoreDemo(v),true,v);
  for(const v of ['no','No','false','0','reale'])assert.equal(valoreDemo(v),false,v);
  assert.equal(valoreDemo(''),null);
  for(const v of ['Dati di sistema','Reale v1','forse'])assert.throws(()=>valoreDemo(v),/dimostrativi/);
});

test('stato: valori italiani e inglesi, altrimenti errore',()=>{
  assert.equal(valoreStato('Attivo'),'active');assert.equal(valoreStato('pubblicato'),'active');assert.equal(valoreStato('bozza'),'draft');
  assert.equal(valoreStato('archiviato'),'archived');assert.equal(valoreStato('active'),'active');assert.equal(valoreStato(''),null);
  assert.throws(()=>valoreStato('forse'),/Stato/);
});

test('campi cambiati per l’anteprima',()=>{
  const dopo=conColonne(['ISH-1','Borsa Luna nera','','6','','',''],{esistente});
  assert.deepEqual(campiCambiati(esistente,dopo),['name','stock']);
});

// Rilievi della revisione indipendente del 12/11
test('campo numerico salvato vuoto dalla scheda: invariato se il file non lo tocca',()=>{
  const salvato={...esistente,custom:{fodera:'Seta',altezza:''}};
  const p=prodottoDaRiga(['ISH-1','Borsa Luna'],{mappatura:['sku','name'],campi,categorie,esistente:salvato,campiExtra:{}});
  assert.equal(p.custom.altezza,'');assert.deepEqual(campiCambiati(salvato,p),[]);
});
test('celle piene ma senza contenuto utile rifiutate in anteprima',()=>{
  const m={mappatura:['sku','name','demo','price'],campi:[],categorie,esistente,campiExtra:{}};
  assert.throws(()=>prodottoDaRiga(['ISH-1','Borsa','-',''],m),/dimostrativi/);
  assert.throws(()=>prodottoDaRiga(['ISH-1','Borsa','','€'],m),/Numero non valido/);
});
test('convenzione numerica decisa per colonna',()=>{
  assert.equal(convenzioneColonna(['89.9','12.375','4200']),'punto');
  assert.equal(convenzioneColonna(['1.200','850']),null);
  assert.equal(convenzioneColonna(['12,50','1.200']),'virgola');
  assert.equal(convenzioneColonna(['1,234.50','1,000']),'punto');
  const m=c=>({mappatura:['sku','cost'],campi:[],categorie,esistente,campiExtra:{},convenzioni:{1:c}});
  assert.equal(prodottoDaRiga(['ISH-1','12.375'],m('punto')).cost,12.375);
  assert.equal(prodottoDaRiga(['ISH-1','1.200'],m(null)).cost,1200);
  assert.equal(prodottoDaRiga(['ISH-1','1,000'],m('punto')).cost,1000);
});
test('valori ambigui segnalati per l’anteprima',()=>{
  assert.deepEqual(ambigui(['1.200','850','12,50','1,000']),['1.200','1,000']);
});
test('foto: l’URL del file diventa copertina, più URL separati, massimo 30',()=>{
  const nuova='https://esempio.it/copertina.jpg',altra='https://esempio.it/retro.jpg';
  assert.deepEqual(conColonne(['ISH-1','Borsa','','',nuova,'',''],{esistente}).photos,[nuova,...esistente.photos]);
  assert.deepEqual(conColonne(['ISH-1','Borsa','','',`${nuova} | ${altra}`,'',''],{esistente}).photos,[nuova,altra,...esistente.photos]);
  const piena={...esistente,photos:Array.from({length:30},(_,i)=>`https://esempio.it/${i}.jpg`)};
  assert.throws(()=>conColonne(['ISH-1','Borsa','','',nuova,'',''],{esistente:piena}),/30 foto/);
});
test('genere, Sì/No, scelte e date convertiti nei valori del catalogo',()=>{
  const campiTipi=[{id:'pelle',label:'Pelle vera',type:'boolean',category:''},{id:'stagione',label:'Stagione',type:'select',options:['Inverno','Estate'],category:''},{id:'arrivo',label:'Arrivo',type:'date',category:''}];
  const m={mappatura:['sku','gender','custom','custom','custom'],campi:campiTipi,categorie,esistente,campiExtra:{2:'pelle',3:'stagione',4:'arrivo'}};
  const p=prodottoDaRiga(['ISH-1','donna','Sì','inverno','05/03/2027'],m);
  assert.equal(p.gender,'Donna');assert.equal(p.custom.pelle,true);assert.equal(p.custom.stagione,'Inverno');assert.equal(p.custom.arrivo,'2027-03-05');
  assert.throws(()=>prodottoDaRiga(['ISH-1','bambino','','',''],m),/Uomo, Donna o Unisex/);
  assert.throws(()=>prodottoDaRiga(['ISH-1','','','primavera',''],m),/Stagione/);
  assert.throws(()=>prodottoDaRiga(['ISH-1','','','','31/02/2027'],m),/Arrivo/);
});
test('intestazioni usate dal pannello e campi personalizzati riconosciuti',()=>{
  assert.equal(destinazione('Quantità disponibile'),'stock');assert.equal(destinazione('Nome prodotto'),'name');assert.equal(destinazione('Destinazione'),'gender');
  assert.equal(destinazione('Dati dimostrativi'),'demo');assert.equal(destinazione('Immagini'),'photos');assert.equal(destinazione('Status'),'skip');
  assert.equal(normalizza('Altezza (cm)'),normalizza('altezza  (CM)'));
});
test('colonne del costo d\'acquisto riconosciute come costo: non diventano campi personalizzati',()=>{
  for(const intestazione of ['Prezzo acquisto','Prezzo d\'acquisto','Costo d\'acquisto','Costo unitario','Prezzo fornitore','Costo fornitore','Purchase price','Unit cost'])
    assert.equal(destinazione(intestazione),'cost',intestazione);
});
