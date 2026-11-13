// Conversione di una riga CSV in prodotto, senza DOM né rete: usata dall'adattatore e verificata in verifiche/importa.test.mjs.
// Per uno SKU già presente si parte dal prodotto esistente e cambiano solo le celle piene delle colonne associate:
// stato, foto, campi personalizzati e valori assenti dal file restano quelli salvati, senza essere riconvertiti.
import {numberCSV} from './csv.mjs';

export const normalizza=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9/]+/g,' ').trim();
const ALIAS={sku:'sku','codice articolo':'sku',nome:'name','nome prodotto':'name',name:'name',titolo:'name',title:'name',
  descrizione:'description',description:'description','prezzo vendita':'price',prezzo:'price',price:'price',
  'costo acquisto':'cost',costo:'cost',cost:'cost','quantita stock':'stock','quantita disponibile':'stock',quantita:'stock',
  stock:'stock',scorte:'stock',giacenza:'stock',categoria:'category',category:'category','taglia/variante':'size',taglia:'size',
  size:'size',genere:'gender',destinazione:'gender',gender:'gender',colore:'color',color:'color',materiale:'material',
  material:'material',composizione:'material','link foto':'photos',foto:'photos',immagine:'photos',immagini:'photos',
  images:'photos','tipo dati':'demo','dati dimostrativi':'demo',stato:'skip',status:'skip','campi fittizi':'custom','codice a barre':'custom'};
export const DESTINAZIONI={skip:'Non importare',sku:'SKU',name:'Nome',description:'Descrizione',category:'Categoria',gender:'Uomo / Donna / Unisex',
  size:'Taglia',color:'Colore',material:'Materiale',price:'Prezzo (€)',cost:'Costo (€)',stock:'Quantità',photos:'Foto (URL)',
  demo:'Dati dimostrativi',status:'Stato (bozza / attivo / archiviato)',custom:'Crea campo personalizzato'};
export const destinazione=intestazione=>ALIAS[normalizza(intestazione)]||'custom';

// Una cella piena che dopo la pulizia resta vuota («-», «—», «?») è un errore da mostrare in anteprima, non un valore assente.
const vuotaDopoPulizia=(v,n)=>!n&&String(v??'').trim()!=='';
const SI=['demo','dimostrativo','dimostrativi','si','true','vero','1','yes','x'],NO=['no','false','falso','0','reale'];
export function valoreDemo(v){
  const n=normalizza(v);
  if(!n){if(vuotaDopoPulizia(v,n))throw Error(`Dati dimostrativi: valore non riconosciuto «${v}» (usare DEMO/sì oppure no)`);return null;}
  if(SI.includes(n))return true;if(NO.includes(n))return false;
  throw Error(`Dati dimostrativi: valore non riconosciuto «${v}» (usare DEMO/sì oppure no)`);
}
const STATI={attivo:'active',attiva:'active',pubblicato:'active',pubblicata:'active',active:'active',published:'active',
  bozza:'draft',draft:'draft',archiviato:'archived',archiviata:'archived',archived:'archived'};
export function valoreStato(v){
  const n=normalizza(v);
  if(!n){if(vuotaDopoPulizia(v,n))throw Error(`Stato non riconosciuto «${v}» (usare bozza, attivo o archiviato)`);return null;}
  if(STATI[n])return STATI[n];
  throw Error(`Stato non riconosciuto «${v}» (usare bozza, attivo o archiviato)`);
}
const GENERI={uomo:'Uomo',donna:'Donna',unisex:'Unisex'};
function valoreGenere(v){const g=GENERI[normalizza(v)];if(!g)throw Error(`Genere «${v}» non riconosciuto: usare Uomo, Donna o Unisex`);return g;}
function valoreData(v,etichetta){
  const s=String(v).trim();let m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s),a,me,g;
  if(m)[a,me,g]=[+m[1],+m[2],+m[3]];else if((m=/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)))[g,me,a]=[+m[1],+m[2],+m[3]];
  const d=a?new Date(Date.UTC(a,me-1,g)):null;
  if(!d||d.getUTCFullYear()!==a||d.getUTCMonth()!==me-1||d.getUTCDate()!==g)throw Error(`${etichetta}: data non valida «${v}» (usare gg/mm/aaaa)`);
  return `${a}-${String(me).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
}

// Convenzione numerica di una colonna dedotta da tutte le sue celle: 'punto' se qualche valore usa il punto decimale
// (89.9, 145.00, 1,234.50), 'virgola' se qualche valore usa la virgola decimale (12,50, 1.234,50), null se non ci sono indizi.
export function convenzioneColonna(celle){
  let punto=false,virgola=false;
  for(const c of celle){
    const s=String(c??'').replace(/[€\s +]/g,'');if(!s)continue;
    if(/,\d{3}\.\d+$/.test(s)||(!s.includes(',')&&/\.(\d{1,2}|\d{4,})$/.test(s)))punto=true;
    if(/\.\d{3},\d+$/.test(s)||(!s.includes('.')&&/,(\d{1,2}|\d{4,})$/.test(s)))virgola=true;
  }
  return punto===virgola?null:punto?'punto':'virgola';
}
// Valori che senza convenzione di colonna potrebbero essere sia migliaia sia decimali (1.200, 1,000): da segnalare.
export const ambigui=celle=>celle.map(c=>String(c??'').trim()).filter(s=>/^\d{1,3}[.,]\d{3}$/.test(s));

const segnaposto=url=>String(url).includes('segnaposto-prodotto');
const presente=v=>v!==undefined&&v!==null&&v!=='';
const NUOVO={name:'',sku:'',description:'',category:'',gender:'Unisex',size:'',color:'',material:'',price:0,cost:0,stock:0,photos:[],custom:{},demo:false};

export function prodottoDaRiga(riga,{mappatura,campi=[],categorie=[],campiExtra={},esistente=null,convenzioni={}}){
  const p=esistente?structuredClone(esistente):structuredClone(NUOVO);
  p.custom={...(p.custom||{})};p.photos=[...(p.photos||[])];
  const dallaRiga=new Map();
  riga.forEach((cella,j)=>{
    const v=String(cella??'').trim();const chiave=mappatura[j];
    if(!v||!chiave||chiave==='skip')return;
    if(chiave==='custom'){const id=campiExtra[j];if(id){p.custom[id]=v;dallaRiga.set(id,j);}return;}
    if(['price','cost','stock'].includes(chiave)){p[chiave]=numberCSV(v,convenzioni[j]??null);return;}
    if(chiave==='demo'){p.demo=valoreDemo(v);return;}
    if(chiave==='status'){p.status=valoreStato(v);return;}
    if(chiave==='gender'){p.gender=valoreGenere(v);return;}
    if(chiave==='photos'){
      // L'URL del file diventa la copertina; più URL nella stessa cella separati da spazi o «|». Il segnaposto non
      // sostituisce foto vere; le foto già salvate restano dopo quelle nuove.
      const nuove=v.split(/[\s|]+/).filter(Boolean).filter(u=>!p.photos.includes(u));
      const vere=p.photos.filter(u=>!segnaposto(u));
      const daAggiungere=vere.length?nuove.filter(u=>!segnaposto(u)):nuove;
      if(daAggiungere.length)p.photos=vere.length?[...daAggiungere,...p.photos]:daAggiungere;
      if(p.photos.length>30)throw Error('Massimo 30 foto per prodotto');
      return;
    }
    p[chiave]=v;
  });
  if(!p.name||!p.sku)throw Error('Nome e SKU obbligatori');
  if(p.sku.length>80||/^https?:/.test(p.sku))throw Error('SKU non valido: usare il CSV demo normalizzato');
  const categoria=categorie.find(c=>c.name.toLowerCase()===String(p.category).toLowerCase());
  if(!categoria)throw Error('Categoria non riconosciuta');p.category=categoria.name;
  if(!Number.isInteger(p.stock))throw Error('La quantità deve essere intera');
  for(const f of campi){
    if(f.category&&f.category!==p.category)continue;
    // Si convertono solo i valori arrivati da questa riga: quelli già salvati, anche vuoti, restano com'erano.
    if(dallaRiga.has(f.id)){
      const v=p.custom[f.id];
      if(f.type==='number')p.custom[f.id]=numberCSV(v,convenzioni[dallaRiga.get(f.id)]??null);
      else if(f.type==='boolean'){const n=normalizza(v);if(SI.includes(n))p.custom[f.id]=true;else if(NO.includes(n))p.custom[f.id]=false;else throw Error(`${f.label}: usare sì o no («${v}»)`);}
      else if(f.type==='select'){const o=(f.options||[]).find(o=>normalizza(o)===normalizza(v));if(!o)throw Error(`${f.label}: valore non valido «${v}»`);p.custom[f.id]=o;}
      else if(f.type==='date')p.custom[f.id]=valoreData(v,f.label);
    }
    if(f.required&&!presente(p.custom[f.id]))throw Error(`Campo richiesto: ${f.label}`);
  }
  if(esistente)p.id=esistente.id;
  return p;
}

const CONFRONTATI=['name','description','category','gender','size','color','material','price','cost','stock','status','demo','photos','custom'];
export const campiCambiati=(prima,dopo)=>CONFRONTATI.filter(k=>JSON.stringify(prima?.[k]??null)!==JSON.stringify(dopo?.[k]??null));
