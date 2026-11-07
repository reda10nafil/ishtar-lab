import {J as runtime, wt as legacy, it as mutateLegacy, F as nativeToast} from '../assets/kit-BLRx7j0_.js';
import OriginalProducts from '../assets/products-DkARKCT7.js';
import {parseCSV,numberCSV} from './csv.mjs';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(v??0);
const placeholder='/brand/segnaposto-prodotto.svg';
const options=(items,selected)=>items.map(v=>`<option value="${h(v)}" ${v===selected?'selected':''}>${h(v)}</option>`).join('');
async function api(path='/api/catalogo',body){
  const form=body instanceof FormData;
  const response=await fetch(path,{method:body?'POST':'GET',headers:{'X-Ishtar-Local':'1',...(body&&!form?{'Content-Type':'application/json'}:{})},...(body?{body:form?body:JSON.stringify(body)}:{})});
  let data;try{data=await response.json();}catch{throw Error(`Richiesta non riuscita (${response.status})`);}
  if(!response.ok)throw Error(data.message||`Errore ${response.status}`);return data;
}
const aliases={'sku':'sku','nome':'name','name':'name','titolo':'name','descrizione':'description','prezzo vendita':'price','prezzo':'price','costo acquisto':'cost','quantita stock':'stock','quantità':'stock','categoria':'category','taglia/variante':'size','taglia':'size','genere':'gender','colore':'color','materiale':'material','link foto':'photos','foto':'photos','tipo dati':'demo','stato':'skip','campi fittizi':'custom','codice a barre':'custom'};
const destinations={skip:'Non importare',sku:'SKU',name:'Nome',description:'Descrizione',category:'Categoria',gender:'Uomo / Donna / Unisex',size:'Taglia',color:'Colore',material:'Materiale',price:'Prezzo (€)',cost:'Costo (€)',stock:'Quantità',photos:'Foto (URL)',demo:'Dati dimostrativi',custom:'Crea campo personalizzato'};

class Catalogo extends HTMLElement {
  connectedCallback(){this.data={products:[],fields:[],categories:[]};this.search='';this.filter='';this.busy=false;this.renderLoading();this.load();
    this.route=()=>this.render();window.addEventListener('hashchange',this.route);}
  disconnectedCallback(){window.removeEventListener('hashchange',this.route);this.dialog?.close();}
  renderLoading(){this.innerHTML='<div class="il-message" role="status">Collegamento al catalogo Ishtar Lab…</div>';}
  async load(){
    if(this.loading)return;this.loading=true;
    try{this.data=await api();this.ready=true;this.retries=0;clearTimeout(this.retryTimer);this.querySelector('.il-error')?.remove();this.render();}
    catch(e){if(!this.retries)this.notice(e.message,true);this.retries=(this.retries||0)+1;if(this.retries<12)this.retryTimer=setTimeout(()=>this.load(),Math.min(15000,1000*2**Math.min(this.retries,4)));}
    finally{this.loading=false;}
  }
  notice(message,error=false){const el=this.querySelector('.il-notice');if(el){el.textContent=message;el.className='il-notice '+(error?'il-error':'');el.setAttribute('role',error?'alert':'status');}}
  modal(title,body,wide=false){this.dialog?.close();this.dialog?.remove();const dialog=document.createElement('dialog');dialog.className='il-dialog modal glass '+(wide?'modal--wide':'');
    dialog.setAttribute('aria-label',title);
    dialog.innerHTML=`<header><h2>${h(title)}</h2><button type="button" class="il-close" aria-label="Chiudi finestra">×</button></header><div class="il-dialog-body">${body}</div>`;this.append(dialog);this.dialog=dialog;dialog.querySelectorAll('input:not([type=checkbox]):not([type=file])').forEach(x=>x.classList.add('input'));dialog.querySelectorAll('select').forEach(x=>x.classList.add('select'));dialog.querySelectorAll('textarea').forEach(x=>x.classList.add('textarea'));dialog.querySelectorAll('button').forEach(x=>{x.classList.add('btn');if(x.classList.contains('il-primary'))x.classList.add('btn--primary');});dialog.querySelectorAll('.il-field').forEach(x=>x.classList.add('field'));dialog.querySelectorAll('.il-form-grid').forEach(x=>x.classList.add('formgrid'));
    dialog.querySelector('.il-close').onclick=()=>{if(this.busy)return;dialog.close();dialog.remove();};dialog.addEventListener('cancel',e=>{if(this.busy)e.preventDefault();});dialog.showModal();return dialog;}
  field(label,name,value,type='text',extra=''){return `<label class="il-field"><span>${h(label)}</span><input name="${h(name)}" type="${type}" value="${h(value)}" ${extra}></label>`;}
  edit(original){const p=structuredClone(original||{name:'',sku:'',category:this.data.categories[0]?.name,description:'',size:'',color:'',gender:'Unisex',material:'',price:0,cost:0,stock:0,photos:[],custom:{},demo:false});
    const dialog=this.modal(original?'Modifica prodotto':'Nuovo prodotto',`<form id="il-product-form"><nav class="il-tabs" aria-label="Sezioni scheda prodotto">${['Dettagli','Varianti e scorte','Foto','Campi personalizzati'].map((t,i)=>`<button type="button" data-tab="${i}" class="${i===0?'il-selected':''}">${t}</button>`).join('')}</nav>
    <section data-panel="0"><div class="il-form-grid">${this.field('Nome prodotto','name',p.name,'text','required maxlength="200"')}${this.field('SKU / codice articolo','sku',p.sku,'text',`required maxlength="80" ${original?'readonly':''}`)}<label class="il-field"><span>Categoria</span><select name="category">${options(this.data.categories.map(c=>c.name),p.category)}</select></label><label class="il-field"><span>Destinazione</span><select name="gender">${options(['Uomo','Donna','Unisex'],p.gender)}</select></label>${this.field('Materiale / composizione','material',p.material)}<label class="il-field il-full"><span>Descrizione</span><textarea name="description" rows="5">${h(p.description)}</textarea></label></div></section>
    <section data-panel="1" hidden><div class="il-form-grid">${this.field('Taglia','size',p.size)}<label class="il-field"><span>Colore</span><input name="color" value="${h(p.color)}" list="il-colors"><datalist id="il-colors">${options(['Nero','Avorio','Blu notte','Verde smeraldo','Rosso rubino','Bordeaux','Rosa cipria','Lilla','Cioccolato'])}</datalist></label>${this.field('Prezzo vendita (€)','price',p.price,'number','min="0" step="0.01" required')}${this.field('Costo acquisto (€)','cost',p.cost,'number','min="0" step="0.01" required')}${this.field('Quantità disponibile','stock',p.stock,'number','min="0" step="1" required')}</div><p class="il-help">Ogni SKU è un articolo vendibile. Taglia, colore, prezzo e giacenza vengono salvati nel database.</p></section>
    <section data-panel="2" hidden><p>Carica più foto, scegli la copertina o aggiungi un URL.</p><label class="il-upload">＋ Carica foto<input type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label="Carica foto prodotto"></label><div class="il-photo-add"><input type="url" aria-label="URL foto" placeholder="https://…"><button type="button" data-add-url>Aggiungi URL</button></div><div class="il-gallery"></div></section>
    <section data-panel="3" hidden><div class="il-form-grid" id="il-custom"></div><p class="il-help">Aggiungi altri campi da “Personalizza campi” nella pagina Prodotti.</p></section>
    <p class="il-form-error" role="alert"></p><footer><span>${p.demo?'Dati dimostrativi · ':''}Salvataggio nel database Ishtar Lab</span><button class="il-primary" type="submit">Salva prodotto</button></footer></form>`);
    const form=dialog.querySelector('form');
    dialog.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{dialog.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('il-selected',x===b));dialog.querySelectorAll('[data-panel]').forEach(x=>x.hidden=x.dataset.panel!==b.dataset.tab);});
    const renderCustom=()=>{const existing=Object.fromEntries(new FormData(form));Object.assign(p.custom,Object.fromEntries(Object.entries(existing).filter(([k])=>k.startsWith('custom_')).map(([k,v])=>[k.slice(7),v])));
      dialog.querySelector('#il-custom').innerHTML=this.data.fields.filter(f=>!f.category||f.category===form.elements.category.value).map(f=>{
        const v=p.custom[f.id]??'';const name='custom_'+f.id;
        if(f.type==='select'||f.type==='boolean')return `<label class="il-field"><span>${h(f.label)}</span><select name="${h(name)}" ${f.required?'required':''}>${f.type==='boolean'?`<option value="">—</option>${options(['Sì','No'],v===true||v==='Sì'?'Sì':v===false||v==='No'?'No':'')}`:`<option value="">—</option>${options(f.options,v)}`}</select></label>`;
        return this.field(f.label,name,v, f.type==='number'?'number':f.type==='date'?'date':f.type==='color'?'color':'text',`${f.type==='number'?'step="any"':''} ${f.required?'required':''}`);
      }).join('')||'<p>Nessun campo per questa categoria.</p>';};
    renderCustom();form.elements.category.onchange=renderCustom;
    const gallery=()=>{dialog.querySelector('.il-gallery').innerHTML=p.photos.map((url,i)=>`<div><img src="${h(url)}" alt="Foto ${i+1}"><button type="button" data-cover="${i}" aria-label="Usa foto ${i+1} come copertina">${i===0?'Copertina':'Usa come copertina'}</button><button type="button" data-remove="${i}" aria-label="Rimuovi foto ${i+1}">Rimuovi</button></div>`).join('');dialog.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{p.photos.splice(+b.dataset.remove,1);gallery();});dialog.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>{p.photos.unshift(p.photos.splice(+b.dataset.cover,1)[0]);gallery();});};gallery();
    dialog.querySelector('[data-add-url]').onclick=()=>{const input=dialog.querySelector('[aria-label="URL foto"]');try{const u=new URL(input.value);if(!['http:','https:'].includes(u.protocol))throw Error();p.photos.push(u.href);input.value='';gallery();}catch{dialog.querySelector('.il-form-error').textContent='Inserire un URL http/https valido';}};
    dialog.querySelector('input[type=file]').onchange=async e=>{if(!e.target.files.length)return;const error=dialog.querySelector('.il-form-error');this.busy=true;form.querySelector('[type=submit]').disabled=true;
      try{const fd=new FormData();for(const f of e.target.files){if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>10*1024*1024)throw Error('Usare PNG, JPG o WEBP fino a 10 MB');fd.append('files',f);}error.textContent='Caricamento foto…';const d=await api('/api/foto',fd);p.photos.push(...d.files.map(f=>f.url));gallery();error.textContent='Foto caricate nell’archivio Ishtar Lab';}catch(e){error.textContent=e.message;}finally{this.busy=false;form.querySelector('[type=submit]').disabled=false;}};
    form.onsubmit=async e=>{e.preventDefault();const error=dialog.querySelector('.il-form-error');const values=Object.fromEntries(new FormData(form));const product={...p};
      for(const k of ['name','sku','category','gender','description','material','size','color'])product[k]=values[k];for(const k of ['price','cost','stock'])product[k]=Number(values[k]);
      for(const f of this.data.fields){const v=values['custom_'+f.id];if(v!==undefined)product.custom[f.id]=f.type==='boolean'?(v==='Sì'?true:v==='No'?false:''):f.type==='number'&&v!==''?Number(v):v;}
      this.busy=true;form.querySelector('[type=submit]').disabled=true;error.textContent='Salvataggio…';try{await api('/api/catalogo',{product});this.busy=false;dialog.close();await this.load();this.notice('Prodotto salvato nel database');}catch(e){error.textContent=e.message;}finally{this.busy=false;form.querySelector('[type=submit]').disabled=false;}};
    form.addEventListener('invalid',e=>{const panel=e.target.closest('[data-panel]');if(panel)dialog.querySelector(`[data-tab="${panel.dataset.panel}"]`).click();},true);
  }
  fields(){let fields=structuredClone(this.data.fields);const dialog=this.modal('Personalizza campi',`<p>Questi campi verranno salvati nel database e compariranno nelle schede prodotto e nell’importazione CSV.</p><div class="il-field-list"></div><form id="il-new-field"><div class="il-form-grid">${this.field('Nome del campo','label','', 'text','required maxlength="100"')}<label class="il-field"><span>Tipo</span><select name="type">${Object.entries({text:'Testo',number:'Numero',select:'Scelta da elenco',color:'Colore',boolean:'Sì / No',date:'Data'}).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="il-field"><span>Categoria</span><select name="category"><option value="">Tutte</option>${options(this.data.categories.map(c=>c.name))}</select></label>${this.field('Scelte separate da virgola','options','')}<label><input type="checkbox" name="required"> Obbligatorio</label><button type="submit">＋ Aggiungi campo</button></div></form><p class="il-form-error" role="alert"></p><footer><button class="il-primary" data-save>Salva configurazione</button></footer>`);
    const render=()=>{dialog.querySelector('.il-field-list').innerHTML=fields.map((f,i)=>`<div><input aria-label="Nome campo ${i+1}" value="${h(f.label)}" data-label="${i}"><span>${h(f.type)} · ${h(f.category||'Tutte')}</span><button data-up="${i}" ${i===0?'disabled':''} aria-label="Sposta su ${h(f.label)}">↑</button><button data-remove="${i}" aria-label="Rimuovi campo ${h(f.label)}">×</button></div>`).join('');dialog.querySelectorAll('[data-label]').forEach(x=>x.oninput=()=>{fields[+x.dataset.label].label=x.value;});dialog.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.up;[fields[i-1],fields[i]]=[fields[i],fields[i-1]];render();});dialog.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{fields.splice(+b.dataset.remove,1);render();});};render();
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(d.type==='select'&&!d.options.trim()){dialog.querySelector('.il-form-error').textContent='Inserire almeno una scelta';return;}fields.push({id:'campo_'+crypto.randomUUID().replaceAll('-','').slice(0,16),label:d.label,type:d.type,category:d.category,options:d.options.split(',').map(s=>s.trim()).filter(Boolean),required:d.required==='on'});e.target.reset();render();};
    dialog.querySelector('[data-save]').onclick=async e=>{e.target.disabled=true;try{await api('/api/catalogo',{fields});dialog.close();await this.load();this.notice('Campi personalizzati salvati');}catch(err){dialog.querySelector('.il-form-error').textContent=err.message;}finally{e.target.disabled=false;}};
  }
  async readFile(file){try{if(!/\.csv$/i.test(file.name))throw Error('Scegliere un file CSV');if(file.size>8*1024*1024)throw Error('Il CSV supera 8 MB');this.importCSV(parseCSV(await file.text()),file.name);}catch(e){this.notice(e.message,true);}}
  importCSV(csv,fileName){
    const mapping=csv.headers.map(s=>aliases[s.toLowerCase()]||'custom');
    const dialog=this.modal('Importa inventario CSV',`<p><strong>${h(fileName)}</strong> · ${csv.rows.length} righe. Controlla i campi prima di importare.</p><details><summary>Associa colonne e personalizza campi</summary><div class="il-map">${csv.headers.map((s,i)=>`<label><span>${h(s)}</span><select data-map="${i}">${Object.entries(destinations).map(([k,v])=>`<option value="${k}" ${mapping[i]===k?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</div></details><label class="il-choice"><input type="checkbox" data-update> Aggiorna gli articoli con lo stesso SKU (altrimenti vengono ignorati)</label><div class="il-preview"></div><div class="il-progress" role="status" aria-live="polite"></div><p class="il-form-error" role="alert"></p><footer><button type="button" class="il-secondary" data-cancel-import hidden>Interrompi dopo la riga corrente</button><button class="il-primary" data-run>Importa inventario</button></footer>`,true);
    let normalized=[],extraFields=[],errors=[];
    const existing=new Map(this.data.products.map(p=>[p.sku,p]));
    const normalize=()=>{normalized=[];errors=[];extraFields=[];
      const duplicate=mapping.filter(k=>!['custom','skip'].includes(k));if(new Set(duplicate).size!==duplicate.length)errors.push('Due colonne associate allo stesso campo: correggere la mappatura.');
      csv.headers.forEach((label,j)=>{if(mapping[j]!=='custom')return;const known=this.data.fields.find(f=>f.label.toLowerCase()===label.toLowerCase()||f.id===label.toLowerCase());extraFields.push({id:known?.id||'csv_'+label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,45)+'_'+j,label,type:'text',category:'',options:[],required:false,column:j});});
      const seen=new Set();csv.rows.forEach((row,i)=>{try{const p={name:'',sku:'',description:'',category:'',gender:'Unisex',size:'',color:'',material:'',price:0,cost:0,stock:0,photos:[],custom:{},demo:false};
        row.forEach((v,j)=>{v=v.trim();const key=mapping[j];if(key==='skip')return;if(key==='custom'){p.custom[extraFields.find(f=>f.column===j).id]=v;return;}if(['price','cost','stock'].includes(key))p[key]=numberCSV(v);else if(key==='photos')p.photos=v?[v]:[];else if(key==='demo')p.demo=/demo|true|sì|si|1/i.test(v);else p[key]=v;});
        if(!p.name||!p.sku)throw Error('Nome e SKU obbligatori');if(p.sku.length>80||/^https?:/.test(p.sku))throw Error('SKU non valido: usare il CSV demo normalizzato');
        if(seen.has(p.sku))throw Error('SKU duplicato nel file');seen.add(p.sku);
        if(!this.data.categories.some(c=>c.name.toLowerCase()===p.category.toLowerCase()))throw Error('Categoria non riconosciuta');p.category=this.data.categories.find(c=>c.name.toLowerCase()===p.category.toLowerCase()).name;
        if(!Number.isInteger(p.stock))throw Error('La quantità deve essere intera');
        for(const f of this.data.fields){if(f.required&&(!f.category||f.category===p.category)&&!p.custom[f.id])throw Error(`Campo richiesto: ${f.label}`);if(f.type==='number'&&p.custom[f.id]!==undefined)p.custom[f.id]=numberCSV(p.custom[f.id]);}
        const old=existing.get(p.sku);if(old)p.id=old.id;normalized.push(p);
      }catch(e){errors.push(`Riga ${i+2}: ${e.message}`);}});
      const matching=normalized.filter(p=>p.id).length;
      dialog.querySelector('.il-preview').innerHTML=`<p><b>${normalized.length}</b> righe valide · ${normalized.length-matching} nuovi · ${matching} SKU già presenti · ${extraFields.filter(f=>!this.data.fields.some(x=>x.id===f.id)).length} nuovi campi</p><div class="il-table"><table><thead><tr><th>SKU</th><th>Nome</th><th>Categoria</th><th>Prezzo</th><th>Scorte</th></tr></thead><tbody>${normalized.slice(0,8).map(p=>`<tr><td>${h(p.sku)}</td><td>${h(p.name)}</td><td>${h(p.category)}</td><td>${money(p.price)}</td><td>${p.stock}</td></tr>`).join('')}</tbody></table></div><p>${errors.length?h(errors.join(' · ')):'Anteprima pronta. Nessun dato è stato ancora modificato.'}</p>`;
      dialog.querySelector('[data-run]').disabled=!!errors.length||!normalized.length;
    };normalize();dialog.querySelectorAll('[data-map]').forEach(s=>s.onchange=()=>{mapping[+s.dataset.map]=s.value;normalize();});
    dialog.querySelector('[data-run]').onclick=async e=>{
      this.busy=true;this.cancelImport=false;e.target.disabled=true;dialog.querySelector('[data-cancel-import]').hidden=false;dialog.querySelectorAll('select,input').forEach(x=>x.disabled=true);
      let created=0,updated=0,skipped=0;const failed=[];const update=dialog.querySelector('[data-update]').checked;
      try{const fields=[...this.data.fields];for(const f of extraFields)if(!fields.some(x=>x.id===f.id)){const {column,...definition}=f;fields.push(definition);}if(fields.length!==this.data.fields.length)await api('/api/catalogo',{fields});
        for(let i=0;i<normalized.length;i++){if(this.cancelImport)break;const p=normalized[i];dialog.querySelector('.il-progress').textContent=`Importazione ${i+1}/${normalized.length}: ${p.name}`;
          if(p.id&&!update){skipped++;continue;}try{await api('/api/catalogo',{product:p});p.id?updated++:created++;}catch(err){failed.push(`${p.sku}: ${err.message}`);}}
        const message=`${created} creati, ${updated} aggiornati, ${skipped} ignorati, ${failed.length} errori${this.cancelImport?' · interrotta':''}.`;
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
Catalogo.prototype.notice=function(message,error=false){nativeToast(message);};
Catalogo.prototype.render=function(){
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
  if(!this.querySelector('.il-file')){
    const file=document.createElement('input');file.type='file';file.accept='.csv,text/csv';file.className='il-file';file.hidden=true;file.setAttribute('aria-label','Scegli CSV inventario');
    file.onchange=()=>{if(file.files[0])this.readFile(file.files[0]);};this.append(file);
  }
};
Catalogo.prototype.syncChanges=function(){
  if(this.syncing)return;
  this.pendingWrites??=new Map();
  for(const p of this.data.products){
    const n=legacy.products.find(n=>n.id===p.id);if(!n)continue;
    const changes={stock:n.stock,price:n.price,cost:n.cost,status:n.status,incoming:n.incoming,reorder:n.reorder};
    if(Object.entries(changes).every(([key,value])=>value===(p[key]??({status:'draft',incoming:0,reorder:5}[key]))))continue;
    Object.assign(p,changes);this.pendingWrites.set(p.id,structuredClone(p));
  }
  clearTimeout(this.changeTimer);this.changeTimer=setTimeout(async()=>{
    if(this.flushing)return;this.flushing=true;
    try{while(this.pendingWrites.size){const [id,p]=this.pendingWrites.entries().next().value;this.pendingWrites.delete(id);await api('/api/catalogo',{product:p});}}
    catch(e){this.pendingWrites.clear();nativeToast('Salvataggio non riuscito: '+e.message);await this.load();}
    finally{this.flushing=false;}
  },250);
};
if(!window.IshtarCatalog){
  const controller=document.createElement('ishtar-catalog');window.IshtarCatalog=controller;
  window.addEventListener('ishtar:legacy-change',()=>controller.syncChanges());
  document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')&&location.hash.startsWith('#/products'))e.preventDefault();});
  document.addEventListener('drop',e=>{if(!location.hash.startsWith('#/products')||!e.dataTransfer?.files.length)return;e.preventDefault();controller.readFile(e.dataTransfer.files[0]);});
  controller.importChoose=()=>{const file=controller.querySelector('.il-file');file.value='';file.click();};
  document.body.append(controller);
}
export default function Products(props){return runtime().jsx(OriginalProducts,props);}
