// Quando una modifica dello stato dimostrativo può essere scritta nel database del catalogo.
// Tutte le azioni del pannello passano dalla stessa funzione di stato (evento ishtar:legacy-change): cassa, nuovo
// ordine, conversione di bozze e resi ricevuti cambiano anche le scorte, ma sono dati dimostrativi. Si salvano solo le
// modifiche fatte nella pagina Prodotti che non toccano ordini, resi o bozze; da altre pagine solo la merce in arrivo
// («Pour» della scheda Running low nella Home, stessa azione di «Ordina» nell'inventario). Le altre vengono annullate.
const CAMPI=['stock','price','cost','status','incoming','reorder'];
const PREDEFINITI={status:'draft',incoming:0,reorder:5};

export function differenze(prodottiDemo,prodottiDb){
  const risultato=[];
  for(const p of prodottiDb){
    const n=prodottiDemo.find(x=>x.id===p.id);if(!n)continue;
    const campi=Object.fromEntries(CAMPI.map(k=>[k,n[k]]));
    const cambiati=CAMPI.filter(k=>campi[k]!==(p[k]??PREDEFINITI[k]));
    if(!cambiati.length)continue;
    risultato.push({id:p.id,campi,cambiati});
  }
  return risultato;
}

// Impronta delle parti commerciali dello stato demo: cambia solo con ordini, resi e bozze, non con i prodotti.
export const impronta=stato=>JSON.stringify([
  (stato?.orders||[]).map(o=>o.id),
  (stato?.returns||[]).map(r=>`${r.id}:${r.step}`),
  (stato?.drafts||[]).map(d=>d.id),
]);

// Firma dei soli campi salvati nel catalogo: serve a capire se un'azione ha cambiato davvero scorte, prezzi o stato
// di un prodotto (e non, per esempio, una collezione dimostrativa).
// Campi salvati dal pannello: servono a riportare un prodotto ai valori del server quando una modifica viene rifiutata.
export const soloCampi=p=>Object.fromEntries(CAMPI.map(k=>[k,p?.[k]]));
export const firmaProdotti=prodotti=>JSON.stringify((prodotti||[]).map(p=>[p.id,...CAMPI.map(k=>p[k])]));

export function decidi({rotta,prima,dopo,differenze}){
  if(!differenze.length)return 'nessuna';
  if(prima!==dopo)return 'ripristina';
  if(/^#\/products(\/|$)/.test(rotta||''))return 'scrivi';
  return differenze.every(d=>Array.isArray(d.cambiati)&&d.cambiati.every(k=>k==='incoming'))?'scrivi':'ripristina';
}
