// Regole del collegamento tra pannello e catalogo, senza DOM né rete (verificate in verifiche/collegamento.test.mjs).
// La coda contiene solo i campi modificati di ogni prodotto (scorte, prezzi, stato, merce in arrivo, soglia): il corpo da
// inviare si compone al momento dell'invio dalla copia più recente del prodotto, così una modifica rimasta in attesa non
// riporta indietro descrizione, foto o campi salvati nel frattempo dalla scheda. Una modifica esce dalla coda solo quando
// il server ne conferma il salvataggio.

export const attesaRiprova=tentativo=>Math.min(30000,1000*2**Math.min(Math.max(tentativo,0),5));

// Errore interno del backend (per esempio database momentaneamente spento): si riprova per un numero limitato di volte.
export const LIMITE_ERRORI_SERVER=5;
// stato 0 = rete assente o ponte irraggiungibile (fetch fallita). 409 = conflitto di transazione in Medusa, da ripetere.
// 401 = credenziali del proprietario rifiutate anche dopo il rinnovo del ponte: la modifica resta finché non si correggono.
const DA_RIPETERE=[0,401,408,409,425,429,502,503,504];
export const esitoErrore=(stato,erroriServer=0)=>DA_RIPETERE.includes(stato)||(stato===500&&erroriServer<LIMITE_ERRORI_SERVER)?'riprova':'scarta';

// Catalogo riletto dal server mentre alcune modifiche aspettano ancora di essere salvate: quei campi restano come
// modificati sullo schermo, il resto del prodotto viene dal server.
export const conModificheInAttesa=(prodotti,coda)=>prodotti.map(p=>coda?.has(p.id)?{...p,...coda.get(p.id)}:p);

// Invia la coda in ordine. prodotto(id) restituisce la copia più recente nel pannello; invia(corpo) salva o lancia un errore
// con .stato. Si ferma al primo errore da ripetere (sospeso) lasciando la coda intatta; un dato rifiutato toglie solo
// quella modifica. Una versione più recente arrivata durante l'invio resta in coda e parte subito dopo. erroriServer conta
// gli errori interni (500) già ricevuti dalla modifica in testa: oltre LIMITE_ERRORI_SERVER viene scartata.
export async function svuotaCoda({coda,prodotto,invia,erroriServer=0}){
  const salvati=[],scartati=[];
  while(coda.size){
    const [id,campi]=coda.entries().next().value;
    const base=prodotto(id);
    if(!base){coda.delete(id);continue;}
    const corpo={...structuredClone(base),...campi};
    try{await invia(corpo);}
    catch(e){
      const stato=e.stato??500;
      if(esitoErrore(stato,erroriServer)==='riprova')return {salvati,scartati,sospeso:e,erroriServer:erroriServer+(stato===500?1:0)};
      if(coda.get(id)===campi)coda.delete(id);
      scartati.push({id,nome:base.name||base.sku,motivo:e.message});
      erroriServer=0;continue;
    }
    if(coda.get(id)===campi)coda.delete(id);
    salvati.push({id,corpo});
    erroriServer=0;
  }
  return {salvati,scartati,sospeso:null,erroriServer:0};
}
