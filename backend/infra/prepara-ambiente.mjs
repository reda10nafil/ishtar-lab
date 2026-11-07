import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RADICE, ISTANZA, PORTE, API, CONSOLE, leggiEnv } from './istanza.mjs';
const apiFile=path.join(RADICE,'piattaforma/packages/api/.env');
const infraFile=path.join(RADICE,'infra/.env');
const credFile=path.join(RADICE,'.credenziali-locali.env');
const previous=leggiEnv(apiFile), oldInfra=leggiEnv(infraFile);
const own=previous.ISHTAR_INSTANCE_ID===ISTANZA && oldInfra.ISHTAR_INSTANCE_ID===ISTANZA;
const random=()=>crypto.randomBytes(32).toString('hex');
const keep=key=>own && previous[key] ? previous[key] : random();
const secret=key=>own && oldInfra[key] ? oldInfra[key] : random();
const infra={ISHTAR_INSTANCE_ID:ISTANZA,POSTGRES_USER:'ishtar_lab_app',POSTGRES_PASSWORD:secret('POSTGRES_PASSWORD'),POSTGRES_DB:'ishtar_lab_redx',REDIS_PASSWORD:secret('REDIS_PASSWORD'),STORAGE_ACCESS_KEY:own?oldInfra.STORAGE_ACCESS_KEY:`ishtar${crypto.randomBytes(8).toString('hex')}`,STORAGE_SECRET_KEY:secret('STORAGE_SECRET_KEY')};
function scrivi(file,values){fs.writeFileSync(file,Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});}
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
if(!own||!fs.existsSync(credFile))scrivi(credFile,{ADMIN_EMAIL:'owner@ishtar-lab.local',ADMIN_PASSWORD:random()});
for(const app of ['console','admin','vendor'])scrivi(path.join(RADICE,'piattaforma/apps',app,'.env.local'),{VITE_API_URL:API,VITE_MERCUR_BACKEND_URL:API,MERCUR_BACKEND_URL:API});
console.log(own?'Configurazione indipendente verificata; chiavi conservate.':'Configurazione indipendente e nuove chiavi create. Nessun segreto stampato.');
