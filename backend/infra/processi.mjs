// Identità e arresto dei soli processi avviati da questa copia, su Windows, Linux e macOS.
// Un processo è riconosciuto solo se la sua riga di comando contiene il percorso assoluto dello script della copia.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const valido = pid => Number.isSafeInteger(pid) && pid > 0;
const attendi = ms => new Promise(resolve => setTimeout(resolve, ms));

export function rigaComando(pid) {
  if (!valido(pid)) return '';
  try {
    if (process.platform === 'win32') {
      const cmd = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'; if($p){$p.CommandLine}`;
      return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { encoding: 'utf8', windowsHide: true });
    }
    const proc = `/proc/${pid}/cmdline`;
    if (fs.existsSync(proc)) return fs.readFileSync(proc, 'utf8').split('\0').join(' ');
    return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
  } catch { return ''; }
}

export function appartiene(pid, script) {
  return valido(pid) && Boolean(script) && rigaComando(pid).includes(script);
}

export function vivo(pid) {
  if (!valido(pid)) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// Termina il processo con i suoi figli. Su Linux/macOS i processi avviati staccati guidano un proprio
// gruppo: prima SIGTERM per una chiusura ordinata, SIGKILL solo se non termina entro l'attesa.
export async function arresta(pid, { attesa = 15000 } = {}) {
  if (!valido(pid)) return false;
  if (process.platform === 'win32') {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'inherit', windowsHide: true });
    return true;
  }
  const segnale = s => {
    try { process.kill(-pid, s); } catch { try { process.kill(pid, s); } catch { /* già terminato */ } }
  };
  const terminato = async ms => {
    const limite = Date.now() + ms;
    while (Date.now() < limite) {
      if (!vivo(pid)) return true;
      await attendi(200);
    }
    return !vivo(pid);
  };
  segnale('SIGTERM');
  if (await terminato(attesa)) return true;
  segnale('SIGKILL');
  return terminato(5000);
}
