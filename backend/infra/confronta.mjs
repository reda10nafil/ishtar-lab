// Confronto affiancato fra una pagina del pannello di riferimento e la stessa pagina di Ishtar Lab.
// Uso: node infra/confronta.mjs <nome> "<rotta pannello>" "<rotta console>" [--chiaro] [--azienda]
// Esempio: node infra/confronta.mjs catalogo "#/products/catalogue" "/prodotti/catalogo"
import fs from 'node:fs';
import path from 'node:path';
import { CONSOLE } from './lib.mjs';
import { accediAziendaBrowser, apriBrowser } from './lib-browser.mjs';

const PANNELLO = 'http://127.0.0.1:4173/lumelle';
const MISURE = [['largo', { width: 1440, height: 900 }], ['telefono', { width: 390, height: 844 }]];
const CARTELLA = path.resolve('..', '.scratch', 'confronti');
const ATTESA_MOVIMENTI = 2600;

const argomenti = process.argv.slice(2);
const opzioni = new Set(argomenti.filter((a) => a.startsWith('--')));
const [nome, rottaPannello, rottaConsole] = argomenti.filter((a) => !a.startsWith('--'));
if (!rottaConsole) throw new Error('Uso: node infra/confronta.mjs <nome> "<rotta pannello>" "<rotta console>" [--chiaro] [--azienda]');
fs.mkdirSync(CARTELLA, { recursive: true });

// Registra ciò che si muove: animazioni e transizioni CSS, e stili in riga cambiati da JavaScript.
const SPIA_MOVIMENTI = `(() => {
  const inizio = performance.now();
  const visti = new Map();
  const descrivi = (e) => e ? e.tagName.toLowerCase() + (e.className && e.className.baseVal === undefined ? '.' + String(e.className).trim().split(/\\s+/).slice(0, 2).join('.') : '') : '?';
  const osserva = () => {
    for (const a of document.getAnimations()) {
      const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
      if (!t) continue;
      const chiave = [descrivi(a.effect.target), a.transitionProperty || a.animationName || 'animazione', t.duration, t.delay, t.easing].join('|');
      visti.set(chiave, (visti.get(chiave) || 0) + 1);
    }
    if (performance.now() - inizio < ${ATTESA_MOVIMENTI}) requestAnimationFrame(osserva);
  };
  requestAnimationFrame(osserva);
  const inRiga = new Map();
  const spia = new MutationObserver((voci) => {
    for (const v of voci) {
      if (v.attributeName !== 'style' || !(v.target instanceof Element)) continue;
      const stile = v.target.style;
      if (!stile.transform && !stile.opacity && !stile.width && !stile.height) continue;
      const chiave = descrivi(v.target);
      const riga = inRiga.get(chiave) || { prima: performance.now() - inizio, ultima: 0, passi: 0 };
      riga.ultima = performance.now() - inizio;
      riga.passi += 1;
      inRiga.set(chiave, riga);
    }
  });
  addEventListener('DOMContentLoaded', () => spia.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['style'] }));
  window.__movimenti = () => ({
    css: [...visti.keys()],
    inRiga: [...inRiga.entries()].filter(([, r]) => r.passi > 3).map(([k, r]) => k + ': ' + Math.round(r.ultima - r.prima) + ' ms, ' + r.passi + ' passi'),
  });
})();`;

const INVENTARIO = `(() => {
  const radice = document.querySelector('main') || document.body;
  const visibile = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const testi = (sel) => [...new Set([...radice.querySelectorAll(sel)].filter(visibile).map((e) => (e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '').trim().split('\\n')[0]).filter(Boolean))];
  const scatola = (e) => { const r = e.getBoundingClientRect(); return e.tagName.toLowerCase() + ' ' + [r.x, r.y + scrollY, r.width, r.height].map(Math.round).join(' '); };
  const blocchi = [...radice.children].flatMap((e) => (e.children.length === 1 ? [...e.children[0].children] : [...e.children])).filter(visibile).slice(0, 30).map(scatola);
  return { titoli: testi('h1,h2,h3'), pulsanti: testi('button,[role=button],[role=tab]').slice(0, 60), collegamenti: testi('a').slice(0, 40), campi: testi('input,select,textarea'), blocchi, altezza: document.documentElement.scrollHeight, largo: document.documentElement.scrollWidth };
})()`;

async function apriPannello(pagina) {
  await pagina.addInitScript(SPIA_MOVIMENTI);
  await pagina.goto(`${PANNELLO}${rottaPannello}`);
  await pagina.waitForTimeout(ATTESA_MOVIMENTI);
  if (opzioni.has('--chiaro')) await pagina.getByRole('button', { name: 'Switch to light' }).click().catch(() => undefined);
}

async function apriConsole(pagina) {
  await pagina.addInitScript(SPIA_MOVIMENTI);
  if (opzioni.has('--chiaro')) await pagina.addInitScript("try { localStorage.setItem('ishtar-tema', 'chiaro') } catch {}");
  if (opzioni.has('--azienda')) await accediAziendaBrowser(pagina, 'seller@mercur.dev');
  else await pagina.goto(CONSOLE);
  await pagina.locator('.laterale').waitFor();
  await pagina.goto(`${CONSOLE}${rottaConsole}`);
  await pagina.waitForTimeout(ATTESA_MOVIMENTI);
}

const stampa = (titolo, a, b) => {
  console.log(`\n=== ${titolo}`);
  for (const chiave of ['titoli', 'pulsanti', 'collegamenti', 'campi', 'blocchi']) {
    console.log(`\n[${chiave}]`);
    console.log(`  pannello: ${a[chiave].join(' | ') || '(nessuno)'}`);
    console.log(`  console:  ${b[chiave].join(' | ') || '(nessuno)'}`);
  }
  console.log(`\n[pagina] pannello ${a.largo}x${a.altezza}, console ${b.largo}x${b.altezza}`);
};

const { browser, nuovaPagina } = await apriBrowser();
const colorScheme = opzioni.has('--chiaro') ? 'light' : 'dark';
for (const [misura, viewport] of MISURE) {
  const pannello = await nuovaPagina({ viewport, colorScheme });
  const app = await nuovaPagina({ viewport, colorScheme });
  await apriPannello(pannello);
  await apriConsole(app);

  const suffisso = `${nome}-${misura}${opzioni.has('--chiaro') ? '-chiaro' : ''}`;
  const immagini = [];
  for (const [etichetta, pagina] of [['pannello', pannello], ['console', app]]) {
    const file = path.join(CARTELLA, `${suffisso}-${etichetta}.png`);
    await pagina.screenshot({ path: file, fullPage: true });
    immagini.push([etichetta, fs.readFileSync(file).toString('base64')]);
  }
  const tela = await nuovaPagina({ viewport: { width: viewport.width * 2 + 24, height: viewport.height } });
  await tela.setContent(`<body style="margin:0;background:#333;display:flex;gap:24px;align-items:flex-start">${immagini.map(([e, d]) => `<img alt="${e}" style="width:${viewport.width}px" src="data:image/png;base64,${d}">`).join('')}</body>`);
  await tela.waitForLoadState('load');
  const affiancati = path.join(CARTELLA, `${suffisso}-affiancati.png`);
  await tela.screenshot({ path: affiancati, fullPage: true });

  stampa(misura, await pannello.evaluate(INVENTARIO), await app.evaluate(INVENTARIO));
  for (const [etichetta, pagina] of [['pannello', pannello], ['console', app]]) {
    const m = await pagina.evaluate('window.__movimenti()');
    console.log(`\n[movimenti ${etichetta}] css: ${m.css.slice(0, 25).join(' ; ') || '(nessuno)'}`);
    console.log(`[movimenti ${etichetta}] da JavaScript: ${m.inRiga.slice(0, 25).join(' ; ') || '(nessuno)'}`);
  }
  console.log(`\nImmagine affiancata: ${affiancati}`);
}
await browser.close();
