// Strumenti comuni alle prove nel browser: apertura di Playwright, accesso e raccolta degli errori.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CONSOLE, PASSWORD_DEMO, qui } from './lib.mjs';

const require = createRequire(path.join(qui, '..', 'piattaforma', 'packages', 'api', 'package.json'));
const { chromium } = require(path.resolve(qui, '..', '..', 'node_modules', 'playwright'));

export const CARTELLA_SCREENSHOT = path.resolve(qui, '..', '..', '.scratch', 'console');
fs.mkdirSync(CARTELLA_SCREENSHOT, { recursive: true });

export async function apriBrowser() {
  const browser = await chromium.launch();
  const errori = [];
  const nuovaPagina = async ({ viewport = { width: 1440, height: 900 }, colorScheme = 'dark' } = {}) => {
    const contesto = await browser.newContext({ viewport, colorScheme, locale: 'it-IT' });
    const pagina = await contesto.newPage();
    pagina.setDefaultTimeout(15000);
    pagina.on('pageerror', (e) => errori.push(e.message));
    pagina.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errori.push(m.text());
    });
    return pagina;
  };
  return { browser, nuovaPagina, errori };
}

/** L'amministratore entra direttamente: basta aprire la console. */
export async function accediAdminBrowser(pagina) {
  await pagina.goto(CONSOLE);
  await pagina.locator('.laterale').waitFor();
}

export async function accediAziendaBrowser(pagina, email, password = PASSWORD_DEMO) {
  await pagina.goto(`${CONSOLE}/accesso-azienda`);
  await pagina.getByLabel('Email').fill(email);
  await pagina.getByLabel('Password').fill(password);
  await pagina.getByRole('button', { name: 'Sign in', exact: true }).click();
  await pagina.locator('.laterale').waitFor();
}

