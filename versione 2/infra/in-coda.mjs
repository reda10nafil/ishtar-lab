// Esegue una prova alla volta: con più agenti insieme il PC rallenta e le prove si interrompono a metà,
// lasciando dati nel database. Uso: node infra/in-coda.mjs infra/prova-catalogo.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { qui } from './lib.mjs';

const lucchetto = path.join(qui, '..', '.log', 'prove.lock');
const proprietario = path.join(lucchetto, 'pid');
const ATTESA = 3000;

const vivo = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const prendi = async () => {
  let attesa = 0;
  while (true) {
    try {
      fs.mkdirSync(lucchetto);
      fs.writeFileSync(proprietario, String(process.pid));
      return;
    } catch {
      // Se chi lo teneva è morto, il lucchetto si libera.
      const pid = Number(fs.existsSync(proprietario) ? fs.readFileSync(proprietario, 'utf8') : 0);
      if (pid && !vivo(pid)) fs.rmSync(lucchetto, { recursive: true, force: true });
      if (attesa % 20 === 0) console.log(`In coda dietro al processo ${pid || '?'}...`);
      attesa += 1;
      await new Promise((r) => setTimeout(r, ATTESA));
    }
  }
};

const [prova, ...resto] = process.argv.slice(2);
if (!prova) throw new Error('Uso: node infra/in-coda.mjs infra/prova-<sezione>.mjs');
await prendi();
let uscita = 1;
try {
  uscita = spawnSync(process.execPath, [prova, ...resto], { stdio: 'inherit' }).status ?? 1;
} finally {
  fs.rmSync(lucchetto, { recursive: true, force: true });
}
process.exit(uscita);
