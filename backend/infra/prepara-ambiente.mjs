import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RADICE, ISTANZA, PORTE, API, CONSOLE, leggiEnv } from './istanza.mjs';
const apiFile=path.join(RADICE,'piattaforma/packages/api/.env');
const infraFile=path.join(RADICE,'infra/.env');
const credFile=path.join(RADICE,'.credenziali-locali.env');
const previous=leggiEnv(apiFile), oldInfra=leggiEnv(infraFile);
const ownApi=previous.ISHTAR_INSTANCE_ID===ISTANZA, ownInfra=oldInfra.ISHTAR_INSTANCE_ID===ISTANZA;
const own=ownApi && ownInfra;
const random=()=>crypto.randomBytes(32).toString('hex');
// Ogni chiave della copia si conserva dal file che la contiene. Se manca infra/.env, password e chiavi dei
// servizi si ricavano dagli URL di packages/api/.env: rigenerarle renderebbe inaccessibili i volumi esistenti.
const daUrl=(url,campo)=>{try{return decodeURIComponent(new URL(url)[campo]);}catch{return '';}};
const recuperabili=ownApi?{POSTGRES_PASSWORD:daUrl(previous.DATABASE_URL,'password'),REDIS_PASSWORD:daUrl(previous.REDIS_URL,'password'),STORAGE_ACCESS_KEY:previous.S3_ACCESS_KEY_ID,STORAGE_SECRET_KEY:previous.S3_SECRET_ACCESS_KEY}:{};
const keep=key=>ownApi && previous[key] ? previous[key] : random();
const secret=key=>(ownInfra && oldInfra[key]) || recuperabili[key] || random();
const infra={ISHTAR_INSTANCE_ID:ISTANZA,POSTGRES_USER:'ishtar_lab_app',POSTGRES_PASSWORD:secret('POSTGRES_PASSWORD'),POSTGRES_DB:'ishtar_lab_redx',REDIS_PASSWORD:secret('REDIS_PASSWORD'),STORAGE_ACCESS_KEY:(ownInfra && oldInfra.STORAGE_ACCESS_KEY) || recuperabili.STORAGE_ACCESS_KEY || `ishtar${crypto.randomBytes(8).toString('hex')}`,STORAGE_SECRET_KEY:secret('STORAGE_SECRET_KEY')};
// Copia di sicurezza (permessi 600) di un file che sta per cambiare contenuto, in .runtime/backup-configurazione.
const backupDir=path.join(RADICE,'.runtime','backup-configurazione',new Date().toISOString().replace(/[:.]/g,'-'));
const posix=process.platform!=='win32';
function scrivi(file,values){
  const testo=Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n';
  if(fs.existsSync(file)){
    if(posix)fs.chmodSync(file,0o600);
    if(fs.readFileSync(file,'utf8')===testo)return;
    fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
    // Il prefisso .env. mantiene le copie coperte dalle regole .gitignore sui file .env.* anche fuori da .runtime.
    const copia=path.join(backupDir,'.env.'+path.relative(RADICE,file).replace(/[\\/]/g,'__'));
    fs.copyFileSync(file,copia);fs.chmodSync(copia,0o600);
  }
  fs.writeFileSync(file,testo,{mode:0o600});
  if(posix)fs.chmodSync(file,0o600);
}
const consoles=`${CONSOLE},http://localhost:${PORTE.console}`;
const fronts=`http://127.0.0.1:${PORTE.frontend},http://localhost:${PORTE.frontend}`;
scrivi(infraFile,infra);
scrivi(apiFile,{
  ISHTAR_INSTANCE_ID:ISTANZA,NODE_ENV:'development',PORT:String(PORTE.api),MEDUSA_BACKEND_URL:API,MERCUR_BACKEND_URL:API,VITE_MERCUR_BACKEND_URL:API,
  MEDUSA_DISABLE_TELEMETRY:'true',MERCUR_DISABLE_TELEMETRY:'true',DO_NOT_TRACK:'1',
  DATABASE_URL:`postgres://${infra.POSTGRES_USER}:${infra.POSTGRES_PASSWORD}@127.0.0.1:${PORTE.postgres}/${infra.POSTGRES_DB}`,
  REDIS_URL:`redis://:${infra.REDIS_PASSWORD}@127.0.0.1:${PORTE.redis}`,
  STORE_CORS:fronts,ADMIN_CORS:`${API},${consoles},${fronts}`,VENDOR_CORS:`${API},${consoles}`,AUTH_CORS:`${API},${consoles},${fronts}`,
  JWT_SECRET:keep('JWT_SECRET'),COOKIE_SECRET:keep('COOKIE_SECRET'),CONNECTORS_KEY:keep('CONNECTORS_KEY'),
  S3_FILE_URL:`http://127.0.0.1:${PORTE.storage}/ishtar-lab-assets`,S3_ENDPOINT:`http://127.0.0.1:${PORTE.storage}`,S3_REGION:'us-east-1',S3_BUCKET:'ishtar-lab-assets',S3_ACCESS_KEY_ID:infra.STORAGE_ACCESS_KEY,S3_SECRET_ACCESS_KEY:infra.STORAGE_SECRET_KEY,
  SMTP_HOST:'127.0.0.1',SMTP_PORT:String(PORTE.smtp),SMTP_FROM:'Ishtar Lab <noreply@ishtar-lab.local>',
  PUBLIC_BACKEND_URL:API,CONSOLE_URL:CONSOLE,MERCUR_VENDOR_URL:`${API}/seller`,CONNECTORS_DEMO_URL:'',
  STOREFRONT_REVALIDATE_URL:'',STOREFRONT_REVALIDATE_SECRET:keep('STOREFRONT_REVALIDATE_SECRET'),
});
// La password del proprietario non viene mai sostituita: nel database esistente resterebbe quella vecchia.
if(!fs.existsSync(credFile))scrivi(credFile,{ADMIN_EMAIL:'owner@ishtar-lab.local',ADMIN_PASSWORD:random()});
else if(posix)fs.chmodSync(credFile,0o600);
if(ownInfra&&!ownApi)console.warn('Attenzione: packages/api/.env mancava. Password dei servizi conservate, ma JWT_SECRET, COOKIE_SECRET e CONNECTORS_KEY sono nuove: ripetere l’accesso e ricollegare i connettori già salvati.');
for(const app of ['console','admin','vendor'])scrivi(path.join(RADICE,'piattaforma/apps',app,'.env.local'),{VITE_API_URL:API,VITE_MERCUR_BACKEND_URL:API,MERCUR_BACKEND_URL:API});
console.log(own?'Configurazione indipendente verificata; chiavi conservate.':(ownApi||ownInfra)?'Configurazione ricostruita: chiavi esistenti conservate, mancanti create. Nessun segreto stampato.':'Configurazione indipendente e nuove chiavi create. Nessun segreto stampato.');
