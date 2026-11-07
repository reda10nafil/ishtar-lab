import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const options={cwd:root,windowsHide:true};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function dockerReady(){return spawnSync('docker',['info','--format','{{.ServerVersion}}'],{...options,stdio:'ignore',timeout:8000}).status===0;}
async function main(){
  if(spawnSync('python',['--version'],{...options,stdio:'ignore'}).status!==0)throw Error('Python non trovato. Controllare l’installazione locale.');
  if(!dockerReady()){
    const desktop=path.join(process.env.ProgramFiles||'C:\\Program Files','Docker','Docker','Docker Desktop.exe');
    if(!fs.existsSync(desktop))throw Error('Docker Desktop non disponibile. Avviarlo e riprovare.');
    console.log('Avvio di Docker Desktop…');
    const docker=spawn(desktop,[],{...options,detached:true,stdio:'ignore'});docker.unref();
    const limit=Date.now()+150000;
    while(!dockerReady()){if(Date.now()>limit)throw Error('Docker Desktop non è ancora pronto. Attendere il suo avvio e riprovare.');await sleep(2500);}
  }
  const backend=spawnSync(process.execPath,[path.join(root,'backend','infra','runtime.mjs'),'start'],{...options,stdio:'inherit'});
  if(backend.status!==0)throw Error('Backend non avviato. Consultare backend/.runtime/backend-errori.log.');
  const frontend=spawn('python',[path.join(root,'avvia_pannello.py')],{...options,detached:true,stdio:'ignore'});
  frontend.on('error',()=>{});frontend.unref();
  let ready=false;
  for(let i=0;i<40;i++){
    try{const r=await fetch('http://127.0.0.1:4273/ishtar-lab/',{signal:AbortSignal.timeout(1000)});ready=r.ok&&r.headers.get('X-Redx-Recovery')==='redx-pannello-recuperato-2026-11-06';if(ready)break;}catch{}
    await sleep(250);
  }
  if(!ready)throw Error('Pannello non disponibile sulla porta 4273. Nessun altro processo è stato fermato.');
  const url='http://127.0.0.1:4273/ishtar-lab/#/home';
  if(!process.argv.includes('--no-browser')){
    const open=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Start-Process '${url}'`],options);
    if(open.status!==0)throw Error('Aprire il pannello a questo indirizzo: '+url);
  }
  console.log('Ishtar Lab pronto: '+url);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
