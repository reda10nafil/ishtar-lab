import {J as runtime, wt as legacy, it as mutateLegacy, F as nativeToast} from '../assets/kit-BLRx7j0_.js';
import OriginalProducts from '../assets/products-DkARKCT7.js';
import {parseCSV} from './csv.mjs';
import {destinazione,DESTINAZIONI,prodottoDaRiga,campiCambiati,convenzioneColonna,ambigui,normalizza} from './importa.mjs';
import {impronta,differenze,decidi,firmaProdotti,soloCampi} from './sincronizza.mjs';
import {attesaRiprova,conModificheInAttesa,svuotaCoda} from './collegamento.mjs';
import '../branding-ui.mjs';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(v??0);
const placeholder='/brand/segnaposto-prodotto.svg';
// Messaggio come frase compiuta, per accodarlo ad altro testo negli avvisi.
const frase=s=>{s=String(s??'').trim();return !s||/[.!?…]$/.test(s)?s:s+'.';};
const options=(items,selected)=>items.map(v=>`<option value="${h(v)}" ${v===selected?'selected':''}>${h(v)}</option>`).join('');
async function api(path='/api/catalogo',body){
  const form=body instanceof FormData;
  // Ogni errore porta lo stato HTTP (0 = rete o ponte irraggiungibili) per decidere se riprovare (collegamento.mjs).
  const fallito=(messaggio,stato)=>Object.assign(Error(messaggio),{stato});
  let response;
  try{response=await fetch(path,{method:body?'POST':'GET',headers:{'X-Ishtar-Local':'1',...(body&&!form?{'Content-Type':'application/json'}:{})},...(body?{body:form?body:JSON.stringify(body)}:{})});}
  catch{throw fallito('Server del catalogo non raggiungibile',0);}
  let data;try{data=await response.json();}catch{throw fallito(`Richiesta non riuscita (${response.status})`,response.status);}
  if(!response.ok)throw fallito(data.message||`Errore ${response.status}`,response.status);return data;
}

class Catalogo extends HTMLElement {
  connectedCallback(){this.data={products:[],fields:[],categories:[]};this.search='';this.filter='';this.busy=false;this.renderLoading();this.load();
    this.route=()=>this.render();window.addEventListener('hashchange',this.route);}
  disconnectedCallback(){window.removeEventListener('hashchange',this.route);this.dialog?.close();}
  renderLoading(){this.innerHTML='<div class="il-message" role="status">Collegamento al catalogo Ishtar Lab…</div>';}
  async load(){
    if(this.loading)return;this.loading=true;
    // Senza limite di tentativi: attesa crescente fino a 30 s, più un tentativo immediato al ritorno della rete o della pagina.
    try{await this.leggi();}
    catch(e){if(!this.ready)this.firmaDemo??=firmaProdotti(legacy.products);if(!this.retries)this.notice(e.message,true);this.offline=true;this.motivoLettura=frase(e.message);
      this.retries=(this.retries||0)+1;clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>this.load(),attesaRiprova(this.retries-1));}
    finally{this.loading=false;this.statoCollegamento?.();}
  }
  notice(message,error=false){const el=this.querySelector('.il-notice');if(el){el.textContent=message;el.className='il-notice '+(error?'il-error':'');el.setAttribute('role',error?'alert':'status');}}
  modal(title,body,wide=false){this.dialog?.close();this.dialog?.remove();const dialog=document.createElement('dialog');dialog.className='il-dialog modal glass '+(wide?'modal--wide':'');
    dialog.setAttribute('aria-label',title);
    dialog.innerHTML=`<header><h2>${h(title)}</h2><button type="button" class="il-close" aria-label="Chiudi finestra">×</button></header><div class="il-dialog-body">${body}</div>`;this.append(dialog);this.dialog=dialog;dialog.querySelectorAll('input:not([type=checkbox]):not([type=file])').forEach(x=>x.classList.add('input'));dialog.querySelectorAll('select').forEach(x=>x.classList.add('select'));dialog.querySelectorAll('textarea').forEach(x=>x.classList.add('textarea'));dialog.querySelectorAll('button').forEach(x=>{x.classList.add('btn');if(x.classList.contains('il-primary'))x.classList.add('btn--primary');});dialog.querySelectorAll('.il-field').forEach(x=>x.classList.add('field'));dialog.querySelectorAll('.il-form-grid').forEach(x=>x.classList.add('formgrid'));
    dialog.querySelector('.il-close').onclick=()=>{if(this.busy)return;dialog.close();dialog.remove();};dialog.addEventListener('cancel',e=>{if(this.busy)e.preventDefault();});dialog.showModal();return dialog;}
  field(label,name,value,type='text',extra=''){return `<label class="il-field"><span>${h(label)}</span><input name="${h(name)}" type="${type}" value="${h(value)}" ${extra}></label>`;}
  license(){this.modal('Ishtar Lab · Licenza','<p><strong>Contributi Ishtar © 2026 Reda Zahloul.</strong></p><p>Uso personale e non commerciale secondo la licenza Ishtar. Per modificare il codice occorre il permesso scritto di Reda Zahloul. L’uso commerciale richiede un accordo scritto separato.</p><p>I sorgenti delle modifiche autorizzate vanno restituiti entro 30 giorni a <a href="mailto:ralreda54@gmail.com">ralreda54@gmail.com</a>.</p><p><a class="btn" href="/legal/LICENSE-Ishtar.txt" target="_blank" rel="noopener">Leggi la licenza completa</a></p><p class="il-help">Le condizioni Ishtar riguardano i contributi di cui il titolare dispone. Le librerie mantengono i propri termini.</p>');}
  edit(original){const p=structuredClone(original||{name:'',sku:'',category:this.data.categories[0]?.name,description:'',size:'',color:'',gender:'Unisex',material:'',price:0,cost:0,stock:0,photos:[],custom:{},demo:false});
    const dialog=this.modal(original?'Modifica prodotto':'Nuovo prodotto',`<form id="il-product-form"><nav class="il-tabs" aria-label="Sezioni scheda prodotto">${['Dettagli','Varianti e scorte','Foto','Campi personalizzati'].map((t,i)=>`<button type="button" data-tab="${i}" class="${i===0?'il-selected':''}">${t}</button>`).join('')}</nav>
    <section data-panel="0"><div class="il-form-grid">${this.field('Nome prodotto','name',p.name,'text','required maxlength="200"')}${this.field('SKU / codice articolo','sku',p.sku,'text',`required maxlength="80" ${original?'readonly':''}`)}<label class="il-field"><span>Categoria</span><select name="category">${options(this.data.categories.map(c=>c.name),p.category)}</select></label><label class="il-field"><span>Destinazione</span><select name="gender">${options(p.gender?[...new Set(['Uomo','Donna','Unisex',p.gender])]:['','Uomo','Donna','Unisex'],p.gender)}</select></label>${this.field('Materiale / composizione','material',p.material)}<label class="il-field il-full"><span>Descrizione</span><textarea name="description" rows="5">${h(p.description)}</textarea></label></div></section>
    <section data-panel="1" hidden><div class="il-form-grid">${this.field('Taglia','size',p.size)}<label class="il-field"><span>Colore</span><input name="color" value="${h(p.color)}" list="il-colors"><datalist id="il-colors">${options(['Nero','Avorio','Blu notte','Verde smeraldo','Rosso rubino','Bordeaux','Rosa cipria','Lilla','Cioccolato'])}</datalist></label>${this.field('Prezzo vendita (€)','price',p.price,'number','min="0" step="0.01" required')}${this.field('Costo acquisto (€)','cost',p.cost,'number','min="0" step="0.01" required')}${this.field('Quantità disponibile','stock',p.stock,'number','min="0" step="1" required')}</div><p class="il-help">Ogni SKU è un articolo vendibile. Taglia, colore, prezzo e giacenza vengono salvati nel database.</p></section>
    <section data-panel="2" hidden><p>Carica più foto, scegli la copertina o aggiungi un URL.</p><label class="il-upload">＋ Carica foto<input type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label="Carica foto prodotto"></label><div class="il-photo-add"><input type="url" aria-label="URL foto" placeholder="https://…"><button type="button" data-add-url>Aggiungi URL</button></div><div class="il-gallery"></div></section>
    <section data-panel="3" hidden><div class="il-form-grid" id="il-custom"></div><p class="il-help">Aggiungi altri campi da “Personalizza campi” nella pagina Prodotti.</p></section>
    <p class="il-form-error" role="alert"></p><footer><span>${p.demo?'Dati dimostrativi · ':''}Salvataggio nel database Ishtar Lab</span><button class="il-primary" type="submit">Salva prodotto</button></footer></form>`);
    const form=dialog.querySelector('form');
    dialog.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{dialog.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('il-selected',x===b));dialog.querySelectorAll('[data-panel]').forEach(x=>x.hidden=x.dataset.panel!==b.dataset.tab);});
    // Un campo obbligatorio aggiunto dopo non blocca la scheda di un prodotto che ancora non lo ha: è richiesto per un
    // prodotto nuovo, se ha già un valore o se il prodotto passa nella categoria del campo (stessa regola del server).
    const richiesto=f=>f.required&&(!original||(f.category&&form.elements.category.value!==original.category)||![undefined,null,''].includes(original.custom?.[f.id]));
    const renderCustom=()=>{const existing=Object.fromEntries(new FormData(form));Object.assign(p.custom,Object.fromEntries(Object.entries(existing).filter(([k])=>k.startsWith('custom_')).map(([k,v])=>[k.slice(7),v])));
      dialog.querySelector('#il-custom').innerHTML=this.data.fields.filter(f=>!f.category||f.category===form.elements.category.value).map(f=>{
        const v=p.custom[f.id]??'';const name='custom_'+f.id;
        // Un valore salvato che il controllo non sa mostrare (scelta tolta dall'elenco, colore non #rrggbb, numero non
        // valido) resta com'è invece di essere cancellato o sostituito al salvataggio della scheda.
        if(f.type==='select'||f.type==='boolean')return `<label class="il-field"><span>${h(f.label)}</span><select name="${h(name)}" ${richiesto(f)?'required':''}>${f.type==='boolean'?`<option value="">—</option>${options(['Sì','No'],v===true||v==='Sì'?'Sì':v===false||v==='No'?'No':'')}`:`<option value="">—</option>${options(v!==''&&!f.options.includes(v)?[...f.options,v]:f.options,v)}`}</select></label>`;
        const tipo=f.type==='number'?(v===''||Number.isFinite(Number(v))?'number':'text'):f.type==='date'?'date':f.type==='color'?(v===''||/^#[0-9a-f]{6}$/i.test(v)?'color':'text'):'text';
        return this.field(f.label,name,v,tipo,`${tipo==='number'?'step="any"':''} ${richiesto(f)?'required':''}`);
      }).join('')||'<p>Nessun campo per questa categoria.</p>';
      dialog.querySelectorAll('#il-custom input[type=color]').forEach(i=>i.addEventListener('input',()=>{i.dataset.toccato='1';}));};
    renderCustom();form.elements.category.onchange=renderCustom;
    const gallery=()=>{dialog.querySelector('.il-gallery').innerHTML=p.photos.map((url,i)=>`<div><img src="${h(url)}" alt="Foto ${i+1}"><button type="button" data-cover="${i}" aria-label="Usa foto ${i+1} come copertina">${i===0?'Copertina':'Usa come copertina'}</button><button type="button" data-remove="${i}" aria-label="Rimuovi foto ${i+1}">Rimuovi</button></div>`).join('');dialog.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{p.photos.splice(+b.dataset.remove,1);gallery();});dialog.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>{p.photos.unshift(p.photos.splice(+b.dataset.cover,1)[0]);gallery();});};gallery();
    dialog.querySelector('[data-add-url]').onclick=()=>{const input=dialog.querySelector('[aria-label="URL foto"]');try{const u=new URL(input.value);if(!['http:','https:'].includes(u.protocol))throw Error();p.photos.push(u.href);input.value='';gallery();}catch{dialog.querySelector('.il-form-error').textContent='Inserire un URL http/https valido';}};
    dialog.querySelector('input[type=file]').onchange=async e=>{if(!e.target.files.length)return;const error=dialog.querySelector('.il-form-error');this.busy=true;form.querySelector('[type=submit]').disabled=true;
      try{const fd=new FormData();for(const f of e.target.files){if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>10*1024*1024)throw Error('Usare PNG, JPG o WEBP fino a 10 MB');fd.append('files',f);}error.textContent='Caricamento foto…';const d=await api('/api/foto',fd);p.photos.push(...d.files.map(f=>f.url));gallery();error.textContent='Foto caricate nell’archivio Ishtar Lab';}catch(e){error.textContent=e.message;}finally{this.busy=false;form.querySelector('[type=submit]').disabled=false;}};
    // Prima si completano le modifiche rapide in coda (scorte, prezzi…), poi si salva la scheda: contiene già quei valori e
    // li sostituisce, così una modifica rimasta in attesa non riporta indietro descrizione, foto o campi appena salvati.
    form.onsubmit=async e=>{e.preventDefault();const error=dialog.querySelector('.il-form-error');const values=Object.fromEntries(new FormData(form));const product={...p};
      for(const k of ['name','sku','category','gender','description','material','size','color'])product[k]=values[k];for(const k of ['price','cost','stock'])product[k]=Number(values[k]);
      for(const f of this.data.fields){let v=values['custom_'+f.id];if(v===undefined)continue;
        // Un colore mai scelto non diventa nero (#000000 è il valore che il browser mette in un campo colore vuoto);
        // un numero salvato non valido resta com'era invece di diventare NaN.
        if(f.type==='color'&&v==='#000000'&&!form.elements[`custom_${f.id}`]?.dataset.toccato&&[undefined,null,''].includes(original?.custom?.[f.id]))v='';
        product.custom[f.id]=f.type==='boolean'?(v==='Sì'?true:v==='No'?false:''):f.type==='number'&&v!==''&&Number.isFinite(Number(v))?Number(v):v;}
      this.busy=true;form.querySelector('[type=submit]').disabled=true;error.textContent='Salvataggio…';try{await this.flush();await api('/api/catalogo',{product});if(product.id)this.pendingWrites?.delete(product.id);this.busy=false;dialog.close();await this.load();this.notice('Prodotto salvato nel database');}catch(e){error.textContent=e.message;}finally{this.busy=false;form.querySelector('[type=submit]').disabled=false;}};
    form.addEventListener('invalid',e=>{const panel=e.target.closest('[data-panel]');if(panel)dialog.querySelector(`[data-tab="${panel.dataset.panel}"]`).click();},true);
  }
  fields(){let fields=structuredClone(this.data.fields);const dialog=this.modal('Personalizza campi',`<p>Questi campi verranno salvati nel database e compariranno nelle schede prodotto e nell’importazione CSV.</p><div class="il-field-list"></div><form id="il-new-field"><div class="il-form-grid">${this.field('Nome del campo','label','', 'text','required maxlength="100"')}<label class="il-field"><span>Tipo</span><select name="type">${Object.entries({text:'Testo',number:'Numero',select:'Scelta da elenco',color:'Colore',boolean:'Sì / No',date:'Data'}).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="il-field"><span>Categoria</span><select name="category"><option value="">Tutte</option>${options(this.data.categories.map(c=>c.name))}</select></label>${this.field('Scelte separate da virgola','options','')}<label><input type="checkbox" name="required"> Obbligatorio</label><button type="submit">＋ Aggiungi campo</button></div></form><p class="il-form-error" role="alert"></p><footer><button class="il-primary" data-save>Salva configurazione</button></footer>`);
    const render=()=>{dialog.querySelector('.il-field-list').innerHTML=fields.map((f,i)=>`<div><input aria-label="Nome campo ${i+1}" value="${h(f.label)}" data-label="${i}"><span>${h(f.type)} · ${h(f.category||'Tutte')}</span><button data-up="${i}" ${i===0?'disabled':''} aria-label="Sposta su ${h(f.label)}">↑</button><button data-remove="${i}" aria-label="Rimuovi campo ${h(f.label)}">×</button></div>`).join('');dialog.querySelectorAll('[data-label]').forEach(x=>x.oninput=()=>{fields[+x.dataset.label].label=x.value;});dialog.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.up;[fields[i-1],fields[i]]=[fields[i],fields[i-1]];render();});dialog.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{fields.splice(+b.dataset.remove,1);render();});};render();
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(d.type==='select'&&!d.options.trim()){dialog.querySelector('.il-form-error').textContent='Inserire almeno una scelta';return;}fields.push({id:'campo_'+crypto.randomUUID().replaceAll('-','').slice(0,16),label:d.label,type:d.type,category:d.category,options:d.options.split(',').map(s=>s.trim()).filter(Boolean),required:d.required==='on'});e.target.reset();render();};
    dialog.querySelector('[data-save]').onclick=async e=>{e.target.disabled=true;try{await api('/api/catalogo',{fields});dialog.close();await this.load();this.notice('Campi personalizzati salvati');}catch(err){dialog.querySelector('.il-form-error').textContent=err.message;}finally{e.target.disabled=false;}};
  }
  async readFile(file){try{if(!/\.csv$/i.test(file.name))throw Error('Scegliere un file CSV');if(file.size>8*1024*1024)throw Error('Il CSV supera 8 MB');
    // UTF-8 se valido, altrimenti la codifica «ANSI» di Excel su Windows (Windows-1252), segnalata nell'anteprima.
    const byte=await file.arrayBuffer();let testo,codifica='UTF-8';
    try{testo=new TextDecoder('utf-8',{fatal:true}).decode(byte);}catch{testo=new TextDecoder('windows-1252').decode(byte);codifica='Windows-1252';}
    const csv=parseCSV(testo);csv.codifica=codifica;
    // L'aggiornamento parte dai prodotti salvati: prima si completano i salvataggi in coda, poi si rilegge il database.
    clearTimeout(this.changeTimer);await this.flush();
    // Con salvataggi ancora in coda l'importazione partirebbe da dati vecchi e il salvataggio rimasto la coprirebbe.
    if(this.pendingWrites?.size)throw Error('Ci sono modifiche non ancora salvate perché il server non risponde: importazione annullata, nessun dato modificato. Riprovare quando scompare l\'avviso «in attesa di salvataggio».');
    try{await this.leggi();}catch(e){throw Error(`Catalogo non raggiungibile (${e.message}): importazione annullata, nessun dato modificato.`);}
    this.importCSV(csv,file.name);}catch(e){this.notice(e.message,true);}}
  importCSV(csv,fileName){
    const mapping=csv.headers.map(destinazione);
    const dialog=this.modal('Importa inventario CSV',`<p><strong>${h(fileName)}</strong> · ${csv.rows.length} righe. Controlla i campi prima di importare.</p><details><summary>Associa colonne e personalizza campi</summary><div class="il-map">${csv.headers.map((s,i)=>`<label><span>${h(s)}</span><select data-map="${i}">${Object.entries(DESTINAZIONI).map(([k,v])=>`<option value="${k}" ${mapping[i]===k?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</div></details><label class="il-choice"><input type="checkbox" data-update> Aggiorna gli articoli con lo stesso SKU (altrimenti vengono ignorati)</label><div class="il-preview"></div><div class="il-progress" role="status" aria-live="polite"></div><p class="il-form-error" role="alert"></p><footer><button type="button" class="il-secondary" data-cancel-import hidden>Interrompi dopo la riga corrente</button><button class="il-primary" data-run>Importa inventario</button></footer>`,true);
    let normalized=[],extraFields=[],errors=[];const changes=new Map();
    const existing=new Map(this.data.products.map(p=>[p.sku,p]));
    const label={name:'nome',description:'descrizione',category:'categoria',gender:'destinazione',size:'taglia',color:'colore',material:'materiale',price:'prezzo',cost:'costo',stock:'scorte',status:'stato',demo:'demo',photos:'foto',custom:'campi'};
    const normalize=()=>{normalized=[];errors=[];extraFields=[];changes.clear();
      const duplicate=mapping.filter(k=>!['custom','skip'].includes(k));if(new Set(duplicate).size!==duplicate.length)errors.push('Due colonne associate allo stesso campo: correggere la mappatura.');
      csv.headers.forEach((label,j)=>{if(mapping[j]!=='custom')return;const known=this.data.fields.find(f=>normalizza(f.label)===normalizza(label)||f.id===normalizza(label).replace(/ /g,'_'));extraFields.push({id:known?.id||'csv_'+label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,45)+'_'+j,label,type:'text',category:'',options:[],required:false,column:j});});
      // Per uno SKU già presente si parte dal prodotto salvato: cambiano solo le celle piene (vedi importa.mjs).
      const campiExtra=Object.fromEntries(extraFields.map(f=>[f.column,f.id]));const colonnaSku=mapping.indexOf('sku');
      // Convenzione dei numeri decisa per colonna guardando tutte le celle; i valori ambigui senza indizi vengono segnalati.
      const convenzioni={},avvisi=[];
      mapping.forEach((k,j)=>{const numerica=['price','cost','stock'].includes(k)||(k==='custom'&&this.data.fields.find(f=>f.id===campiExtra[j])?.type==='number');if(!numerica)return;
        const celle=csv.rows.map(r=>r[j]);convenzioni[j]=convenzioneColonna(celle);const dubbi=convenzioni[j]?[]:ambigui(celle);
        if(dubbi.length)avvisi.push(`${csv.headers[j]}: ${dubbi.slice(0,3).join(', ')}${dubbi.length>3?'…':''} letti come migliaia`);});
      const seen=new Set();csv.rows.forEach((row,i)=>{try{
        const old=existing.get(String(row[colonnaSku]??'').trim())||null;
        const p=prodottoDaRiga(row,{mappatura:mapping,campi:this.data.fields,categorie:this.data.categories,campiExtra,esistente:old,convenzioni});
        if(seen.has(p.sku))throw Error('SKU duplicato nel file');seen.add(p.sku);
        if(old)changes.set(p.sku,campiCambiati(old,p));normalized.push(p);
      }catch(e){errors.push(`Riga ${i+2}: ${e.message}`);}});
      const matching=normalized.filter(p=>p.id).length;
      const aggiorna=dialog.querySelector('[data-update]').checked;
      const modifiche=p=>!p.id?'nuovo':!aggiorna?'ignorato (spuntare «Aggiorna»)':changes.get(p.sku).length?changes.get(p.sku).map(k=>label[k]||k).join(', '):'nessuna';
      dialog.querySelector('.il-preview').innerHTML=`<p><b>${normalized.length}</b> righe valide · ${normalized.length-matching} nuovi · ${matching} SKU già presenti · ${extraFields.filter(f=>!this.data.fields.some(x=>x.id===f.id)).length} nuovi campi</p><div class="il-table"><table><thead><tr><th>SKU</th><th>Nome</th><th>Categoria</th><th>Prezzo</th><th>Scorte</th><th>Modifiche</th></tr></thead><tbody>${normalized.slice(0,8).map(p=>`<tr><td>${h(p.sku)}</td><td>${h(p.name)}</td><td>${h(p.category)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${h(modifiche(p))}</td></tr>`).join('')}</tbody></table></div><p class="il-help">Con «Aggiorna» cambiano solo le celle piene delle colonne associate: stato, foto e campi assenti dal file restano invariati.${csv.codifica==='Windows-1252'?' File letto con la codifica Windows-1252 di Excel.':''}</p>${avvisi.length?`<p class="il-help">Da controllare: ${h(avvisi.join(' · '))}.</p>`:''}<p>${errors.length?h(errors.join(' · ')):'Anteprima pronta. Nessun dato è stato ancora modificato.'}</p>`;
      dialog.querySelector('[data-run]').disabled=!!errors.length||!normalized.length;
    };normalize();dialog.querySelectorAll('[data-map]').forEach(s=>s.onchange=()=>{mapping[+s.dataset.map]=s.value;normalize();});dialog.querySelector('[data-update]').onchange=normalize;
    dialog.querySelector('[data-run]').onclick=async e=>{
      this.busy=true;this.cancelImport=false;e.target.disabled=true;dialog.querySelector('[data-cancel-import]').hidden=false;dialog.querySelectorAll('select,input').forEach(x=>x.disabled=true);
      let created=0,updated=0,skipped=0,unchanged=0;const failed=[];const update=dialog.querySelector('[data-update]').checked;
      try{const fields=[...this.data.fields];for(const f of extraFields)if(!fields.some(x=>x.id===f.id)){const {column,...definition}=f;fields.push(definition);}if(fields.length!==this.data.fields.length)await api('/api/catalogo',{fields});
        for(let i=0;i<normalized.length;i++){if(this.cancelImport)break;const p=normalized[i];dialog.querySelector('.il-progress').textContent=`Importazione ${i+1}/${normalized.length}: ${p.name}`;
          if(p.id&&!update){skipped++;continue;}if(p.id&&!changes.get(p.sku)?.length){unchanged++;continue;}
          try{await api('/api/catalogo',{product:p});p.id?updated++:created++;}catch(err){failed.push(`${p.sku}: ${err.message}`);}}
        const message=`${created} creati, ${updated} aggiornati, ${unchanged} invariati, ${skipped} ignorati, ${failed.length} errori${this.cancelImport?' · interrotta':''}.`;
        this.data=await api();this.busy=false;dialog.close();this.render();this.notice(message,failed.length>0);
        if(failed.length){this.modal('Esito importazione',`<p>${h(message)}</p><pre>${h(failed.join('\n'))}</pre>`);}
      }catch(err){dialog.querySelector('.il-form-error').textContent=err.message;e.target.disabled=false;}finally{this.busy=false;}
    };
    dialog.querySelector('[data-cancel-import]').onclick=()=>{this.cancelImport=true;};
  }
}
if(!customElements.get('ishtar-catalog'))customElements.define('ishtar-catalog',Catalogo);
// La pagina è il componente originale, con gli stessi filtri, tile e tabella.
// Questo controller aggiunge solo API e strumenti nei dialog del design esistente.
Catalogo.prototype.renderLoading=function(){};
Catalogo.prototype.notice=function(message,error=false){nativeToast(message,error?{warn:true}:{});};
Catalogo.prototype.render=function(){
  this.statoCollegamento();
  if(!this.ready)return;
  this.querySelector('.il-error')?.remove();
  this.syncing=true;
  mutateLegacy(()=>{
    legacy.products=this.data.products.map((p,i)=>({id:p.id,name:p.name,kind:p.category,sku:p.sku,size:p.size||'Unica',notes:p.description||'',family:p.material||'',
      tint:i%6+1,stock:p.stock,price:p.price,cost:p.cost,status:p.status||'draft',reorder:p.reorder??5,incoming:p.incoming??0,photo:p.photos?.[0]&&!p.photos[0].includes('segnaposto-prodotto')?p.photos[0]:null,color:p.color}));
    legacy.settings.currency='EUR';
    window.IshtarRepairRefs?.(legacy);
  });
  this.syncing=false;
  this.commercio=impronta(legacy);
  if(!this.querySelector('.il-file')){
    const file=document.createElement('input');file.type='file';file.accept='.csv,text/csv';file.className='il-file';file.hidden=true;file.setAttribute('aria-label','Scegli CSV inventario');
    file.onchange=()=>{if(file.files[0])this.readFile(file.files[0]);};this.append(file);
  }
};
Catalogo.prototype.syncChanges=function(){
  if(this.syncing)return;
  // Catalogo non caricato perché il server non risponde: una modifica di scorte, prezzi o stato resta solo nella demo e lo si
  // dice subito. L'avviso parte dopo quello del pannello («… is now …»), perché ogni nuovo avviso chiude il precedente.
  if(!this.ready){
    const firma=firmaProdotti(legacy.products),cambiata=this.firmaDemo!==undefined&&firma!==this.firmaDemo;this.firmaDemo=firma;
    if(cambiata&&this.offline&&/^#\/products(\/|$)/.test(location.hash))setTimeout(()=>nativeToast('Catalogo non collegato al server: la modifica non è stata salvata.',{warn:true}),0);
    return;
  }
  this.pendingWrites??=new Map();
  // Solo le modifiche della pagina Prodotti che non toccano ordini, resi o bozze arrivano al database (sincronizza.mjs):
  // cassa, nuovi ordini e resi dimostrativi non cambiano le scorte reali e i valori del database tornano nello stato demo.
  const prima=this.commercio,dopo=impronta(legacy);this.commercio=dopo;
  const trovate=differenze(legacy.products||[],this.data.products);
  const esito=decidi({rotta:location.hash,prima,dopo,differenze:trovate});
  if(esito==='ripristina'){
    clearTimeout(this.restoreTimer);this.restoreTimer=setTimeout(()=>{this.render();
      const ora=Date.now();if(!this.demoNotice||ora-this.demoNotice>10000){this.demoNotice=ora;nativeToast('Azione dimostrativa: scorte e prezzi reali del catalogo non sono stati modificati.');}},0);
    return;
  }
  for(const {id,campi} of trovate){const p=this.data.products.find(x=>x.id===id);Object.assign(p,campi);this.pendingWrites.set(id,{...campi});}
  if(!this.pendingWrites.size)return;
  clearTimeout(this.changeTimer);this.changeTimer=setTimeout(()=>this.flush(),250);
};
// Coda dei salvataggi come promessa unica: readFile e la scheda prodotto la attendono. Il corpo parte sempre dopo
// l'assegnazione (await iniziale) e libera this.flushing solo se è ancora la propria esecuzione, anche con la coda vuota.
// Dopo un'interruzione si rilegge prima il catalogo: ogni modifica in coda parte così dalla versione più recente del
// prodotto (anche se nel frattempo è stato cambiato dalla scheda o da un'altra finestra), non da una copia vecchia.
Catalogo.prototype.flush=function(){
  if(this.flushing)return this.flushing;
  const corsa=(async()=>{await null;
    const eraSospeso=!!this.salvataggioSospeso;let esito={salvati:[],scartati:[],sospeso:null,erroriServer:this.erroriServer||0};
    try{
      if(this.pendingWrites?.size){
        if(eraSospeso)await this.leggi();
        esito=await svuotaCoda({coda:this.pendingWrites,prodotto:id=>this.data.products.find(x=>x.id===id),
          invia:corpo=>api('/api/catalogo',{product:corpo}),erroriServer:this.erroriServer||0});
      }
    }catch(e){esito={...esito,sospeso:e};}
    finally{if(this.flushing===corsa)this.flushing=null;}
    await this.dopoSalvataggi(esito,eraSospeso);
  })();
  this.flushing=corsa;
  return corsa;
};
// Legge il catalogo dal server; i nuovi tentativi li decide chi la chiama. I prodotti con modifiche in coda restano come
// modificati; la copia del server serve a ripristinare una modifica rifiutata anche quando poi il server non risponde.
Catalogo.prototype.leggi=async function(){
  const dati=await api();
  this.server=new Map((dati.products||[]).map(p=>[p.id,structuredClone(p)]));
  dati.products=conModificheInAttesa(dati.products||[],this.pendingWrites);
  this.data=dati;this.ready=true;this.offline=false;this.retries=0;clearTimeout(this.retryTimer);
  this.querySelector('.il-error')?.remove();this.render();
};
// Esito di un giro della coda: nuovo tentativo se il server non risponde, ripristino delle modifiche rifiutate e un solo
// avviso finale (ogni nuovo avviso del pannello chiude il precedente: più avvisi di seguito non si leggerebbero).
Catalogo.prototype.dopoSalvataggi=async function({salvati,scartati,sospeso,erroriServer},eraSospeso){
  for(const s of salvati)this.server?.set(s.id,structuredClone(s.corpo));
  this.erroriServer=sospeso?erroriServer:0;
  if(sospeso){
    this.salvataggioSospeso=true;this.motivoSalvataggio=frase(sospeso.message);
    this.tentativiSalvataggio=(this.tentativiSalvataggio||0)+1;
    clearTimeout(this.changeTimer);this.changeTimer=setTimeout(()=>this.flush(),attesaRiprova(this.tentativiSalvataggio-1));
  }else{this.salvataggioSospeso=false;this.tentativiSalvataggio=0;this.motivoSalvataggio='';}
  let avviso=null;
  if(scartati.length){
    // Le modifiche rifiutate tornano subito ai valori del server, poi (se risponde) si rilegge il catalogo.
    for(const s of scartati){const p=this.data.products.find(x=>x.id===s.id),orig=this.server?.get(s.id);if(p&&orig&&!this.pendingWrites.has(s.id))Object.assign(p,soloCampi(orig));}
    this.render();
    const nomi=scartati.slice(0,3).map(s=>`«${s.nome}»`).join(', ')+(scartati.length>3?` e altri ${scartati.length-3}`:'');
    avviso=[`Salvataggio non riuscito per ${nomi}: ${[...new Set(scartati.map(s=>frase(s.motivo)))].join(' ')} Ripristinati i valori del database.`,{warn:true}];
    if(!sospeso)await this.load();
  }else if(sospeso&&this.tentativiSalvataggio===1)avviso=[`Le modifiche restano in attesa e verranno salvate appena possibile. ${this.motivoSalvataggio}`.trim(),{warn:true}];
  else if(eraSospeso&&!sospeso&&salvati.length&&!this.pendingWrites?.size)avviso=['Server di nuovo raggiungibile: le modifiche in attesa sono state salvate.',{}];
  if(avviso)nativeToast(...avviso);
  this.statoCollegamento();
};
// Avviso fisso e discreto nella pagina Prodotti finché il catalogo non è collegato o ci sono modifiche in attesa, con il motivo.
Catalogo.prototype.statoCollegamento=function(){
  let el=this.querySelector('.il-collegamento');
  const attesa=this.pendingWrites?.size||0,unisci=(...parti)=>[...parti,'Nuovo tentativo in corso…'].filter(Boolean).join(' ');
  const testo=this.offline&&!this.ready?unisci('Catalogo non collegato al server: la pagina mostra i dati dimostrativi del browser e le modifiche non vengono salvate.',this.motivoLettura)
    :this.salvataggioSospeso&&attesa?unisci(`${attesa} ${attesa===1?'modifica':'modifiche'} in attesa di salvataggio.`,this.motivoSalvataggio)
    :this.offline?unisci('Catalogo non aggiornato: la rilettura dal server non è riuscita.',this.motivoLettura):'';
  if(!testo||!/^#\/products(\/|$)/.test(location.hash)){el?.remove();return;}
  if(!el){el=document.createElement('div');el.className='chip glass il-collegamento';el.setAttribute('role','status');el.setAttribute('aria-live','polite');this.append(el);}
  if(el.textContent!==testo)el.textContent=testo;
};
if(!window.IshtarCatalog){
  const controller=document.createElement('ishtar-catalog');window.IshtarCatalog=controller;
  window.addEventListener('ishtar:legacy-change',()=>controller.syncChanges());
  // Ritorno della rete o della pagina: nuovo tentativo immediato. Con salvataggi sospesi basta la coda, che rilegge da sé il
  // catalogo prima di inviare (lettura e invio insieme potrebbero mostrare valori vecchi per un prodotto appena salvato).
  const riprova=()=>{if(controller.salvataggioSospeso){clearTimeout(controller.changeTimer);controller.flush();}else if(controller.offline||!controller.ready){clearTimeout(controller.retryTimer);controller.load();}};
  window.addEventListener('online',riprova);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')riprova();});
  // Scheda chiusa o ricaricata con salvataggi in coda o in corso: il browser chiede conferma prima di perderli.
  window.addEventListener('beforeunload',e=>{if(controller.pendingWrites?.size||controller.flushing){e.preventDefault();e.returnValue='';}});
  document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')&&location.hash.startsWith('#/products'))e.preventDefault();});
  document.addEventListener('drop',e=>{if(!location.hash.startsWith('#/products')||!e.dataTransfer?.files.length)return;e.preventDefault();controller.readFile(e.dataTransfer.files[0]);});
  controller.importChoose=()=>{const file=controller.querySelector('.il-file');file.value='';file.click();};
  document.body.append(controller);
}
export default function Products(props){return runtime().jsx(OriginalProducts,props);}
