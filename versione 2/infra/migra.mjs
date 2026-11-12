// Applica le migrazioni con un lucchetto: più sessioni di lavoro non devono farlo nello stesso momento.
// Uso: node infra/migra.mjs [genera <modulo>]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { qui } from './lib.mjs';

const lucchetto = path.join(qui, '..', '.log', 'migrazione.lock');
const api = path.join(qui, '..', 'piattaforma', 'packages', 'api');
const attesaMassima = Date.now() + 5 * 60 * 1000;

const prendi = async () => {
  while (true) {
    try {
      fs.mkdirSync(lucchetto);
      return;
    } catch {
      if (Date.now() > attesaMassima) throw new Error(`Lucchetto occupato: ${lucchetto}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
};

const esegui = (...argomenti) => {
  const esito = spawnSync('bun', ['x', 'medusa', ...argomenti], { cwd: api, stdio: 'inherit', shell: true });
  if (esito.status !== 0) throw new Error(`medusa ${argomenti.join(' ')}: uscita ${esito.status}`);
};

await prendi();
try {
  const [azione, modulo] = process.argv.slice(2);
  if (azione === 'genera') esegui('db:generate', modulo);
  else esegui('db:migrate');
} finally {
  fs.rmdirSync(lucchetto);
}
