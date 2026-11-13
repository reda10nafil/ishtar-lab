// Regole del collegamento tra pannello e catalogo, senza DOM né rete (verificate in verifiche/collegamento.test.mjs).
// La coda contiene, per ogni prodotto, solo ciò che è cambiato: i campi rapidi (prezzo, costo, stato) con il valore da cui
// si è partiti e le variazioni di scorte e merce in arrivo, ciascuna con un id. Il server scrive un campo solo se il valore
// attuale è quello di partenza (altrimenti risponde 412) e non conta due volte una variazione già ricevuta: una finestra
// rimasta indietro non riscrive ciò che è cambiato altrove, e un invio ripetuto dopo un timeout è innocuo. Una modifica
// esce dalla coda solo quando il server ne conferma il salvataggio.

export const attesaRiprova=tentativo=>Math.min(30000,1000*2**Math.min(Math.max(tentativo,0),5));

// Errore interno del backend (per esempio database momentaneamente spento): si riprova per un numero limitato di volte.
export const LIMITE_ERRORI_SERVER=5;
// stato 0 = rete assente o ponte irraggiungibile (fetch fallita). 409 = conflitto di transazione in Medusa, da ripetere.
// 401 = credenziali del proprietario rifiutate anche dopo il rinnovo del ponte: la modifica resta finché non si correggono.
// 412 = valore cambiato altrove: non si ripete, il pannello lo dice e ricarica il catalogo.
const DA_RIPETERE=[0,401,408,409,425,429,502,503,504];
export const esitoErrore=(stato,erroriServer=0)=>DA_RIPETERE.includes(stato)||(stato===500&&erroriServer<LIMITE_ERRORI_SERVER)?'riprova':'scarta';

// Vuoto e assente sono la stessa cosa, come nel server (salvataggio.ts).
const normale=v=>v===undefined||v===null?'':v;
const uguale=(a,b)=>JSON.stringify(normale(a))===JSON.stringify(normale(b));
const RAPIDI=['price','cost','status'];
const vuota=voce=>!Object.keys(voce.campi).length&&!voce.movimenti.length;

// Registra in coda un'azione della pagina Prodotti: prima e dopo sono i valori rapidi del prodotto (sincronizza.mjs).
// Voce in coda: {campi:{campo:{prima:[…],dopo,inviato?}},movimenti:[{id,differenza,in_arrivo,motivo,inviato?}]}.
// Le variazioni non ancora inviate si sommano (cinque clic su + fanno un solo movimento); quella già partita non si
// tocca più, perché il server potrebbe averla ricevuta: si reinvia uguale, con lo stesso id.
export function registraModifica(coda,id,prima,dopo,nuovoId){
  const voce=coda.get(id)??{campi:{},movimenti:[]};
  for(const k of RAPIDI){
    if(uguale(prima[k],dopo[k]))continue;
    const c=voce.campi[k];
    if(!c){voce.campi[k]={prima:[prima[k]],dopo:dopo[k]};continue;}
    c.dopo=dopo[k];
    // Tornato al valore di partenza senza essere mai partito: niente da salvare. Se è già partito va inviato comunque.
    if(!c.inviato&&uguale(c.dopo,c.prima[0]))delete voce.campi[k];
  }
  const differenza=(dopo.stock??0)-(prima.stock??0),in_arrivo=(dopo.incoming??0)-(prima.incoming??0);
  if(differenza||in_arrivo){
    // «Ricevi» (la merce in arrivo passa in giacenza) e «Ordina»/«Pour» (nuova merce in arrivo) sono rifornimenti.
    const motivo=(differenza>0&&in_arrivo<0&&differenza===-in_arrivo)||(!differenza&&in_arrivo>0)?'rifornimento':'rettifica';
    const ultimo=voce.movimenti.at(-1),libero=ultimo&&!ultimo.inviato;
    if(libero&&ultimo.differenza===-differenza&&ultimo.in_arrivo===-in_arrivo)voce.movimenti.pop();
    else if(libero&&ultimo.motivo===motivo){ultimo.differenza+=differenza;ultimo.in_arrivo+=in_arrivo;if(!ultimo.differenza&&!ultimo.in_arrivo)voce.movimenti.pop();}
    else voce.movimenti.push({id:nuovoId(),differenza,in_arrivo,motivo});
  }
  if(vuota(voce))coda.delete(id);else coda.set(id,voce);
}

// Catalogo riletto mentre alcune modifiche aspettano ancora di essere salvate: quei campi restano come modificati e le
// variazioni in coda si sommano alle scorte del server; il resto del prodotto viene dal server.
export const conModificheInAttesa=(prodotti,coda)=>prodotti.map(p=>{
  const voce=coda?.get(p.id);if(!voce)return p;
  const r={...p};for(const [k,c] of Object.entries(voce.campi))r[k]=c.dopo;
  for(const m of voce.movimenti){r.stock=(r.stock??0)+m.differenza;r.incoming=(r.incoming??0)+m.in_arrivo;}
  return r;
});

// Parte rifiutata di un invio. Il server non scrive nulla di una modifica rifiutata, quindi esce solo ciò che è stato
// rifiutato: i campi in conflitto (412), le variazioni che consumano la merce in arrivo se quella è già stata ricevuta
// altrove, le variazioni se il server rifiuta le scorte (400 «scorte», per esempio più depositi). Senza indicazioni esce
// tutto ciò che era partito, tranne i campi cambiati di nuovo durante l'invio: così la coda non ripete lo stesso invio.
function parteRifiutata(e,inviati,partiti,voce){
  const campi=new Set(),movimenti=new Set(),mossi=voce.movimenti.filter(m=>partiti.has(m.id));
  if(e.stato===412&&Array.isArray(e.conflitti))for(const c of e.conflitti){
    if(c.campo in inviati)campi.add(c.campo);
    else if(c.campo==='incoming')for(const m of mossi){if(m.in_arrivo<0)movimenti.add(m.id);}
    else if(c.campo==='stock')for(const m of mossi)movimenti.add(m.id);
  }
  else if(e.codice==='scorte')for(const m of mossi)movimenti.add(m.id);
  if(!campi.size&&!movimenti.size){
    for(const k of Object.keys(inviati))if(uguale(voce.campi[k]?.dopo,inviati[k]))campi.add(k);
    for(const m of mossi)movimenti.add(m.id);
  }
  return {campi,movimenti};
}

// Invia la coda in ordine. prodotto(id) restituisce la copia più recente nel pannello (per SKU e nome); invia(corpo) salva
// e restituisce {product} con la scheda aggiornata, oppure lancia un errore con .stato; aggiorna(id,scheda) riallinea
// subito la copia del pannello. Si ferma al primo errore da ripetere (sospeso) lasciando la coda intatta; di una modifica
// rifiutata (dato non valido o 412) esce solo la parte rifiutata (parteRifiutata) e il resto riparte subito, con le stesse
// variazioni. erroriServer conta gli errori interni (500) già ricevuti dalla modifica in testa: oltre
// LIMITE_ERRORI_SERVER viene scartata.
export async function svuotaCoda({coda,prodotto,invia,aggiorna=()=>{},erroriServer=0}){
  const salvati=[],scartati=[];
  while(coda.size){
    const [id,voce]=coda.entries().next().value;
    const base=prodotto(id);
    if(!base){coda.delete(id);continue;}
    const corpo={modifica:{id,sku:base.sku,
      campi:Object.fromEntries(Object.entries(voce.campi).map(([k,c])=>[k,{prima:[...c.prima],dopo:c.dopo}])),
      movimenti:voce.movimenti.map(({id,differenza,in_arrivo,motivo})=>({id,differenza,in_arrivo,motivo}))}};
    // Da qui il server potrebbe avere i valori inviati anche se la risposta non arriva: valgono come partenza per un
    // invio successivo, e le variazioni partite non si sommano più ad altre.
    const inviati={};
    for(const [k,c] of Object.entries(voce.campi)){c.inviato=true;inviati[k]=c.dopo;if(!c.prima.some(v=>uguale(v,c.dopo)))c.prima.push(c.dopo);}
    const partiti=new Set(voce.movimenti.map(m=>{m.inviato=true;return m.id;}));
    let risposta;
    try{risposta=await invia(corpo);}
    catch(e){
      const stato=e.stato??500;
      if(esitoErrore(stato,erroriServer)==='riprova')return {salvati,scartati,sospeso:e,erroriServer:erroriServer+(stato===500?1:0)};
      const rifiutata=parteRifiutata(e,inviati,partiti,voce);
      for(const k of rifiutata.campi)delete voce.campi[k];
      voce.movimenti=voce.movimenti.filter(m=>!rifiutata.movimenti.has(m.id));
      if(vuota(voce)&&coda.get(id)===voce)coda.delete(id);
      scartati.push({id,nome:base.name||base.sku,motivo:e.message,conflitto:stato===412});
      erroriServer=0;continue;
    }
    // Salvata: resta solo ciò che è cambiato durante l'invio. Un campo inviato e poi cambiato parte dal valore appena
    // salvato; un campo aggiunto durante l'invio conserva il proprio valore di partenza.
    for(const [k,c] of Object.entries(voce.campi)){
      if(!(k in inviati))continue;
      if(uguale(c.dopo,inviati[k]))delete voce.campi[k];else voce.campi[k]={prima:[inviati[k]],dopo:c.dopo};
    }
    voce.movimenti=voce.movimenti.filter(m=>!partiti.has(m.id));
    if(vuota(voce)&&coda.get(id)===voce)coda.delete(id);
    if(risposta?.product)aggiorna(id,risposta.product);
    salvati.push({id,product:risposta?.product});
    erroriServer=0;
  }
  return {salvati,scartati,sospeso:null,erroriServer:0};
}

// Modifica dalla scheda prodotto o da una riga del CSV: solo i campi cambiati, con il valore da cui si è partiti (i campi
// personalizzati uno per uno), e la quantità scritta come conteggio, che il server accetta solo se le scorte sono ancora
// quelle lette; altrimenti risponde 412 e la scheda lo dice.
const SCHEDA=['name','description','category','gender','size','color','material','price','cost','status','demo','photos'];
export function modificaDaScheda(prima,dopo,nuovoId){
  const campi={};
  for(const k of SCHEDA)if(k in dopo&&!uguale(prima[k],dopo[k]))campi[k]={prima:[prima[k]??null],dopo:dopo[k]};
  for(const id of new Set([...Object.keys(prima.custom||{}),...Object.keys(dopo.custom||{})])){
    const a=prima.custom?.[id],b=dopo.custom?.[id];
    if(!uguale(a,b))campi['custom.'+id]={prima:[a??null],dopo:b??''};
  }
  const modifica={id:prima.id,sku:prima.sku,campi,movimenti:[]};
  if(Number.isInteger(dopo.stock)&&dopo.stock!==prima.stock)modifica.conteggio={id:nuovoId(),prima:[prima.stock],dopo:dopo.stock};
  return modifica;
}
