// Tutte le operazioni appartengono esclusivamente a questa copia.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { RADICE, ISTANZA, COMPOSE, API, PORTE, verificaIsolamento, leggiEnv } from './istanza.mjs';
import { appartiene, arresta, vivo } from './processi.mjs';
const apiDir=path.join(RADICE,'piattaforma/packages/api');
const stateDir=path.join(RADICE,'.runtime');
fs.mkdirSync(stateDir,{recursive:true});
const stateFile=path.join(stateDir,'processi.json');
const state=()=>fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{};
const medusa=path.join(apiDir,'node_modules/@medusajs/cli/cli.js');
const lock=path.join(stateDir,'avvio.lock');
function run(command,args,cwd=RADICE,extra={}) {
  const result=spawnSync(command,args,{cwd,stdio:'inherit',windowsHide:true,env:{...process.env,...verificaIsolamento()},...extra});
  if(result.error||result.status!==0)throw new Error(`Operazione non completata (${result.status ?? result.error?.code}).`);
}
function compose(...args){run('docker',['compose','--project-name',ISTANZA,'--env-file',path.join(RADICE,'infra/.env'),'--file',COMPOSE,...args],path.dirname(COMPOSE),{env:{...process.env,...verificaIsolamento(),...leggiEnv(path.join(RADICE,'infra/.env')),COMPOSE_PROJECT_NAME:ISTANZA}});}
// Riconosce l'API della copia dalla riga di comando: PowerShell su Windows, /proc su Linux, ps su macOS.
const own=(pid,script)=>appartiene(pid,script);
async function freePort(port){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(new Error(`La porta ${port} è occupata da un altro processo; non verrà arrestato.`)));s.listen(port,'127.0.0.1',()=>s.close(resolve));});}
async function waitHealth(pid){const limit=Date.now()+180000;while(Date.now()<limit){try{if((await fetch(`${API}/health`,{signal:AbortSignal.timeout(2000)})).ok)return;}catch{} if(pid&&!vivo(pid))throw new Error('API terminata durante l’avvio: vedere .runtime/backend-errori.log');await new Promise(r=>setTimeout(r,1500));}throw new Error('API non pronta: vedere .runtime/backend-errori.log');}
async function start(){
  const saved=state();
  if(saved.instance===ISTANZA && own(saved.api?.pid,medusa)){await waitHealth();console.log(`API già avviata: ${API}`);return;}
  if(!fs.existsSync(medusa))throw new Error('Dipendenze mancanti: preparare backend/piattaforma prima dell’avvio.');
  await freePort(PORTE.api);
  const out=fs.openSync(path.join(stateDir,'backend.log'),'a'),err=fs.openSync(path.join(stateDir,'backend-errori.log'),'a');
  const child=spawn(process.execPath,[medusa,'start','-H','127.0.0.1','-p',String(PORTE.api)],{cwd:apiDir,env:{...process.env,...verificaIsolamento()},detached:true,stdio:['ignore',out,err],windowsHide:true});
  child.on('error',e=>console.error(e.message));
  fs.closeSync(out);fs.closeSync(err);
  if(!child.pid)throw new Error('Avvio del processo API fallito.');
  fs.writeFileSync(stateFile,JSON.stringify({instance:ISTANZA,api:{pid:child.pid,script:medusa}},null,2));
  child.unref();await waitHealth(child.pid);console.log(`Ishtar Lab API: ${API}`);
}
async function stop(){
  const saved=state();
  if(saved.instance===ISTANZA&&own(saved.api?.pid,medusa)){
    if(process.platform==='win32')run('taskkill.exe',['/PID',String(saved.api.pid),'/T','/F']);
    else if(!await arresta(saved.api.pid))throw new Error(`API (PID ${saved.api.pid}) non arrestata: stato conservato e servizi lasciati attivi.`);
  }else{
    try{if((await fetch(`${API}/health`,{signal:AbortSignal.timeout(2000)})).ok)console.warn(`Un processo non riconosciuto come API di questa copia risponde su ${API}: non viene arrestato.`);}catch{}
  }
  fs.writeFileSync(stateFile,JSON.stringify({instance:ISTANZA}));
  compose('stop');console.log('Fermata solo la copia Ishtar Lab; dati conservati.');
}
async function main(){
  verificaIsolamento();
  const command=process.argv[2]||'start';
  if(command==='check'){console.log('Configurazione Ishtar Lab separata e valida.');return;}
  if(command==='status'){compose('ps');return;}
  let handle;
  try{handle=fs.openSync(lock,'wx');}catch{
    let alive=false;const pid=Number(fs.readFileSync(lock,'utf8'));
    if(Number.isSafeInteger(pid)&&pid>0){try{process.kill(pid,0);alive=true;}catch(e){alive=e.code!=='ESRCH';}}
    if(alive||Date.now()-fs.statSync(lock).mtimeMs<5000)throw new Error('Un’operazione di avvio è già in corso.');
    fs.unlinkSync(lock);handle=fs.openSync(lock,'wx');
  }
  fs.writeFileSync(handle,String(process.pid));
  try{
    if(command==='stop'){await stop();return;}
    if(!['start','init','services','migrate','generate','setup-catalog'].includes(command))throw new Error('Comando non riconosciuto.');
    compose('up','-d','--wait','--pull','never','postgres','redis','storage','mailpit');
    if(command==='services')return;
    if(command==='setup-catalog'){
      run(process.execPath,[medusa,'exec','./src/scripts/prepara-catalogo-ishtar.ts'],apiDir);
      return;
    }
    if(command==='generate'){
      const module=process.argv[3];if(!module||!/^[a-z][a-z0-9-]*$/.test(module))throw new Error('Indicare un nome di modulo valido.');
      run(process.execPath,[medusa,'db:generate',module],apiDir);return;
    }
    if(command==='init'||command==='migrate')run(process.execPath,[medusa,'db:migrate'],apiDir);
    if(command==='init'){
      run(process.execPath,[medusa,'exec','./src/scripts/prepara-proprietario.ts'],apiDir);
      run(process.execPath,[path.join(RADICE,'infra','prepara-archivio.mjs')]);
    }
    if(command!=='migrate')await start();
  }finally{fs.closeSync(handle);fs.unlinkSync(lock);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
