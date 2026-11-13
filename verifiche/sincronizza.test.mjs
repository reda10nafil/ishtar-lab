import {test} from 'node:test';
import assert from 'node:assert/strict';
import {impronta,differenze,decidi,firmaProdotti,soloCampi} from '../frontend/ishtar-lab/catalogo/sincronizza.mjs';

const db=[{id:'p1',stock:4,price:420,cost:180,status:'active',incoming:0,reorder:3},{id:'p2',stock:0,price:90,cost:40}];
const legacy=(modifiche={})=>db.map(p=>({id:p.id,stock:p.stock,price:p.price,cost:p.cost,status:p.status??'draft',incoming:p.incoming??0,reorder:p.reorder??5,...(modifiche[p.id]||{})}));
const stato=(extra={})=>({orders:[{id:'1001'}],returns:[{id:'R1',step:1}],drafts:[{id:'D1'}],products:legacy(),...extra});

test('differenze: nessuna se lo stato demo coincide con il database (con i valori predefiniti)',()=>{
  assert.deepEqual(differenze(legacy(),db),[]);
});
test('differenze: rileva scorte, prezzo e stato modificati',()=>{
  assert.deepEqual(differenze(legacy({p1:{stock:5},p2:{price:95,status:'active'}}),db),[
    {id:'p1',campi:{stock:5,price:420,cost:180,status:'active',incoming:0,reorder:3},cambiati:['stock']},
    {id:'p2',campi:{stock:0,price:95,cost:40,status:'active',incoming:0,reorder:5},cambiati:['price','status']}]);
});
test('differenze: prodotti demo senza corrispondenza nel database ignorati',()=>{
  assert.deepEqual(differenze([{id:'candela',stock:1,price:1,cost:1}],db),[]);
});

test('impronta: cambia con nuovi ordini, resi che avanzano e bozze convertite',()=>{
  const base=impronta(stato());
  assert.notEqual(impronta(stato({orders:[{id:'1001'},{id:'1002'}]})),base);
  assert.notEqual(impronta(stato({returns:[{id:'R1',step:2}]})),base);
  assert.notEqual(impronta(stato({drafts:[]})),base);
});
test('impronta: non cambia se cambiano solo i prodotti',()=>{
  assert.equal(impronta(stato({products:legacy({p1:{stock:9}})})),impronta(stato()));
});

test('decidi: modifica della pagina Prodotti da salvare',()=>{
  assert.equal(decidi({rotta:'#/products/inventory',prima:'a',dopo:'a',differenze:[{id:'p1'}]}),'scrivi');
  assert.equal(decidi({rotta:'#/products',prima:'a',dopo:'a',differenze:[{id:'p1'}]}),'scrivi');
});
test('decidi: nuovo ordine aperto sopra la pagina Prodotti non tocca il database',()=>{
  assert.equal(decidi({rotta:'#/products/catalogue',prima:'a',dopo:'b',differenze:[{id:'p1'}]}),'ripristina');
});
test('decidi: cassa, ordini e resi in altre pagine non toccano il database',()=>{
  for(const rotta of ['#/channels/till','#/orders/all','#/orders/returns','#/home','','#/productsX'])
    assert.equal(decidi({rotta,prima:'a',dopo:'a',differenze:[{id:'p1'}]}),'ripristina',rotta);
});
test('decidi: senza differenze non serve fare nulla',()=>{
  assert.equal(decidi({rotta:'#/channels/till',prima:'a',dopo:'b',differenze:[]}),'nessuna');
});
test('differenze: indica i campi cambiati',()=>{
  assert.deepEqual(differenze(legacy({p1:{incoming:12}}),db)[0].cambiati,['incoming']);
});
test('decidi: «Pour» dalla Home (solo merce in arrivo) si salva, le scorte da altre pagine no',()=>{
  assert.equal(decidi({rotta:'#/home',prima:'a',dopo:'a',differenze:[{id:'p1',cambiati:['incoming']}]}),'scrivi');
  assert.equal(decidi({rotta:'#/home',prima:'a',dopo:'a',differenze:[{id:'p1',cambiati:['incoming','stock']}]}),'ripristina');
  assert.equal(decidi({rotta:'#/home',prima:'a',dopo:'b',differenze:[{id:'p1',cambiati:['incoming']}]}),'ripristina');
});
test('firmaProdotti: cambia con scorte, prezzi e stato dei prodotti, non con le altre parti della demo',()=>{
  const base=firmaProdotti(legacy());
  assert.notEqual(firmaProdotti(legacy({p1:{stock:9}})),base);
  assert.notEqual(firmaProdotti(legacy({p2:{price:91}})),base);
  assert.equal(firmaProdotti(legacy({p1:{notes:'testo',tint:3}})),base);
  assert.equal(firmaProdotti(stato({collections:[{id:'C1'}]}).products),base);
});
test('soloCampi: solo i campi salvati dal pannello, per riportare un prodotto ai valori del server',()=>{
  assert.deepEqual(soloCampi({id:'p1',name:'Borsa',stock:4,price:420,cost:180,status:'active',incoming:2,reorder:3,description:'x'}),
    {stock:4,price:420,cost:180,status:'active',incoming:2,reorder:3});
});
