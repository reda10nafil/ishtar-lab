// Prova del guscio: menu come il pannello, inglese, tema, ricerca e barra da telefono.
import path from 'node:path';
import { CONSOLE, attendiBackend, nuovaProva } from './lib.mjs';
import { accediAdminBrowser, apriBrowser, CARTELLA_SCREENSHOT } from './lib-browser.mjs';

const MENU = ['Overview', 'Orders', 'Products', 'Review', 'Outfit Studio', 'Customers', 'Analytics', 'Marketing', 'Discounts', 'Online shop', 'Shop till', 'Wholesale', 'Companies', 'Apps', 'Settings', 'Help'];
const BASSO = ['Home', 'Orders', 'Products', 'Analytics', 'More'];

const { check, chiudi } = nuovaProva();
await attendiBackend();
const { browser, nuovaPagina, errori } = await apriBrowser();

const scrivania = await nuovaPagina();
await accediAdminBrowser(scrivania);
await scrivania.waitForFunction((attese) => document.querySelectorAll('.laterale nav a').length === attese, MENU.length);
const gruppi = await scrivania.locator('.menu-gruppo').allInnerTexts();
check('Gruppi del menu come il pannello', gruppi.join('|').toLowerCase() === 'store|sell on|extend', gruppi.join(', '));
const voci = (await scrivania.locator('.laterale nav a').allInnerTexts()).map((v) => v.replace(/\s*\d+$/, '').trim());
check('Voci del menu in inglese', voci.join('|') === MENU.join('|'), voci.join(', '));
check('Lingua della pagina', (await scrivania.getAttribute('html', 'lang')) === 'en');
check('Nessun modulo di accesso', (await scrivania.getByLabel('Password').count()) === 0);
await scrivania.getByRole('button', { name: 'Switch to light' }).click();
check('Tema chiaro', (await scrivania.getAttribute('html', 'data-tema')) === 'chiaro');
await scrivania.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'guscio-chiaro.png') });
await scrivania.getByRole('button', { name: 'Switch to dark' }).click();
await scrivania.keyboard.press('Control+k');
await scrivania.getByRole('dialog', { name: 'Search' }).locator('input').fill('cloud');
await scrivania.getByRole('dialog', { name: 'Search' }).getByText('Products', { exact: true }).waitFor();
check('La ricerca trova prodotti veri', true);
await scrivania.keyboard.press('Escape');
await scrivania.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'guscio-scuro.png') });
await scrivania.goto(`${CONSOLE}/magazzino`);
await scrivania.locator('.voce.active').first().waitFor();
check('Inventory appartiene a Products nel menu', (await scrivania.locator('.voce.active').allInnerTexts()).join() === 'Products');

const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
await accediAdminBrowser(telefono).catch(() => undefined);
await telefono.locator('.barra-basso').waitFor();
const basso = await telefono.locator('.barra-basso a, .barra-basso button').allInnerTexts();
check('Barra in basso come il pannello', basso.join('|') === BASSO.join('|'), basso.join(', '));
check('Nessuno scorrimento laterale su telefono', await telefono.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await telefono.getByRole('button', { name: 'More' }).click();
await telefono.locator('.laterale--aperta').waitFor();
check('More apre il menu completo', true);
await telefono.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'guscio-telefono.png') });

check('Nessun errore JavaScript', errori.length === 0, errori[0]?.slice(0, 140));
await browser.close();
chiudi('guscio come il pannello');
