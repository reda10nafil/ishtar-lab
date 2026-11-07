// Preparazione della consegna su un nuovo PC; non importa dati privati o seed storici.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const workspace = path.join(backend, 'piattaforma');
const options = { cwd: root, windowsHide: true };
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { ...options, cwd, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw Error('Operazione non completata: ' + command);
}
function available(command, args) {
  const result = spawnSync(command, args, { ...options, stdio: 'ignore' });
  return !result.error && result.status === 0;
}
async function main() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 22)) throw Error('Serve Node.js almeno 22.22.');
  for (const [command, args] of [['python', ['--version']], ['bun', ['--version']], ['docker', ['compose', 'version']]]) {
    if (!available(command, args)) throw Error('Prerequisito mancante: ' + command + '. Vedere README.md.');
  }
  if (process.argv.includes('--check')) {
    console.log('Prerequisiti disponibili. Nessuna configurazione o servizio modificato.');
    return;
  }
  if (fs.existsSync(path.join(backend, 'infra/.env')) || fs.existsSync(path.join(backend, 'piattaforma/packages/api/.env'))) {
    console.log('Questa cartella contiene già una configurazione. Usare Avvia Ishtar Lab.bat; non viene reinizializzata.');
    return;
  }
  if (!available('docker', ['info', '--format', '{{.ServerVersion}}'])) throw Error('Avviare Docker Desktop e riprovare.');
  console.log('Installazione delle dipendenze dal lockfile, senza script automatici di installazione.');
  run('bun', ['install', '--frozen-lockfile', '--ignore-scripts'], workspace);
  run(process.execPath, [path.join(backend, 'infra/configura-ambiente.mjs')]);
  run('docker', ['compose', '--project-name', 'ishtar-lab-redx', '--env-file', path.join(backend, 'infra/.env'),
    '--file', path.join(backend, 'infra/compose.yaml'), 'pull']);
  run(process.execPath, [path.join(backend, 'infra/runtime.mjs'), 'init']);
  run(process.execPath, [path.join(backend, 'infra/runtime.mjs'), 'setup-catalog']);
  console.log('Istanza e catalogo vuoto pronti. Credenziali generate solo su questo PC.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
