import fs from 'node:fs';
import path from 'node:path';
import {RADICE,API,PORTE,ISTANZA,verificaIsolamento,leggiEnv} from './istanza.mjs';
verificaIsolamento();
const results=[];
const check=(name,ok)=>{results.push({name,ok:Boolean(ok)});console.log(`${ok?'OK':'KO'} ${name}`);};
async function main(){
  const limit=Date.now()+180000;let healthy=false;
  while(Date.now()<limit){try{healthy=(await fetch(`${API}/health`,{signal:AbortSignal.timeout(2000)})).ok;if(healthy)break;}catch{} await new Promise(r=>setTimeout(r,1500));}
  check('Salute API nuova',healthy);if(!healthy)throw new Error('New API unavailable');
  check('Endpoint admin senza sessione negato',(await fetch(`${API}/admin/permessi/me`)).status===401);
  const creds=leggiEnv(path.join(RADICE,'.credenziali-locali.env'));
  const login=await fetch(`${API}/auth/user/emailpass`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:creds.ADMIN_EMAIL,password:creds.ADMIN_PASSWORD})});
  const token=(await login.json()).token;check('Accesso proprietario locale',login.ok&&typeof token==='string');
  if(!token)throw new Error('Local login failed');
  const headers={authorization:`Bearer ${token}`};
  const permissions=await fetch(`${API}/admin/permessi/me`,{headers});check('Permessi del proprietario risolti',permissions.ok);
  const catalogue=await fetch(`${API}/admin/catalogo/prodotti`,{headers});const products=await catalogue.json();check('Catalogo nuovo vuoto, senza demo importati',catalogue.ok&&products.totale===0);
  const connectors=await fetch(`${API}/admin/connectors`,{headers});const connectionData=await connectors.json();
  check('Connettori accessibili',connectors.ok);check('Nessun connettore demo attivo',!JSON.stringify(connectionData).includes('"id":"demo"'));
  let uploaded;
  try{
    const content=`Ishtar Lab isolation probe ${Date.now()}`;
    const form=new FormData();form.append('files',new Blob([content],{type:'text/plain'}),`ishtar-isolation-${Date.now()}.txt`);
    const upload=await fetch(`${API}/admin/uploads`,{method:'POST',headers,body:form});
    const data=await upload.json();uploaded=data.files?.[0];check('Upload nel nuovo archivio',upload.ok&&uploaded?.url?.startsWith(`http://127.0.0.1:${PORTE.storage}/ishtar-lab-assets/`));
    if(uploaded){const get=await fetch(uploaded.url);check('Lettura del file dal nuovo archivio',get.ok&&await get.text()===content);}
  }finally{
    if(uploaded){const response=await fetch(`${API}/admin/uploads/${encodeURIComponent(uploaded.id)}`,{method:'DELETE',headers});check('Rimozione del solo file di prova',response.ok);}
  }
  const current=leggiEnv(path.join(RADICE,'piattaforma/packages/api/.env'));
  const archived=leggiEnv(path.resolve(RADICE,'../Recupero-pannello-2026-11-06/originale/multi-outfit/piattaforma/packages/api/.env'));
  check('Chiavi differenti dallâ€™originale',['JWT_SECRET','COOKIE_SECRET','CONNECTORS_KEY','S3_SECRET_ACCESS_KEY'].every(k=>current[k]&&current[k]!==archived[k]));
  fs.writeFileSync(path.resolve(RADICE,'../verifiche/isolamento-servizi.json'),JSON.stringify({instance:ISTANZA,results},null,2));
  if(results.some(r=>!r.ok))process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
