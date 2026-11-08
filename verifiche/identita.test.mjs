import test from "node:test";
import assert from "node:assert/strict";
import {normalizeIshtarIdentity} from "../frontend/ishtar-lab/identita.mjs";

test("aggiorna la demo conservando prodotti, ID, quantita e relazioni", () => {
  const product = {id:"p1", name:"Nome reale", stock:7};
  const state = {
    staff:[{id:"noor",name:"Noor Haddad",email:"noor@saltmarshcandle.co"},{id:"lucia",name:"Lucía Ferreyra",email:"lucia@saltmarshcandle.co"}],
    settings:{store:"Saltmarsh Candle Co.",email:"hello@saltmarshcandle.co",phone:"01273 555 0148",address:"14 Kensington Gardens, Brighton BN1 4AL",vatNo:"GB 318 4420 61"},
    products:[product],orders:[{id:23,by:"noor",lines:[{pid:"p1",qty:2}],events:[{what:"Packed by Noor"}]}]
  };
  assert.equal(normalizeIshtarIdentity(state).changed,true);
  assert.equal(state.staff[0].name,"Reda Zahloul");
  assert.equal(state.staff[0].email,"ralreda54@gmail.com");
  assert.equal(state.staff[1].name,"Collaboratore Demo 3");
  assert.equal(state.settings.store,"Ishtar Hub");
  assert.equal(state.settings.address,"");
  assert.equal(state.products[0],product);
  assert.deepEqual(product,{id:"p1",name:"Nome reale",stock:7});
  assert.equal(state.orders[0].by,"noor");
  assert.deepEqual(state.orders[0].lines,[{pid:"p1",qty:2}]);
  assert.equal(state.orders[0].events[0].what,"Packed by Reda");
  assert.equal(normalizeIshtarIdentity(state).changed,false);
});

test("conserva anagrafiche e impostazioni personalizzate", () => {
  const state={staff:[{id:"lucia",name:"Persona configurata",email:"persona@negozio.test"}],settings:{store:"Nome scelto",email:"contatto@negozio.test",address:"Indirizzo configurato"},products:[{name:"Prodotto di Lucia"}]};
  const before=structuredClone(state);
  assert.equal(normalizeIshtarIdentity(state).changed,false);
  assert.deepEqual(state,before);
});
