import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ISTANZA = 'ishtar-lab-redx';
export const PORTE = Object.freeze({ frontend:4273, api:9273, console:5283, postgres:55730, redis:56730, email:58730, smtp:51730, storage:59730, storageConsole:59731, demo:59732 });
export const API = `http://127.0.0.1:${PORTE.api}`;
export const CONSOLE = `http://127.0.0.1:${PORTE.console}`;
export const COMPOSE = path.join(RADICE, 'infra', 'compose.yaml');
export function leggiEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).flatMap(line=>{const m=/^([A-Z0-9_]+)=(.*)$/.exec(line);return m?[[m[1],m[2]]]:[];}));
}
export function verificaIsolamento() {
  const env=leggiEnv(path.join(RADICE,'piattaforma/packages/api/.env'));
  const infra=leggiEnv(path.join(RADICE,'infra/.env'));
  if(env.ISHTAR_INSTANCE_ID!==ISTANZA||infra.ISHTAR_INSTANCE_ID!==ISTANZA) throw new Error('Preparare la configurazione: node infra/configura-ambiente.mjs');
  const db=new URL(env.DATABASE_URL),redis=new URL(env.REDIS_URL);
  if(db.hostname!=='127.0.0.1'||db.port!==String(PORTE.postgres)||db.pathname!=='/ishtar_lab_redx'||redis.hostname!=='127.0.0.1'||redis.port!==String(PORTE.redis)) throw new Error('Database o Redis non appartengono alla copia Ishtar Lab.');
  if(infra.POSTGRES_DB!=='ishtar_lab_redx'||db.username!==infra.POSTGRES_USER||db.password!==infra.POSTGRES_PASSWORD||redis.password!==infra.REDIS_PASSWORD||env.S3_ACCESS_KEY_ID!==infra.STORAGE_ACCESS_KEY||env.S3_SECRET_ACCESS_KEY!==infra.STORAGE_SECRET_KEY)throw new Error('Configurazione dei servizi della copia non coerente.');
  if(env.S3_ENDPOINT!==`http://127.0.0.1:${PORTE.storage}`||env.S3_BUCKET!=='ishtar-lab-assets'||env.PUBLIC_BACKEND_URL!==API||env.SMTP_PORT!==String(PORTE.smtp)) throw new Error('Archivi o servizi non appartengono alla copia Ishtar Lab.');
  return env;
}
