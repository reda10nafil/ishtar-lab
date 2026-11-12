// Scrive packages/api/.env dai segreti locali di infra/.env e ne genera di nuovi.
// Non stampa mai i valori. Rieseguirlo conserva i segreti gia presenti.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiEnv = path.join(here, '..', 'piattaforma', 'packages', 'api', '.env');

function parse(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const infra = parse(path.join(here, '.env'));
const previous = parse(apiEnv);
const keep = (name, size = 32) => (previous[name] && previous[name] !== 'supersecret' ? previous[name] : crypto.randomBytes(size).toString('hex'));
const API_PORT = 9100;
const CONSOLE = 'http://localhost:5180,http://127.0.0.1:5180';
const backend = `http://localhost:${API_PORT}`;

const values = {
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  MEDUSA_BACKEND_URL: backend,
  MEDUSA_DISABLE_TELEMETRY: 'true',
  MERCUR_DISABLE_TELEMETRY: 'true',
  DO_NOT_TRACK: '1',
  DATABASE_URL: `postgres://${infra.POSTGRES_USER}:${infra.POSTGRES_PASSWORD}@127.0.0.1:55500/${infra.POSTGRES_DB}`,
  REDIS_URL: 'redis://127.0.0.1:56500',
  STORE_CORS: 'http://localhost:8000',
  ADMIN_CORS: `http://localhost:7000,${backend},${CONSOLE}`,
  VENDOR_CORS: `http://localhost:7001,${backend},${CONSOLE}`,
  AUTH_CORS: `http://localhost:7000,http://localhost:7001,${backend},${CONSOLE}`,
  JWT_SECRET: keep('JWT_SECRET'),
  COOKIE_SECRET: keep('COOKIE_SECRET'),
  CONNECTORS_KEY: keep('CONNECTORS_KEY'),
  S3_FILE_URL: 'http://127.0.0.1:59500/multi-outfit',
  S3_ENDPOINT: 'http://127.0.0.1:59500',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'multi-outfit',
  S3_ACCESS_KEY_ID: infra.STORAGE_ACCESS_KEY,
  S3_SECRET_ACCESS_KEY: infra.STORAGE_SECRET_KEY,
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '51500',
  SMTP_FROM: 'Multi Outfit <noreply@multioutfit.test>',
  PUBLIC_BACKEND_URL: backend,
  CONSOLE_URL: 'http://localhost:5180',
  CONNECTORS_DEMO_URL: 'http://127.0.0.1:59700',
  MERCUR_VENDOR_URL: `${backend}/seller`,
  STOREFRONT_REVALIDATE_URL: 'http://localhost:3000',
  STOREFRONT_REVALIDATE_SECRET: keep('STOREFRONT_REVALIDATE_SECRET'),
};
fs.writeFileSync(apiEnv, `${Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n')}\n`, { mode: 0o600 });
console.log(`configurazione scritta: ${Object.keys(values).length} variabili`);
