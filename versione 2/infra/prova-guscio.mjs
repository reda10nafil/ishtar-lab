// Prova del guscio: ogni funzione del guscio del pannello, voce per voce. L'elenco è in `.scratch/ishtar-lab/confronti/guscio.md`.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { CONSOLE, accediAdmin, attendiBackend, chiama, nuovaProva } from './lib.mjs';
import { accediAdminBrowser, apriBrowser, CARTELLA_SCREENSHOT } from './lib-browser.mjs';

const MENU = ['Overview', 'Orders', 'Products', 'Review', 'Outfit Studio', 'Customers', 'Analytics', 'Marketing', 'Discounts', 'Online shop', 'Shop till', 'Wholesale', 'Companies', 'Apps', 'Settings', 'Help'];
const BASSO = ['Home', 'Orders', 'Products', 'Analytics', 'More'];
const SOTTOVOCI = {
  Orders: ['All orders', 'Drafts', 'Returns', 'Fulfilment'],
  Products: ['Catalogue', 'Inventory', 'Collections'],
  Customers: ['People', 'Segments'],
  Analytics: ['Sales', 'Traffic', 'Report builder'],
  Marketing: ['Campaigns', 'Automations'],
  Discounts: ['Codes', 'Gift cards'],
};
const ROTTE = { Overview: '/', Orders: '/ordini/tutti', Products: '/prodotti/catalogo', Customers: '/clienti/persone', Analytics: '/analisi/vendite', Marketing: '/marketing/campagne', Discounts: '/sconti/codici', 'Online shop': '/negozio-online', 'Shop till': '/cassa', Wholesale: '/ingrosso', Companies: '/aziende', Apps: '/connettori', Settings: '/impostazioni/negozio', Help: '/assistenza', Review: '/revisione', 'Outfit Studio': '/outfit' };
const BRICIOLE = [['/ordini/tutti', 'Orders All orders'], ['/negozio-online', 'Sales channels Online shop'], ['/impostazioni/negozio', 'Settings Store'], ['/assistenza', 'Help'], ['/magazzino', 'Products Inventory']];
const TASTI = [[['g', 'o'], '/'], [['g', 'r'], '/ordini/tutti'], [['g', 'p'], '/prodotti/catalogo'], [['g', 'c'], '/clienti/persone'], [['g', 'a'], '/analisi/vendite'], [['g', 'm'], '/marketing/campagne'], [['g', 't'], '/cassa']];

const { check, chiudi } = nuovaProva();
await attendiBackend();
const { browser, nuovaPagina, errori } = await apriBrowser();

const percorso = (p) => new URL(p.url()).pathname;
/** Le voci della tendina aperta, senza la copia inerte che resta per l'uscita della precedente. */
const VOCI_TENDINA = (p) => p.locator('.tendina__pannello:not([inert]) a');
const inRotta = (p, rotta) => p.waitForFunction((r) => location.pathname === r, rotta);
const pronto = (p) => p.locator('.laterale nav a').nth(MENU.length - 1).waitFor({ timeout: 60000 });
/** Altri lavori fanno ripartire il backend: prima di aprire una pagina si aspetta che risponda. */
const vai = async (p, rotta) => {
  await attendiBackend();
  await p.goto(`${CONSOLE}${rotta}`);
  await pronto(p);
};
/** Esegue un controllo senza fermare la prova: un'assenza diventa un KO con il motivo. */
const voce = async (nome, azione) => {
  try {
    const dettaglio = await azione();
    check(nome, dettaglio !== false, typeof dettaglio === 'string' ? dettaglio : '');
  } catch (errore) {
    check(nome, false, String(errore.message).split('\n')[0].slice(0, 150));
  }
};

const p = await nuovaPagina();
await accediAdminBrowser(p);
await pronto(p);
const fondoIniziale = await p.locator('.laterale nav a').count();
check('Tutte le voci del menu', fondoIniziale === MENU.length, String(fondoIniziale));
const gruppi = await p.locator('.menu-gruppo').allInnerTexts();
check('Gruppi del menu come il pannello', gruppi.join('|').toLowerCase() === 'store|sell on|extend', gruppi.join(', '));
const voci = (await p.locator('.laterale nav a').allInnerTexts()).map((v) => v.replace(/\s*\d+$/, '').trim());
check('Voci del menu in inglese', voci.join('|') === MENU.join('|'), voci.join(', '));
check('Lingua della pagina', (await p.getAttribute('html', 'lang')) === 'en');
check('Nessun modulo di accesso', (await p.getByLabel('Password').count()) === 0);
check('Collegamento per saltare al contenuto', (await p.locator('.salta').getAttribute('href')) === '#contenuto');

// Barra laterale
for (const nome of MENU) {
  await voce(`Menu: ${nome}`, async () => {
    await p.locator('.laterale .voce', { hasText: new RegExp(`^${nome}`) }).first().click();
    await inRotta(p, ROTTE[nome]);
  });
  if (SOTTOVOCI[nome]) {
    await voce(`Sotto-voci di ${nome}`, async () => {
      await p.locator('.sottovoce').first().waitFor();
      const lette = await p.locator('.sottovoce').allInnerTexts();
      return lette.join('|') === SOTTOVOCI[nome].join('|') || lette.join(', ');
    });
  }
}
await voce('Sotto-voce porta alla scheda', async () => {
  await p.locator('.laterale .voce', { hasText: 'Discounts' }).click();
  await p.locator('.sottovoce', { hasText: 'Gift cards' }).click();
  await inRotta(p, '/sconti/carte-regalo');
  await p.locator('.sottovoce--attiva', { hasText: 'Gift cards' }).waitFor();
});
await voce('Settings resta la voce attiva nelle sue schede', async () => {
  await vai(p, `/team`);
  return (await p.locator('.voce.active').innerText()).trim() === 'Settings';
});
await voce('Il marchio porta a Overview', async () => {
  await p.locator('.marchio__link').click();
  await inRotta(p, '/');
});
await voce('Riduci menu con il pulsante e con [', async () => {
  await p.getByRole('button', { name: 'Collapse sidebar' }).click();
  await p.waitForFunction(() => document.querySelector('.laterale').getBoundingClientRect().width < 90);
  await p.keyboard.press('[');
  await p.waitForFunction(() => document.querySelector('.laterale').getBoundingClientRect().width > 240);
});

// Testata
for (const [rotta, attese] of BRICIOLE) {
  await voce(`Briciole su ${rotta}`, async () => {
    await vai(p, `${rotta}`);
    const testo = (await p.locator('.briciole').evaluate((e) => [...e.children].filter((f) => !f.classList.contains('briciole__telefono')).map((f) => f.textContent).join(' '))).trim();
    return testo === `Ishtar Lab ${attese}`.replace(/\s+/g, ' ') || testo.replace(/\s+/g, ' ') === `Ishtar Lab ${attese}` || testo;
  });
}
await voce('Titolo della scheda del browser', async () => {
  await vai(p, '/ordini/bozze');
  return (await p.title()) === 'Drafts · Orders — Ishtar Lab' || (await p.title());
});
await voce('Le briciole portano alla sezione', async () => {
  await vai(p, `/ordini/bozze`);
  await p.locator('.briciole a', { hasText: 'Orders' }).click();
  await inRotta(p, '/ordini/tutti');
});
await voce('Il blocco live porta al negozio online', async () => {
  await p.locator('.stato-rete').click();
  await inRotta(p, '/negozio-online');
});
await voce('Tema chiaro e scuro dalla testata', async () => {
  await p.getByRole('button', { name: 'Switch to light' }).click();
  const chiaro = await p.getAttribute('html', 'data-tema');
  await p.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'guscio-chiaro.png') });
  await p.getByRole('button', { name: 'Switch to dark' }).click();
  return chiaro === 'chiaro' && (await p.getAttribute('html', 'data-tema')) === 'scuro';
});

// Menu New: i moduli si aprono sul posto
await vai(p, `/`);
for (const [testo, dialogo] of [['Order', 'New order'], ['Product', 'New product'], ['Customer', /customer/i], ['Discount code', /discount/i], ['Campaign', /campaign/i]]) {
  await voce(`New: ${testo} apre il modulo sul posto`, async () => {
    await p.locator('.testata__nuovo').click();
    await VOCI_TENDINA(p).filter({ hasText: new RegExp(`^\\s*${testo}\\s*$`) }).click();
    const modulo = p.getByRole('dialog', { name: dialogo });
    await modulo.waitFor();
    const fermo = percorso(p) === '/';
    await p.keyboard.press('Escape');
    await modulo.waitFor({ state: 'hidden' });
    return fermo;
  });
}
for (const [testo, rotta] of [['Outfit', '/outfit'], ['Open the shop till', '/cassa']]) {
  await voce(`New: ${testo}`, async () => {
    await vai(p, `/`);
    await p.locator('.testata__nuovo').click();
    await VOCI_TENDINA(p).filter({ hasText: testo }).click();
    await inRotta(p, rotta);
  });
}

// Menu account
await vai(p, `/`);
const apriConto = async () => {
  await p.getByRole('button', { name: 'Your account' }).click();
  await p.locator('.tendina__pannello:not([inert])').first().waitFor();
};
for (const [testo, tema] of [['Light', 'chiaro'], ['Dark', 'scuro']]) {
  await voce(`Account: ${testo}`, async () => {
    await apriConto();
    await p.locator('.tendina__pannello:not([inert]) button', { hasText: testo }).click();
    const giusto = (await p.getAttribute('html', 'data-tema')) === tema;
    const aperto = await p.locator('.tendina__pannello').count();
    await p.keyboard.press('Escape');
    await p.locator('.tendina__pannello:not([inert]) .tendina__testa').waitFor({ state: 'hidden' });
    return giusto && aperto > 0;
  });
}
await voce('Account: Match system', async () => {
  await apriConto();
  await p.locator('.tendina__pannello:not([inert]) button', { hasText: 'Match system' }).click();
  const libero = (await p.evaluate(() => localStorage.getItem('ishtar-tema'))) === null;
  await p.keyboard.press('Escape');
  await p.locator('.tendina__pannello:not([inert]) .tendina__testa').waitFor({ state: 'hidden' });
  return libero;
});
for (const [testo, rotta] of [['Store settings', '/impostazioni/negozio'], ['Team', '/team'], ['Help & support', '/assistenza']]) {
  await voce(`Account: ${testo}`, async () => {
    await apriConto();
    await VOCI_TENDINA(p).filter({ hasText: testo }).click();
    await inRotta(p, rotta);
  });
}
await voce('Account: Keyboard shortcuts', async () => {
  await apriConto();
  await p.locator('.tendina__pannello:not([inert]) button', { hasText: 'Keyboard shortcuts' }).click();
  const elenco = p.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await elenco.waitFor();
  await p.keyboard.press('Escape');
  await elenco.waitFor({ state: 'hidden' });
});
await voce('Account: la voce Sign out esiste', async () => {
  await apriConto();
  const quante = await p.locator('.tendina__pannello:not([inert]) button', { hasText: 'Sign out' }).count();
  await p.keyboard.press('Escape');
  return quante === 1;
});

// Ricerca
await vai(p, `/`);
const finestra = p.getByRole('dialog', { name: 'Search' });
const campo = finestra.locator('input');
const apriRicerca = async () => {
  await p.keyboard.press('Control+k');
  await finestra.waitFor();
};
const chiudiRicerca = async () => {
  await p.keyboard.press('Escape');
  await finestra.waitFor({ state: 'hidden' });
};
const attiva = () => finestra.locator('[aria-selected="true"]').innerText();
await apriRicerca();
await voce('Ricerca: elenco iniziale con ordini, prodotti, pagine e azioni', async () => {
  await finestra.locator('.ricerca__gruppo', { hasText: 'Actions' }).waitFor();
  await finestra.locator('.ricerca__voce').first().waitFor();
  const gruppiRicerca = await finestra.locator('.ricerca__gruppo').allInnerTexts();
  return gruppiRicerca.join('|').toLowerCase() === 'orders|products|go to|actions' || gruppiRicerca.join(', ');
});
await voce('Ricerca: pagine con le loro schede', async () => {
  const testo = (await finestra.locator('.ricerca__voce', { hasText: 'Sales channels' }).innerText()).replace(/\s+/g, ' ');
  return testo.includes('Online shop · Shop till · Wholesale') || testo;
});
await voce('Ricerca: frecce senza giro e prima riga attiva', async () => {
  const prima = await attiva();
  await p.keyboard.press('ArrowUp');
  const ferma = (await attiva()) === prima;
  await p.keyboard.press('ArrowDown');
  const seconda = await attiva();
  await p.keyboard.press('ArrowUp');
  return ferma && seconda !== prima && (await attiva()) === prima;
});
await voce('Ricerca: il mouse sposta la riga attiva', async () => {
  const riga = finestra.locator('.ricerca__voce').nth(2);
  await riga.hover();
  await p.waitForFunction(() => document.querySelectorAll('.ricerca__voce')[2].getAttribute('aria-selected') === 'true');
});
await voce('Ricerca: pagina con il suo percorso', async () => {
  await campo.fill('gift');
  await finestra.locator('.ricerca__voce', { hasText: 'Discounts › Gift cards' }).click();
  await inRotta(p, '/sconti/carte-regalo');
});
await voce('Ricerca: azione apre il modulo sul posto', async () => {
  await vai(p, `/`);
  await apriRicerca();
  await campo.fill('new order');
  await finestra.locator('.ricerca__voce', { hasText: 'New order' }).click();
  const modulo = p.getByRole('dialog', { name: 'New order' });
  await modulo.waitFor();
  const fermo = percorso(p) === '/';
  await p.keyboard.press('Escape');
  await modulo.waitFor({ state: 'hidden' });
  return fermo;
});
await voce('Ricerca: nessun risultato', async () => {
  await apriRicerca();
  await campo.fill('zzzqqq');
  await finestra.locator('.ricerca__vuoto', { hasText: 'Nothing for' }).waitFor();
});
await voce('Ricerca: clic fuori chiude', async () => {
  await p.mouse.click(30, 870);
  await finestra.waitFor({ state: 'hidden' });
});
const primoRisultato = async (gruppo, testo) => {
  await apriRicerca();
  await campo.fill(testo);
  const riga = finestra.locator('.ricerca__gruppo', { hasText: gruppo }).locator('xpath=following-sibling::*').first();
  await riga.waitFor();
  return riga;
};
const sessioneApi = await accediAdmin();
const leggi = async (percorsoApi) => (await chiama(percorsoApi, sessioneApi)).corpo ?? {};
const [elencoOrdini, elencoProdotti, elencoClienti, elencoCodici] = await Promise.all([leggi('/admin/ordini?limit=40'), leggi('/admin/catalogo/prodotti?limit=1'), leggi('/admin/clienti?limit=1'), leggi('/admin/sconti/codici?limit=1')]);
const scelte = {
  ordine: elencoOrdini.ordini?.[0]?.numero,
  prodotto: elencoProdotti.prodotti?.[0]?.titolo,
  cliente: elencoClienti.clienti?.[0]?.email,
  codice: elencoCodici.codici?.[0]?.codice,
};
for (const [gruppo, testo, inizio] of [['Orders', scelte.ordine && `${scelte.ordine}`, '/ordini/tutti/'], ['Products', scelte.prodotto, '/prodotti/catalogo/'], ['Customers', scelte.cliente, '/clienti/persone/'], ['Discounts', scelte.codice, '/sconti/codici']]) {
  await voce(`Ricerca: risultato di ${gruppo}`, async () => {
    if (!testo) return `nessun dato per ${gruppo}`;
    const riga = await primoRisultato(gruppo, testo);
    await riga.click();
    await p.waitForFunction((i) => location.pathname.startsWith(i), inizio);
    await vai(p, `/`);
  });
}
// Un ordine di prova da preparare: passa dal back-end vero e a fine prova si annulla e si nasconde.
const emailOrdine = `prova-ordini-guscio-${Date.now()}@multioutfit.test`;
const opzioni = await leggi('/admin/ordini/bozze/opzioni');
const creato = await chiama('/admin/ordini/bozze', sessioneApi, { corpo: { email: emailOrdine, indirizzo: { nome: 'Prova Guscio', via: 'Via Prova 1', citta: 'Milano', cap: '20100', paese: 'it' }, conferma: true, righe: [{ offerta_id: opzioni.offerte?.[0]?.id, quantita: 1 }] } });
const idOrdine = creato.corpo?.id;
check('Ordine di prova creato', creato.stato === 201 && Boolean(idOrdine), JSON.stringify(creato.corpo).slice(0, 120));
const numeroOrdine = idOrdine ? (await leggi(`/admin/ordini/${idOrdine}`)).ordine?.numero : null;
const passoInRicerca = async (testo) => {
  await apriRicerca();
  await campo.fill(String(numeroOrdine));
  await finestra.locator('.ricerca__passo', { hasText: testo }).first().waitFor();
};
await voce("Ricerca: Maiusc+Invio prepara l'ordine e l'avviso ha Undo", async () => {
  await passoInRicerca('Mark packed');
  await p.keyboard.press('Shift+Enter');
  await p.locator('.avvisi').getByText(`#${numeroOrdine} packed`).waitFor();
  await p.locator('.avvisi button', { hasText: 'Undo' }).click();
  await p.waitForFunction(() => !document.querySelector('.avvisi button'));
});
await voce("Ricerca: Undo riapre davvero l'ordine", async () => {
  await p.waitForTimeout(1500);
  await passoInRicerca('Mark packed');
  return (await leggi(`/admin/ordini/${idOrdine}`)).ordine?.evasione === 'not_fulfilled';
});
await voce('Ricerca: il pulsante Mark packed lavora sul back-end', async () => {
  await finestra.locator('.ricerca__passo', { hasText: 'Mark packed' }).first().click();
  await p.locator('.avvisi').getByText(`#${numeroOrdine} packed`).waitFor();
  await passoInRicerca('Mark shipped');
  await chiudiRicerca();
});
if (idOrdine) {
  const { ordine } = await leggi(`/admin/ordini/${idOrdine}`);
  for (const r of ordine?.richieste ?? []) await chiama(`/admin/evasioni/${r.ordine_id}/${r.azienda_id}/riapri`, sessioneApi, { corpo: {} });
  await chiama(`/admin/ordini/${idOrdine}/annulla`, sessioneApi, { corpo: {} });
  const nascondi = `update "order" set deleted_at = now() where deleted_at is null and email = '${emailOrdine}';`;
  const pulito = spawnSync('docker', ['exec', '-i', 'multi-outfit-postgres-1', 'sh', '-c', 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], { input: nascondi, encoding: 'utf8' });
  check('Ordine di prova tolto', pulito.status === 0, pulito.stderr?.slice(0, 120));
}
await voce('La ricerca trova prodotti veri', async () => {
  await apriRicerca();
  await campo.fill(scelte.prodotto?.slice(0, 5) ?? 'cloud');
  await finestra.getByText('Products', { exact: true }).waitFor();
  await chiudiRicerca();
});

// Scorciatoie
await vai(p, `/`);
await voce('Tasto /: ricerca', async () => {
  await p.keyboard.press('/');
  await finestra.waitFor();
  await chiudiRicerca();
});
await voce('Tasto N: menu New con il fuoco sulla prima voce', async () => {
  await p.keyboard.press('n');
  await p.locator('.tendina__etichetta', { hasText: 'Create' }).waitFor();
  const prima = await p.evaluate(() => document.activeElement.textContent.trim());
  await p.keyboard.press('Escape');
  await p.locator('.tendina__pannello:not([inert]) .tendina__etichetta').waitFor({ state: 'hidden' });
  return prima === 'Order' || prima;
});
for (const [tasti, rotta] of TASTI) {
  await voce(`Tasti ${tasti.join(' poi ').toUpperCase()}`, async () => {
    for (const t of tasti) await p.keyboard.press(t);
    await inRotta(p, rotta);
    await p.locator('.vista').evaluate((e) => Promise.all(e.getAnimations({ subtree: false }).map((a) => a.finished.catch(() => undefined))));
  });
}
await voce('Tasto ?: elenco completo delle scorciatoie', async () => {
  await p.keyboard.press('?');
  const elenco = p.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await elenco.waitFor();
  const righe = await elenco.locator('dt').count();
  await p.keyboard.press('Escape');
  await elenco.waitFor({ state: 'hidden' });
  return righe === 13 || `${righe} righe`;
});
await voce('Le scorciatoie non scattano mentre si scrive', async () => {
  await p.keyboard.press('Control+k');
  await finestra.waitFor();
  await campo.pressSequentially('gn');
  const fermo = (await p.locator('.tendina__etichetta').count()) === 0 && (await campo.inputValue()) === 'gn';
  await chiudiRicerca();
  return fermo;
});

// Telefono
const t = await nuovaPagina({ viewport: { width: 390, height: 844 } });
await t.goto(CONSOLE);
await t.locator('.barra-basso').waitFor({ timeout: 60000 });
const basso = await t.locator('.barra-basso a, .barra-basso button').allInnerTexts();
check('Barra in basso come il pannello', basso.join('|') === BASSO.join('|'), basso.join(', '));
check('Nessuno scorrimento laterale su telefono', await t.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
for (const [nome, rotta] of [['Orders', '/ordini/tutti'], ['Products', '/prodotti/catalogo'], ['Analytics', '/analisi/vendite'], ['Home', '/']]) {
  await voce(`Telefono: barra ${nome}`, async () => {
    await t.locator('.barra-basso a', { hasText: nome }).click();
    await inRotta(t, rotta);
    await t.locator('.barra-basso a.active', { hasText: nome }).waitFor();
  });
}
await voce('Telefono: il menu in alto apre il foglio', async () => {
  await t.getByRole('button', { name: 'Open menu' }).click();
  await t.locator('.laterale--aperta:not([inert])').waitFor();
  await t.locator('.foglio').getByRole('button', { name: 'Close', exact: true }).click();
  await t.locator('.foglio:not([inert])').waitFor({ state: 'hidden' });
});
await voce('Telefono: More apre il menu completo', async () => {
  await t.getByRole('button', { name: 'More' }).click();
  await t.locator('.laterale--aperta:not([inert])').waitFor();
  await t.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'guscio-telefono.png') });
  return (await t.locator('.foglio__voce').count()) === MENU.length;
});
await voce('Telefono: azione rapida apre il modulo sul posto', async () => {
  await t.locator('.foglio:not([inert]) .foglio__nuovi a', { hasText: 'New order' }).click();
  const modulo = t.getByRole('dialog', { name: 'New order' });
  await modulo.waitFor();
  await t.keyboard.press('Escape');
  await modulo.waitFor({ state: 'hidden' });
});
await voce('Telefono: voce del foglio porta alla pagina e chiude', async () => {
  await t.getByRole('button', { name: 'More' }).click();
  await t.locator('.foglio:not([inert]) .foglio__sotto a', { hasText: 'Segments' }).click();
  await inRotta(t, '/clienti/segmenti');
  await t.locator('.foglio:not([inert])').waitFor({ state: 'hidden' });
});
await voce('Telefono: ricerca a tutta larghezza', async () => {
  await t.getByRole('button', { name: 'Search', exact: true }).click();
  const scatola = await t.getByRole('dialog', { name: 'Search' }).boundingBox();
  await t.keyboard.press('Escape');
  await t.getByRole('dialog', { name: 'Search' }).waitFor({ state: 'hidden' });
  return Math.round(scatola.width) === 366 || `${scatola.width}`;
});
await voce('Telefono: menu New e account', async () => {
  await t.locator('.testata__nuovo').click();
  await t.locator('.tendina__etichetta').waitFor();
  await t.keyboard.press('Escape');
  await t.getByRole('button', { name: 'Your account' }).click();
  await t.locator('.tendina__testa').waitFor();
  await t.keyboard.press('Escape');
});

check('Nessun errore JavaScript', errori.length === 0, errori[0]?.slice(0, 140));
await p.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'guscio-scuro.png') });
await browser.close();
chiudi('guscio come il pannello');
