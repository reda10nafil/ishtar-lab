// Prova dei movimenti comuni: entrate, uscite, aggiornamento dei dati e movimento ridotto.
import { CONSOLE, attendiBackend, nuovaProva } from './lib.mjs';
import { apriBrowser } from './lib-browser.mjs';

const ATTESA_FINE_ENTRATA = 2600;
const ATTESA_ERRORE = 5000;

/** Elenco delle animazioni in corso, leggibile dalla prova. */
const inCorso = () => document.getAnimations().map((a) => ({
  chi: a.effect?.target?.className?.toString().split(' ')[0] || a.effect?.target?.tagName || '',
  durata: a.effect?.getTiming().duration,
  ritardo: a.effect?.getTiming().delay,
  curva: a.effect?.getTiming().easing,
}));

const { check, chiudi } = nuovaProva();
await attendiBackend();
const { browser, nuovaPagina, errori } = await apriBrowser();

const p = await nuovaPagina();
await p.addInitScript(() => {
  window.__entrate = 0;
  const originale = Element.prototype.animate;
  Element.prototype.animate = function (...a) {
    window.__entrate += 1;
    return originale.apply(this, a);
  };
});
await p.goto(CONSOLE);
await p.locator('.laterale').waitFor();
// Barra e testata partono quando i permessi sono noti.
await p.waitForFunction(() => document.getAnimations().some((a) => a.effect?.target?.classList?.contains('laterale')), null, { timeout: 60000 });
const apertura = await p.evaluate(inCorso);
check('Prima apertura: entra la barra laterale', apertura.some((a) => a.chi === 'laterale' && a.durata === 740));
check('Prima apertura: entra la testata', apertura.some((a) => a.chi === 'testata' && a.durata === 700));
await p.waitForTimeout(ATTESA_FINE_ENTRATA);

// Cambio di pagina: uscita, poi entrata con vista, lettere e blocchi.
await p.evaluate(() => {
  window.__viste = [];
  const spia = () => {
    for (const a of document.getAnimations()) {
      const t = a.effect?.getTiming();
      const e = a.effect?.target;
      if (!t || !e) continue;
      const nome = e.classList?.contains('vista') ? `vista:${t.duration}` : e.classList?.contains('lettera') ? `lettera:${t.duration}` : e.classList?.contains('vetro') ? `blocco:${t.duration}` : null;
      if (nome && !window.__viste.includes(nome)) window.__viste.push(nome);
    }
    requestAnimationFrame(spia);
  };
  requestAnimationFrame(spia);
});
await p.locator('.laterale .voce', { hasText: 'Apps' }).click();
await p.getByRole('heading', { name: 'Apps' }).waitFor();
await p.waitForTimeout(ATTESA_FINE_ENTRATA);
const viste = await p.evaluate(() => window.__viste);
check('La pagina vecchia esce in 180 ms', viste.includes('vista:180'), viste.join(' '));
check('La pagina nuova entra in 700 ms', viste.includes('vista:700'));
check('Le lettere del titolo salgono in 850 ms', viste.includes('lettera:850'));
check('I blocchi entrano in 800 ms', viste.includes('blocco:800'));
check('Il titolo resta leggibile per le tecnologie assistive', (await p.locator('h1').first().getAttribute('aria-label')) !== null);

// La pillola del menu si allunga mentre scorre.
const ritagli = await p.evaluate(() => new Promise((risolvi) => {
  const pillola = document.querySelector('.menu-pillola');
  const visti = new Set();
  const inizio = performance.now();
  const guarda = () => {
    visti.add(pillola.style.clipPath);
    if (performance.now() - inizio < 420) requestAnimationFrame(guarda);
    else risolvi(visti.size);
  };
  document.querySelectorAll('.laterale .voce')[1].click();
  requestAnimationFrame(guarda);
}));
check('La pillola del menu scorre a passi', ritagli > 2, `${ritagli} passi`);
await p.waitForTimeout(ATTESA_FINE_ENTRATA);

// Un aggiornamento dei dati non rifà le entrate.
await p.goto(`${CONSOLE}/ordini/tutti`);
await p.locator('tbody tr').first().waitFor();
await p.waitForTimeout(ATTESA_FINE_ENTRATA);
const prima = await p.evaluate(() => window.__entrate);
await p.evaluate(() => window.dispatchEvent(new Event('focus')));
await p.waitForTimeout(21000);
const dopo = await p.evaluate(() => ({ entrate: window.__entrate, attive: document.getAnimations().filter((a) => a.effect?.target?.closest?.('.contenuto')).length }));
check('Un aggiornamento ogni 20 secondi non riparte da capo', dopo.entrate === prima && dopo.attive === 0, `${dopo.entrate - prima} animazioni nuove`);

// Le scorciatoie aprono l'elenco e il cursore resta nel campo anche se i dati si aggiornano.
await p.locator('h1').first().click();
await p.keyboard.press('?');
const elenco = p.getByRole('dialog', { name: 'Keyboard shortcuts' });
await elenco.waitFor();
check('Il tasto ? apre le scorciatoie', true);
await p.keyboard.press('Escape');
await elenco.waitFor({ state: 'hidden' });
await p.keyboard.press('Control+k');
const ricerca = p.getByRole('dialog', { name: 'Search' });
await ricerca.waitFor();
await p.keyboard.press('Escape');
await ricerca.waitFor({ state: 'hidden' });
check('La ricerca si apre e si chiude', true);

// Il movimento ridotto spegne tutto.
const ridotto = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce', locale: 'it-IT' });
const q = await ridotto.newPage();
q.on('pageerror', (e) => errori.push(e.message));
await q.goto(CONSOLE);
await q.locator('.laterale').waitFor();
await q.waitForTimeout(600);
check('Movimento ridotto: nessuna animazione alla prima apertura', (await q.evaluate(() => document.getAnimations().length)) === 0);
await q.locator('.laterale .voce', { hasText: 'Apps' }).click();
await q.getByRole('heading', { name: 'Apps' }).waitFor({ timeout: ATTESA_ERRORE });
check('Movimento ridotto: la pagina cambia senza uscita', (await q.evaluate(() => document.getAnimations().length)) === 0);
await ridotto.close();

check('Nessun errore JavaScript', errori.length === 0, errori[0]?.slice(0, 140));
await browser.close();
chiudi('movimenti comuni');
