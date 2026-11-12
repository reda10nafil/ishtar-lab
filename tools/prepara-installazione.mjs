// Preparazione della consegna su un nuovo PC; non importa dati privati o seed storici.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const workspace = path.join(backend, 'piattaforma');
const options = { cwd: root, windowsHide: true };
const windows = process.platform === 'win32';
// Su Linux e macOS l'interprete si chiama di norma python3; su Windows resta python.
const python = windows ? 'python' : 'python3';
const avvio = windows ? 'Avvia Ishtar Lab.bat' : './avvia-ishtar-lab.sh';
const configurazioni = [path.join(backend, 'infra/.env'), path.join(backend, 'piattaforma/packages/api/.env')];
// Registro dei passi: se la preparazione si interrompe dopo la creazione dei .env, la nuova esecuzione riprende.
const registro = path.join(backend, '.runtime', 'preparazione.json');
function segna(completata) {
  fs.mkdirSync(path.dirname(registro), { recursive: true });
  fs.writeFileSync(registro, JSON.stringify({ completata, aggiornata: new Date().toISOString() }, null, 2));
}
function daRiprendere() {
  try { return JSON.parse(fs.readFileSync(registro, 'utf8')).completata === false; } catch { return false; }
}
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
  for (const [command, args] of [[python, ['--version']], ['bun', ['--version']], ['docker', ['compose', 'version']]]) {
    if (!available(command, args)) throw Error('Prerequisito mancante: ' + command + '. Vedere README.md.');
  }
  if (process.argv.includes('--check')) {
    console.log('Prerequisiti disponibili. Nessuna configurazione o servizio modificato.');
    return;
  }
  const mancanti = configurazioni.filter(file => !fs.existsSync(file));
  // Con un solo .env ci si ferma prima di toccare segreti e volumi, indicando come recuperare il file mancante.
  if (mancanti.length === 1) {
    if (mancanti[0] === configurazioni[0]) throw Error('Configurazione incompleta: manca backend/infra/.env. Nessun segreto è stato rigenerato. Si ricostruisce senza perdite dalle chiavi di packages/api/.env con «node backend/infra/configura-ambiente.mjs»; poi rieseguire la preparazione.');
    const copie = path.join(backend, '.runtime', 'backup-configurazione');
    throw Error('Configurazione incompleta: manca backend/piattaforma/packages/api/.env. Nessun segreto è stato rigenerato. ' + (fs.existsSync(copie)
      ? 'Ripristinarlo dalla copia più recente in backend/.runtime/backup-configurazione.'
      : 'Non esiste una copia di sicurezza: «node backend/infra/configura-ambiente.mjs» lo ricrea conservando le password dei servizi, ma con nuove chiavi di sessione e dei connettori (le credenziali dei connettori già salvate non saranno più leggibili).'));
  }
  // --riprendi completa una preparazione interrotta prima dell'esistenza del registro (es. pull RustFS fallito con le release precedenti).
  const ripresa = mancanti.length === 0 && (daRiprendere() || process.argv.includes('--riprendi'));
  if (mancanti.length === 0 && !ripresa) {
    console.log(`Questa cartella contiene già una configurazione. Usare ${avvio}; non viene reinizializzata. Se una preparazione precedente si era interrotta, rieseguirla con --riprendi.`);
    return;
  }
  if (!available('docker', ['info', '--format', '{{.ServerVersion}}'])) throw Error(windows
    ? 'Avviare Docker Desktop e riprovare.'
    : process.platform === 'linux'
      ? 'Docker non risponde. Avviarlo con «sudo systemctl start docker» e verificare che l’utente sia nel gruppo docker.'
      : 'Docker non risponde. Avviare Docker Desktop e riprovare.');
  // Volumi di un'altra copia sullo stesso PC: nuove chiavi li renderebbero inaccessibili.
  if (mancanti.length === 2 && available('docker', ['volume', 'inspect', 'ishtar_lab_redx_postgres'])) throw Error(
    'Esistono già i volumi Docker di Ishtar Lab (ishtar_lab_redx_*), probabilmente creati da un’altra copia su questo PC. '
    + 'Nuove chiavi li renderebbero inaccessibili: usare la copia che li ha creati, oppure copiare da lì backend/infra/.env, '
    + 'backend/piattaforma/packages/api/.env e backend/.credenziali-locali.env. Eliminare i volumi solo se i dati non servono più.');
  if (ripresa) console.log('Ripresa di una preparazione interrotta: i passi già completati vengono ripetuti senza rigenerare le chiavi.');
  console.log('Installazione delle dipendenze dal lockfile, senza script automatici di installazione.');
  run('bun', ['install', '--frozen-lockfile', '--ignore-scripts'], workspace);
  segna(false);
  run(process.execPath, [path.join(backend, 'infra/configura-ambiente.mjs')]);
  run('docker', ['compose', '--project-name', 'ishtar-lab-redx', '--env-file', path.join(backend, 'infra/.env'),
    '--file', path.join(backend, 'infra/compose.yaml'), 'pull']);
  run(process.execPath, [path.join(backend, 'infra/runtime.mjs'), 'init']);
  run(process.execPath, [path.join(backend, 'infra/runtime.mjs'), 'setup-catalog']);
  segna(true);
  console.log('Istanza e catalogo vuoto pronti. Credenziali generate solo su questo PC.' + (windows ? '' : ' Avviare con ./avvia-ishtar-lab.sh'));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
