// Ferma pannello, API e servizi Docker di questa copia; i dati nei volumi restano.
// Vengono arrestati solo processi riconosciuti dalla loro riga di comando: nessun altro processo è toccato.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {appartiene, arresta} from '../backend/infra/processi.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pannelloScript=path.join(root,'avvia_pannello.py');
const pannelloStato=path.join(root,'backend','.runtime','pannello.json');
const identita='redx-pannello-recuperato-2026-11-06';

async function pannelloInAscolto(){
  try{const r=await fetch('http://127.0.0.1:4273/ishtar-lab/',{signal:AbortSignal.timeout(1000)});return r.ok&&r.headers.get('X-Redx-Recovery')===identita;}catch{return false;}
}

async function fermaPannello(){
  let pid=0;
  if(fs.existsSync(pannelloStato)){try{({pid}=JSON.parse(fs.readFileSync(pannelloStato,'utf8')));}catch{pid=0;}}
  if(appartiene(pid,pannelloScript)){
    if(!await arresta(pid))throw Error(`Pannello (PID ${pid}) non arrestato.`);
    fs.rmSync(pannelloStato,{force:true});
    return 'fermato';
  }
  fs.rmSync(pannelloStato,{force:true});
  // Un pannello avviato a mano (python3 avvia_pannello.py) non è registrato: si segnala senza arrestarlo.
  if(await pannelloInAscolto())return 'un pannello non avviato dal launcher risponde sulla porta 4273 e non viene arrestato (chiuderlo dalla sua finestra con Ctrl+C)';
  return pid?'registrato ma non più attivo':'nessun pannello attivo';
}

async function main(){
  // Prima il pannello, così non si accettano modifiche mentre l'API si ferma; il backend si ferma comunque.
  let pannelloFallito=false;
  try{console.log('Pannello: '+await fermaPannello());}catch(error){pannelloFallito=true;console.error(error.message);}
  const backend=spawnSync(process.execPath,[path.join(root,'backend','infra','runtime.mjs'),'stop'],{cwd:root,stdio:'inherit',windowsHide:true});
  if(backend.status!==0)throw Error('Backend non arrestato: leggere il messaggio qui sopra.');
  if(pannelloFallito)process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
