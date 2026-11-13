import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const options={cwd:root,windowsHide:true};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const windows=process.platform==='win32';
// Su Linux e macOS l'interprete si chiama di norma python3; su Windows resta python.
const python=windows?'python':'python3';
const runtimeDir=path.join(root,'backend','.runtime');
const pannelloScript=path.join(root,'avvia_pannello.py');
const pannelloStato=path.join(runtimeDir,'pannello.json');
const identita='redx-pannello-recuperato-2026-11-06';
function dockerReady(){return spawnSync('docker',['info','--format','{{.ServerVersion}}'],{...options,stdio:'ignore',timeout:8000}).status===0;}
async function pannelloAttivo(){
  try{const r=await fetch('http://127.0.0.1:4273/ishtar-lab/',{signal:AbortSignal.timeout(1000)});return r.ok&&r.headers.get('X-Redx-Recovery')===identita;}catch{return false;}
}
async function main(){
  if(spawnSync(python,['--version'],{...options,stdio:'ignore'}).status!==0)throw Error(`Python non trovato (comando ${python}). Controllare l’installazione locale.`);
  const configurazioni=[path.join(root,'backend','infra','.env'),path.join(root,'backend','piattaforma','packages','api','.env')];
  if(configurazioni.some(file=>!fs.existsSync(file)))throw Error(`Configurazione assente o incompleta: eseguire prima ${windows?'Prepara Ishtar Lab.bat':'./prepara-ishtar-lab.sh'}.`);
  const pronto=dockerReady();
  if(!pronto&&!windows)throw Error(process.platform==='linux'
    ?'Docker non risponde. Avviarlo con «sudo systemctl start docker» e verificare che l’utente sia nel gruppo docker (serve un nuovo accesso dopo l’aggiunta).'
    :'Docker non risponde. Avviare Docker Desktop e riprovare.');
  if(!pronto){
    const desktop=path.join(process.env.ProgramFiles||'C:\\Program Files','Docker','Docker','Docker Desktop.exe');
    if(!fs.existsSync(desktop))throw Error('Docker Desktop non disponibile. Avviarlo e riprovare.');
    console.log('Avvio di Docker Desktop…');
    const docker=spawn(desktop,[],{...options,detached:true,stdio:'ignore'});docker.unref();
    const limit=Date.now()+150000;
    while(!dockerReady()){if(Date.now()>limit)throw Error('Docker Desktop non è ancora pronto. Attendere il suo avvio e riprovare.');await sleep(2500);}
  }
  const backend=spawnSync(process.execPath,[path.join(root,'backend','infra','runtime.mjs'),'start'],{...options,stdio:'inherit'});
  if(backend.status!==0)throw Error('Backend non avviato.'+(fs.existsSync(path.join(runtimeDir,'backend-errori.log'))?' Consultare backend/.runtime/backend-errori.log.':''));
  // Un pannello di questa copia già in ascolto viene riutilizzato: niente duplicati e PID registrato conservato.
  if(!await pannelloAttivo()){
    fs.mkdirSync(runtimeDir,{recursive:true});
    // Su Windows l'uscita resta scartata come prima; su Linux e macOS va in backend/.runtime/pannello.log.
    const log=windows?null:fs.openSync(path.join(runtimeDir,'pannello.log'),'a');
    const frontend=spawn(python,[pannelloScript],{...options,detached:true,stdio:log===null?'ignore':['ignore',log,log]});
    if(log!==null)fs.closeSync(log);
    frontend.on('error',()=>{});
    if(frontend.pid)fs.writeFileSync(pannelloStato,JSON.stringify({pid:frontend.pid,script:pannelloScript},null,2));
    frontend.unref();
  }
  let ready=false;
  for(let i=0;i<40;i++){
    ready=await pannelloAttivo();if(ready)break;
    await sleep(250);
  }
  if(!ready)throw Error('Pannello non disponibile sulla porta 4273. Nessun altro processo è stato fermato.'+(windows?'':' Dettagli in backend/.runtime/pannello.log.'));
  const url='http://127.0.0.1:4273/ishtar-lab/#/home';
  if(!process.argv.includes('--no-browser')){
    if(windows){
      const open=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Start-Process '${url}'`],options);
      if(open.status!==0)throw Error('Aprire il pannello a questo indirizzo: '+url);
    }else{
      // xdg-open (Linux) e open (macOS) restano staccati: un browser che non risponde non blocca l'avvio.
      const browser=spawn(process.platform==='darwin'?'open':'xdg-open',[url],{...options,detached:true,stdio:'ignore'});
      browser.on('error',()=>console.log('Aprire il pannello a questo indirizzo: '+url));browser.unref();
    }
  }
  console.log('Ishtar Lab pronto: '+url);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
