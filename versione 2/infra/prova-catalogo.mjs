// Prova della sezione Prodotti: catalogo, scheda, azioni in blocco, collezioni, portale azienda,
// revisione dei prezzi, margini per ruolo e isolamento fra aziende. Poi un passaggio nel browser.
// Richiede backend, console ed email di prova attivi. I dati creati iniziano con «Prova» e si cancellano alla fine.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { accediAdmin, accediAzienda, attendiBackend, chiama as chiamaBase, CONSOLE, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';
import { accediAdminBrowser, accediAziendaBrowser, apriBrowser, CARTELLA_SCREENSHOT } from './lib-browser.mjs';

/**
 * Più agenti salvano file insieme e il backend riparte. Una lettura si può sempre ripetere;
 * una scrittura solo se la connessione non si è mai aperta, altrimenti verrebbe eseguita due volte.
 */
const chiama = async (percorso, sessione, opzioni) => {
  const lettura = !opzioni || (opzioni.metodo ?? (opzioni.corpo === undefined ? 'GET' : 'POST')) === 'GET';
  for (let tentativo = 0; ; tentativo += 1) {
    try {
      return await chiamaBase(percorso, sessione, opzioni);
    } catch (errore) {
      if (tentativo >= 5 || !(lettura || errore.cause?.code === 'ECONNREFUSED')) throw errore;
      await attendiBackend();
    }
  }
};

await attendiBackend();
const { check, chiudi } = nuovaProva();
const stamp = Date.now();
const admin = await accediAdmin();
const azienda = await accediAzienda('seller@mercur.dev');
const altra = await accediAzienda('kickz@mercur.dev');
const daPulire = { prodotti: new Set(), collezioni: new Set(), collaboratori: [], membri: [] };

const corpoProdotto = (nome, extra = {}) => ({
  titolo: nome,
  descrizione: 'Testo di prova.',
  peso: 420,
  composizione: '100% lino',
  brand: 'Prova Atelier',
  stagione: 'Spring/Summer',
  genere: 'Women',
  cura: 'Lavare a 30 gradi',
  prezzo_cessione: 40,
  prezzo_consigliato: 95,
  ...extra,
});

/** Il registro tiene le ultime voci e altri agenti scrivono: si controlla subito dopo l'azione. */
const nelRegistro = async (azione) => {
  await new Promise((attesa) => setTimeout(attesa, 400));
  return ((await chiama('/admin/registro', admin)).corpo.voci ?? []).some((v) => v.azione === azione);
};

const crea = async (sessione, percorso, corpo) => {
  const r = await chiama(percorso, sessione, { corpo });
  if (r.corpo?.prodotto?.id) daPulire.prodotti.add(r.corpo.prodotto.id);
  return r;
};

/** La schermata cambia subito e il server segue: si aspetta che confermi. */
const aspettaServer = async (idProdotto, condizione) => {
  for (let tentativo = 0; tentativo < 40; tentativo += 1) {
    const { prodotto } = (await chiama(`/admin/catalogo/prodotti/${idProdotto}`, admin)).corpo;
    if (prodotto && condizione(prodotto)) return true;
    await new Promise((attesa) => setTimeout(attesa, 500));
  }
  return false;
};

// ---------- Passaggio nel browser: amministratore, azienda, telefono, tema chiaro e scuro ----------
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAKklEQVR4nGP8z8DAwMDAwMDAxMDAwMAgwMDA8J+BgYGB4T8DAwMDw38GAAYuAgQ0PqZtAAAAAElFTkSuQmCC', 'base64');
const ITALIANO = /\b(Prodotti|Prodotto|Nuovo|Bozza|Bozze|Esporta|Cerca|Tutti|Tutte|Rifiutati|Azienda|Aziende|Scorte|Prezzo|Collezioni|Collezione|Varianti|Variante|disponibili|Esaurito|Nessun[ao]?|Salva|Modifica|Elimina|Annulla|Caricamento|undefined|null|NaN)\b/;

const foto = (nome) => ({ name: `${nome}.png`, mimeType: 'image/png', buffer: PNG });
const scatta = (pagina, nome) => pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `catalogo-${nome}.png`) });
const senzaScorrimento = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const testoDi = async (elemento) => (await elemento.innerText()).replace(/\s+/g, ' ');

/** Prova un blocco alla volta: un errore non ferma i successivi e la pulizia. */
const passo = (check) => async (nome, azione) => {
  try {
    await azione();
  } catch (errore) {
    check(`Browser, ${nome}`, false, errore.message.split('\n')[0].slice(0, 150));
  }
};

async function passaggioAdmin(pagina, { check, stamp, codice, daPulire, passoSicuro }) {
  const nome = `Prova browser ${stamp}`;
  const cassetto = (titolo) => pagina.getByRole('dialog', { name: titolo });

  await passoSicuro('catalogo', async () => {
    await accediAdminBrowser(pagina);
    await pagina.goto(`${CONSOLE}/prodotti`);
    await pagina.getByRole('heading', { name: 'Products', exact: true }).waitFor();
    await pagina.waitForURL('**/prodotti/catalogo');
    await pagina.locator('.prodotto').first().waitFor();
    check('Browser: le schede sono Catalogue, Inventory e Collections', (await pagina.locator('.schede a').allInnerTexts()).map((t) => t.split(/\s/)[0]).join(',') === 'Catalogue,Inventory,Collections');
    check('Browser: la scheda Inventory porta al magazzino', (await pagina.locator('.schede a', { hasText: 'Inventory' }).getAttribute('href')) === '/magazzino');
    const carte = await pagina.locator('.prodotto').count();
    check('Browser: griglia con i prodotti reali', carte >= 10, `${carte} carte`);
    check('Browser: il catalogo parte da On sale', (await pagina.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'On sale' }).getAttribute('aria-pressed')) === 'true');
    const misura = await pagina.locator('.prodotto').first().boundingBox();
    check('Browser: carta da 212 x 272 come il pannello a 1440 px', Math.abs(misura.height - 272) <= 2 && Math.abs(misura.width - 212) <= 8, `${Math.round(misura.width)}x${Math.round(misura.height)}`);
    await pagina.getByRole('group', { name: 'Category' }).getByRole('button').nth(1).waitFor();
    const testo = await testoDi(pagina.locator('main'));
    check('Browser: prezzi con il formattatore comune', /\d\.\d{2}/.test(testo), testo.match(/\S*\d\.\d{2}/)?.[0]);
    check('Browser: filtri di stato come nel pannello', (await pagina.getByRole('group', { name: 'Status' }).getByRole('button').allInnerTexts()).slice(0, 3).join() === 'On sale,Drafts,Archived' && testo.includes('Everything'));
    check('Browser: nessuna parola italiana a schermo', !ITALIANO.test(testo.replace(/Prova[^·]*/g, '')), testo.match(ITALIANO)?.[0]);
    await pagina.waitForTimeout(800);
    await scatta(pagina, '1-griglia-scuro');

    const pillole = pagina.getByRole('group', { name: 'Category' });
    const seconda = pillole.getByRole('button').nth(1);
    const quanti = Number((await seconda.locator('span').innerText()).replace(/\D/g, ''));
    await seconda.click();
    await pagina.waitForURL('**categoria=**');
    await pagina.waitForFunction((attesi) => document.querySelectorAll('.prodotto').length === attesi, Math.min(quanti, 24));
    check('Browser: pillola di categoria con il conteggio giusto', true, `${quanti} prodotti`);
    await pillole.getByRole('button', { name: /Everything/ }).click();

    const stati = pagina.getByRole('group', { name: 'Status' });
    const inBozza = (await chiama('/admin/catalogo/prodotti?stato=draft&limit=1', admin)).corpo.totale;
    await stati.getByRole('button', { name: 'Drafts' }).click();
    await pagina.waitForURL('**stato=draft**');
    await pagina.waitForFunction((attesi) => document.querySelectorAll('.prodotto').length === attesi, Math.min(inBozza, 24));
    check('Browser: filtro di stato applicato', true, `${inBozza} bozze`);

    const ricerca = pagina.getByPlaceholder('Search by name, composition or SKU');
    const parola = `parolachenonesiste${stamp}`;
    await ricerca.fill(parola);
    await pagina.locator('.vuoto').getByText(`No drafts match “${parola}”.`).waitFor();
    check('Browser: stato vuoto del pannello con la frase sulla ricerca', (await pagina.locator('.vuoto strong').innerText()) === 'Nothing here');
    check('Browser: le pillole non seguono la ricerca', new RegExp(`Everything\\s*${inBozza}`).test(await pillole.getByRole('button').first().innerText()));
    await pagina.getByRole('button', { name: 'Clear filters' }).click();
    await pagina.waitForFunction(() => !location.search.includes('q='));
    check('Browser: Clear filters toglie la ricerca e tiene lo stato', (await ricerca.inputValue()) === '' && pagina.url().includes('stato=draft'));
    await stati.getByRole('button', { name: 'On sale' }).click();
    await pagina.waitForFunction(() => !location.search.includes('stato='));
    await pagina.locator('.prodotto').first().waitFor();

    await pagina.getByRole('button', { name: 'List', exact: true }).click();
    await pagina.waitForFunction(() => document.querySelectorAll('table.tabella tbody tr').length >= 10);
    check('Browser: vista elenco con le colonne del pannello', (await pagina.locator('table.tabella th').allInnerTexts()).join() === 'Product,Type,Company,Stock,Sold · 30d,Price');
    await pagina.waitForTimeout(400);
    await scatta(pagina, '2-elenco-scuro');
    await pagina.getByRole('button', { name: 'Grid', exact: true }).click();

    const [scaricato] = await Promise.all([pagina.waitForEvent('download'), pagina.getByRole('button', { name: 'Export CSV' }).click()]);
    const contenuto = fs.readFileSync(await scaricato.path(), 'utf8');
    check('Browser: esportazione CSV reale', scaricato.suggestedFilename() === 'catalogue.csv' && contenuto.includes('Name;Status;Brand;Company') && contenuto.split('\r\n').length > 10, `${contenuto.split('\r\n').length - 1} righe`);
    check('Browser: stati leggibili nel CSV', /;On sale;/.test(contenuto) && !/;published;/.test(contenuto));
  });

  await passoSicuro('nuovo prodotto', async () => {
    await pagina.locator('.testata__nuovo').click();
    await pagina.getByRole('link', { name: 'New product' }).click();
    const modulo = pagina.getByRole('dialog', { name: 'New product' });
    await modulo.waitFor();
    check('Browser: il menu New apre il modulo', pagina.url().includes('nuovo=1'));
    const salva = modulo.getByRole('button', { name: 'Save draft' });
    const larghezza = await pagina.locator('.modale').evaluate((m) => m.offsetWidth);
    check('Browser: modale da 520 px con i campi del pannello', larghezza === 520 && (await modulo.getByRole('radio').count()) === 6 && (await modulo.getByRole('button', { name: 'Cancel' }).count()) === 1 && (await modulo.getByRole('button', { name: 'Put on sale' }).count()) === 0, `${larghezza} px`);
    await salva.click();
    await modulo.getByText('Give it a name.').waitFor();
    check('Browser: nome mancante segnalato sotto il campo', (await modulo.getByLabel('Name').getAttribute('aria-invalid')) === 'true');
    await modulo.getByLabel('Name').fill(nome);
    await modulo.getByLabel('Price (€)').fill('abc');
    await salva.click();
    await pagina.waitForFunction(() => document.querySelector('.modulo-prodotto input[inputmode="decimal"]')?.getAttribute('aria-invalid') === 'true');
    check('Browser: prezzo sbagliato evidenziato e modale aperta', (await modulo.count()) === 1);
    await modulo.getByLabel('Price (€)').fill('140');
    await salva.click();
    await modulo.getByText('Price and stock belong to a company').waitFor();
    check('Browser: prezzo senza azienda spiegato', true);
    await modulo.getByRole('combobox', { name: /^Company/ }).selectOption({ label: 'Sole Society' });
    await modulo.getByRole('radio', { name: 'Colour 4' }).click();
    check('Browser: si sceglie il colore della tessera', (await modulo.getByRole('radio', { name: 'Colour 4' }).getAttribute('aria-checked')) === 'true');
    await modulo.getByLabel('Composition').fill('100% seta');
    await modulo.locator('details.apertura summary').click();
    await modulo.getByLabel('Description').fill('Abito leggero di prova.');
    await modulo.getByLabel('Brand').fill('Prova Atelier');
    await modulo.getByLabel('Season').selectOption('Spring/Summer');
    await modulo.getByLabel('Gender').selectOption('Women');
    await modulo.getByLabel('Weight in grams').fill('260');
    await modulo.getByLabel('Garment care').fill('Lavare a mano');
    await modulo.getByLabel('Supply price').fill('50');
    await modulo.getByLabel('Suggested price').fill('130');
    await modulo.getByLabel('Item code').fill(`${codice}-B`);
    await modulo.getByLabel('Sizes').fill('S, M');
    await modulo.getByLabel('EAN for size S').fill('8001234567810');
    await modulo.getByLabel('Quantity for size S').fill('6');
    await modulo.getByLabel('Quantity for size M').fill('4');
    await modulo.getByLabel('Add photo').setInputFiles(foto('abito'));
    await pagina.locator('.galleria__voce img').waitFor();
    check("Browser: foto caricata nell'archivio", (await pagina.locator('.galleria__voce img').getAttribute('src')).startsWith('http://127.0.0.1:59500/'));
    await pagina.waitForTimeout(300);
    await scatta(pagina, '3-nuovo-prodotto');
    await salva.click();
    await pagina.waitForURL('**/prodotti/catalogo/prod_*');
    daPulire.prodotti.add(pagina.url().split('/').pop().split('?')[0]);
    const scheda = cassetto(nome);
    await scheda.waitFor();
    await pagina.locator('.avvisi').getByText(`${nome} saved as a draft`).first().waitFor();
    check('Browser: avviso e cassetto dopo il salvataggio, come nel pannello', true);
    check('Browser: il prodotto si apre in un cassetto sopra il catalogo', (await pagina.locator('.prodotto').count()) > 0);
    await scheda.locator('.varianti .variante').first().waitFor();
    const testo = await testoDi(scheda);
    check('Browser: scheda con i dati previsti', ['Prova Atelier', 'Spring/Summer', 'Women', '100% seta', '260 g', 'Lavare a mano', 'Sole Society', 'Draft — only you can see it', '6 in stock · reorder at'].every((t) => testo.includes(t)), testo.slice(0, 120));
    const prezzoS = scheda.getByLabel('Selling price: S, Sole Society');
    check('Browser: varianti con SKU, EAN, prezzo e scorte', testo.includes(`${codice}-B-S`.toUpperCase()) && testo.includes('8001234567810') && (await prezzoS.inputValue()) === '140' && testo.includes('130.00') && (await scheda.getByLabel('stock of S, Sole Society', { exact: false }).first().count()) > 0);
    check('Browser: il proprietario vede cessione e margine', testo.includes('Supply') && testo.includes('50.00') && testo.includes('90.00') && /Margin/.test(testo));
    check('Browser: tessere Price, Margin e Sold con il grafico di 14 giorni', ['Price', 'Margin', 'Sold · 30 days', 'LAST 14 DAYS'].every((t) => testo.toUpperCase().includes(t.toUpperCase())) && (await scheda.locator('svg.grafico').count()) === 1);
    check('Browser: la foto si vede davvero', await scheda.locator('img.scheda-foto__grande').evaluate((i) => i.complete && i.naturalWidth > 0));
    await pagina.waitForTimeout(400);
    await scatta(pagina, '4-scheda-scuro');
  });

  await passoSicuro('modifica', async () => {
    await cassetto(nome).getByRole('button', { name: 'Edit', exact: true }).click();
    await pagina.getByRole('dialog', { name: 'Edit product' }).waitFor();
    await pagina.getByLabel('Product name').fill(`${nome} rivisto`);
    await pagina.getByLabel('Composition').fill('100% cotone');
    await pagina.getByRole('button', { name: 'Save changes' }).click();
    const scheda = cassetto(`${nome} rivisto`);
    await scheda.waitFor();
    await scheda.getByText('100% cotone').waitFor();
    check('Browser: modifica della scheda salvata', true);

    const idProdotto = pagina.url().split('/').pop().split('?')[0];
    const prezzoRiga = scheda.getByLabel('Selling price: S, Sole Society');
    await prezzoRiga.fill('abc');
    await prezzoRiga.press('Enter');
    check('Browser: un prezzo non valido torna a quello di prima', (await prezzoRiga.inputValue()) === '140');
    await prezzoRiga.fill('0');
    await prezzoRiga.press('Enter');
    check('Browser: un prezzo a zero torna a quello di prima', (await prezzoRiga.inputValue()) === '140');
    await prezzoRiga.fill('145');
    await prezzoRiga.press('Enter');
    await scheda.getByText(/Margin \S*95\.00/).waitFor();
    const avviso = pagina.locator('.avvisi p', { hasText: 'is now' });
    await avviso.waitFor();
    check('Browser: prezzo salvato dalla riga con avviso e Undo', /is now \S*145\.00/.test(await avviso.innerText()) && (await avviso.getByRole('button', { name: 'Undo' }).count()) === 1);
    check('Browser: il prezzo arriva al server', await aspettaServer(idProdotto, (p) => p.varianti.find((v) => v.titolo === 'S')?.offerte[0]?.prezzo === 145));
    await avviso.getByRole('button', { name: 'Undo' }).click();
    await scheda.getByText(/Margin \S*90\.00/).waitFor();
    check('Browser: Undo riporta il prezzo, anche sul server', (await prezzoRiga.inputValue()) === '140' && await aspettaServer(idProdotto, (p) => p.varianti.find((v) => v.titolo === 'S')?.offerte[0]?.prezzo === 140));
    await prezzoRiga.fill('145');
    await prezzoRiga.press('Enter');
    check('Browser: nuovo prezzo salvato dopo Undo', await aspettaServer(idProdotto, (p) => p.varianti.find((v) => v.titolo === 'S')?.offerte[0]?.prezzo === 145));
    const piu = scheda.getByRole('button', { name: 'One more: stock of M, Sole Society' });
    await piu.click();
    await piu.click();
    check('Browser: le scorte cambiano subito con il punto di riordino', /6 in stock · reorder at \d+/.test((await testoDi(scheda)).split('Supply').pop()) || /M.*6 in stock · reorder at \d+/.test(await testoDi(scheda)));
    check('Browser: scorte salvate dai pulsanti', await aspettaServer(idProdotto, (p) => p.varianti.find((v) => v.titolo === 'M')?.offerte[0]?.scorte === 6));
    check('Browser: le scorte non aprono avvisi, come nel pannello', !(await pagina.locator('.avvisi').innerText()).includes('Stock'));

    await scheda.getByRole('button', { name: 'Edit variant S' }).click();
    const finestra = pagina.getByRole('dialog', { name: 'Edit variant' });
    await finestra.getByLabel('Selling price').fill('150');
    await finestra.getByLabel('Stock').fill('11');
    await finestra.getByRole('button', { name: 'Save variant' }).click();
    await finestra.waitFor({ state: 'detached' });
    await scheda.getByText(/Margin \S*100\.00/).waitFor();
    check('Browser: prezzo e scorte della variante salvati', (await scheda.getByLabel('Selling price: S, Sole Society').inputValue()) === '150');

    await scheda.getByRole('button', { name: 'Add variant' }).click();
    const nuova = pagina.getByRole('dialog', { name: 'New variant' });
    await nuova.getByLabel('Variant name').fill('XL');
    await nuova.getByLabel('SKU').fill(`${codice}-B-XL`);
    await nuova.getByRole('combobox', { name: /^Company/ }).selectOption({ label: 'Sole Society' });
    await nuova.getByLabel('Selling price').fill('155');
    await nuova.getByRole('button', { name: 'Save variant' }).click();
    await nuova.waitFor({ state: 'detached' });
    await scheda.locator('.variante', { hasText: 'XL' }).waitFor();
    check('Browser: variante aggiunta', true);

    const interruttore = scheda.getByRole('switch', { name: 'On sale' });
    await interruttore.click();
    await scheda.locator('.riga-impostazione', { hasText: 'Visible on the online shop and the till' }).waitFor();
    check('Browser: messa in vendita dal cassetto', (await interruttore.getAttribute('aria-checked')) === 'true');
    await pagina.locator('.avvisi').getByText(`${nome} rivisto is on sale`).first().waitFor();
    await interruttore.click();
    await scheda.locator('.riga-impostazione', { hasText: 'Draft — only you can see it' }).waitFor();
    check('Browser: ritorno in bozza dal cassetto', (await interruttore.getAttribute('aria-checked')) === 'false');
    await pagina.locator('.avvisi').getByText(`${nome} rivisto moved to drafts`).first().waitFor();
    await scheda.getByRole('button', { name: 'Archive' }).click();
    await scheda.locator('.riga-impostazione', { hasText: 'Archived' }).waitFor();
    await pagina.locator('.avvisi').getByText(`${nome} rivisto archived`).first().waitFor();
    check('Browser: archiviazione dal cassetto', await aspettaServer(idProdotto, (p) => p.stato === 'archived'));
    await pagina.keyboard.press('Escape');
    await scheda.waitFor({ state: 'detached' });
    await pagina.goto(`${CONSOLE}/prodotti/catalogo?stato=archived&q=${stamp}`);
    const archiviata = pagina.locator('.prodotto', { hasText: nome });
    await archiviata.waitFor();
    check('Browser: il prodotto archiviato sta nel filtro Archived', true);
    await archiviata.locator('a').click();
    await scheda.waitFor();
    await scheda.getByRole('switch', { name: 'On sale' }).click();
    await scheda.locator('.riga-impostazione', { hasText: 'Visible on the online shop and the till' }).waitFor();
    check("Browser: dall'archivio si torna in vendita con l'interruttore", await aspettaServer(idProdotto, (p) => p.stato === 'published'));
    await scheda.getByRole('switch', { name: 'On sale' }).click();
    await scheda.locator('.riga-impostazione', { hasText: 'Draft — only you can see it' }).waitFor();
    await pagina.locator('.avvisi').getByText(`${nome} rivisto moved to drafts`).first().waitFor();
    await pagina.keyboard.press('Escape');
    await scheda.waitFor({ state: 'detached' });
    check('Browser: Esc chiude il cassetto e torna al catalogo', /\/prodotti\/catalogo(\?|$)/.test(pagina.url()));
  });

  await passoSicuro('azioni in blocco e collezioni', async () => {
    const nomeCollezione = `Prova vetrina ${stamp}`;
    await pagina.goto(`${CONSOLE}/prodotti/collezioni`);
    await pagina.getByRole('heading', { name: 'Products', exact: true }).waitFor();
    await pagina.getByRole('button', { name: /New collection/ }).click();
    await pagina.waitForURL(/prodotti\/collezioni\/pcol_/);
    const creata = cassetto('New collection');
    await creata.getByLabel('Name').waitFor();
    check('Browser: New collection crea subito, senza salvataggio', (await creata.getByRole('button', { name: /Save|Create/ }).count()) === 0);
    await creata.getByLabel('Name').fill(nomeCollezione);
    await creata.getByLabel('Description').fill('Vetrina di prova');
    await pagina.keyboard.press('Escape');
    await creata.waitFor({ state: 'detached' });
    const cartaNuova = pagina.locator('.collezione', { hasText: nomeCollezione });
    await cartaNuova.waitFor();
    check('Browser: nome e descrizione salvati al volo', (await testoDi(cartaNuova)).includes('Vetrina di prova'));
    await pagina.getByRole('button', { name: /New collection/ }).click();
    await pagina.waitForURL(/prodotti\/collezioni\/pcol_/);
    await cassetto('New collection').getByLabel('Name').waitFor();
    check('Browser: si possono creare due collezioni nuove di fila', pagina.url().includes('pcol_'));
    daPulire.collezioni.add(pagina.url().split('/').pop());
    await pagina.keyboard.press('Escape');
    await cassetto('New collection').waitFor({ state: 'detached' });
    await pagina.getByRole('button', { name: 'New product' }).click();
    await pagina.getByRole('dialog', { name: 'New product' }).waitFor();
    check('Browser: New product si apre sopra Collections', pagina.url().includes('/prodotti/collezioni'));
    await pagina.getByRole('button', { name: 'Cancel' }).click();
    await pagina.getByRole('dialog', { name: 'New product' }).waitFor({ state: 'detached' });

    await pagina.goto(`${CONSOLE}/prodotti/catalogo?q=${stamp}&stato=draft`);
    const carta = pagina.locator('.prodotto', { hasText: nome });
    await carta.waitFor();
    await carta.getByRole('checkbox').check();
    const barra = pagina.getByRole('group', { name: 'Actions on selected products' });
    await barra.waitFor();
    await scatta(pagina, '5-selezione');
    await pagina.getByLabel('Collection to assign').selectOption({ label: nomeCollezione });
    await barra.getByRole('button', { name: 'Assign' }).click();
    await pagina.locator('.avvisi').getByText('1 product updated').waitFor();
    check('Browser: assegnazione in blocco a una collezione', true);
    await carta.getByRole('checkbox').check();
    await barra.getByRole('button', { name: 'Publish' }).click();
    await carta.waitFor({ state: 'detached' });
    check('Browser: pubblicazione in blocco', true);

    await pagina.goto(`${CONSOLE}/prodotti/collezioni`);
    const cartaCollezione = pagina.locator('.collezione', { hasText: nomeCollezione });
    await cartaCollezione.waitFor();
    await pagina.waitForTimeout(500);
    await scatta(pagina, '6-collezioni');
    check('Browser: la carta conta i prodotti', (await testoDi(cartaCollezione)).includes('1 product'));
    const visibile = cartaCollezione.getByRole('switch', { name: `${nomeCollezione} visible` });
    await visibile.click();
    await cartaCollezione.getByRole('switch', { checked: false }).waitFor();
    await pagina.locator('.avvisi').getByText(`${nomeCollezione} is hidden`).waitFor();
    const leCarte = (await chiama('/admin/catalogo/collezioni', admin)).corpo.collezioni ?? [];
    check("Browser: l'interruttore della collezione salva davvero", leCarte.find((c) => c.titolo === nomeCollezione)?.visibile === false);
    await pagina.getByRole('link', { name: `Edit ${nomeCollezione}` }).click();
    const scheda = cassetto(nomeCollezione);
    await scheda.getByLabel('Name').waitFor();
    const spunta = scheda.getByRole('checkbox', { name: `${nome} rivisto in ${nomeCollezione}` });
    await spunta.waitFor();
    check('Browser: la collezione mostra spuntato il prodotto assegnato', (await spunta.getAttribute('aria-checked')) === 'true');
    await spunta.click();
    await scheda.getByText('Products · 0').waitFor();
    await spunta.click();
    await scheda.getByText('Products · 1').waitFor();
    check('Browser: prodotto tolto e rimesso con la spunta', true);
    await scheda.getByLabel('Name').fill(`${nomeCollezione} due`);
    await pagina.keyboard.press('Escape');
    await scheda.waitFor({ state: 'detached' });
    const rinominata = pagina.locator('.collezione', { hasText: `${nomeCollezione} due` });
    await rinominata.waitFor();
    check('Browser: collezione rinominata', true);
    await pagina.getByRole('link', { name: `Edit ${nomeCollezione} due` }).click();
    await cassetto(`${nomeCollezione} due`).getByRole('button', { name: 'Delete', exact: true }).click();
    await pagina.getByRole('dialog', { name: 'Delete this collection?' }).getByRole('button', { name: 'Delete' }).click();
    await rinominata.waitFor({ state: 'detached' });
    check('Browser: collezione eliminata con conferma', true);
  });

  await passoSicuro('eliminazione', async () => {
    await pagina.goto(`${CONSOLE}/prodotti/catalogo?q=${stamp}`);
    await pagina.locator('.prodotto', { hasText: nome }).locator('a').click();
    const scheda = cassetto(`${nome} rivisto`);
    await scheda.getByRole('button', { name: 'Delete', exact: true }).click();
    const conferma = pagina.getByRole('dialog', { name: 'Delete this product?' });
    await conferma.waitFor();
    check('Browser: la conferma avvisa che non si annulla', (await conferma.innerText()).includes('cannot be undone'));
    await conferma.getByRole('button', { name: 'Delete' }).click();
    await pagina.locator('.avvisi').getByText('Product deleted').waitFor();
    await scheda.waitFor({ state: 'detached' });
    check('Browser: eliminazione con conferma', true);
  });
}

async function passaggioRevisione(admin, portale, { check, stamp, passoSicuro }) {
  const nome = `Prova portale ${stamp}`;
  await passoSicuro('revisione', async () => {
    await admin.goto(`${CONSOLE}/revisione`);
    await admin.getByRole('heading', { name: 'Review', exact: true }).waitFor();
    const riga = admin.locator('.riga', { hasText: nome });
    await riga.waitFor();
    const testo = await riga.innerText();
    check('Browser: la revisione mostra azienda, taglie e prezzi', testo.includes('Sole Society') && testo.includes('S, M, L') && testo.includes('60.00') && testo.includes('160.00'), testo.replace(/\s+/g, ' ').slice(0, 120));
    await admin.waitForTimeout(300);
    await scatta(admin, '14-revisione');
    await riga.getByRole('button', { name: 'Approve' }).click();
    await riga.waitFor({ state: 'detached' });

    await portale.reload();
    const propria = portale.locator('.riga', { hasText: nome });
    await propria.getByText('Live', { exact: true }).waitFor();
    check("Browser: l'azienda vede Live dopo l'approvazione", true);
    await propria.getByRole('button', { name: `Open the sheet for ${nome}` }).click();
    const finestra = portale.getByRole('dialog', { name: 'Product sheet' });
    await finestra.getByText('This product is live').waitFor();
    await finestra.getByLabel('Supply price').fill('65');
    await finestra.getByRole('button', { name: 'Save changes' }).click();
    await portale.locator('.avvisi').getByText('Changes sent for review').waitFor();
    await propria.getByText('Prices waiting for approval').waitFor();
    check("Browser: dopo l'approvazione il prezzo torna in revisione", true);

    await admin.reload();
    const proposta = admin.locator('.riga', { hasText: nome }).filter({ hasText: '65.00' });
    await proposta.waitFor();
    check('Browser: prezzi proposti con vecchio e nuovo valore', (await proposta.innerText()).includes('60.00'));
    await proposta.getByRole('button', { name: 'Approve' }).click();
    await proposta.waitFor({ state: 'detached' });
    await portale.reload();
    await portale.locator('.riga', { hasText: nome }).getByText(/Supply \S*65\.00/).waitFor();
    check("Browser: prezzo approvato visibile all'azienda", true);
  });
}

async function passaggioAzienda(pagina, { check, stamp, codice, passoSicuro }) {
  const nome = `Prova portale ${stamp}`;
  await passoSicuro('portale azienda', async () => {
    await accediAziendaBrowser(pagina, 'seller@mercur.dev');
    await pagina.goto(`${CONSOLE}/prodotti?nuovo=1`);
    await pagina.getByRole('dialog', { name: 'New product' }).waitFor();
    check("Browser: ?nuovo=1 apre il modulo anche per l'azienda", true);
    await pagina.getByLabel('Product name').fill(nome);
    await pagina.getByLabel('Description').fill('Scheda completa dal portale.');
    await pagina.getByLabel('Item code').fill(`${codice}-P`);
    await pagina.getByLabel('Category').selectOption({ index: 1 });
    await pagina.getByLabel('Composition').fill('100% lana');
    await pagina.getByLabel('Garment care').fill('Lavare a secco');
    await pagina.getByLabel('Weight in grams').fill('700');
    await pagina.getByLabel('Supply price').fill('60');
    await pagina.getByLabel('Suggested price').fill('160');
    await pagina.getByLabel('EAN for size M').fill('8001234567820');
    await pagina.getByLabel('Quantity for size M').fill('8');
    await pagina.getByLabel('Add photo').setInputFiles(foto('cappotto'));
    await pagina.locator('.galleria__voce img').waitFor();
    await pagina.waitForTimeout(300);
    await scatta(pagina, '7-azienda-nuovo');
    await pagina.getByRole('button', { name: 'Send for review' }).click();
    const riga = pagina.locator('.riga', { hasText: nome });
    await riga.getByText('In review').waitFor();
    check('Browser: azienda, prodotto inviato con la scheda completa', (await riga.innerText()).includes('S, M, L') && (await riga.innerText()).includes('60.00'));
    await pagina.waitForTimeout(300);
    await scatta(pagina, '8-azienda-elenco');

    await riga.getByRole('button', { name: `Open the sheet for ${nome}` }).click();
    const finestra = pagina.getByRole('dialog', { name: 'Product sheet' });
    await finestra.getByLabel('Composition').waitFor();
    check('Browser: azienda, scheda riaperta con i dati', (await finestra.getByLabel('Composition').inputValue()) === '100% lana' && (await finestra.getByLabel('Supply price').inputValue()) === '60');
    check('Browser: azienda, nessun prezzo di vendita né margine', !/Selling price|Margin/.test(await finestra.innerText()));
    await finestra.getByLabel('Composition').fill('100% alpaca');
    await finestra.getByRole('button', { name: 'Save changes' }).click();
    await pagina.locator('.avvisi').getByText('Changes saved').waitFor();
    check('Browser: azienda, in revisione la modifica vale subito', true);
  });
}

async function provaBrowser(contesto) {
  const { check } = contesto;
  const passoSicuro = passo(check);
  const { browser, nuovaPagina: paginaBase, errori } = await apriBrowser();
  // Con più agenti al lavoro il backend risponde in secondi: l'attesa predefinita non basta.
  const nuovaPagina = async (opzioni) => {
    const pagina = await paginaBase(opzioni);
    pagina.setDefaultTimeout(45000);
    return pagina;
  };
  try {
    const scuro = await nuovaPagina();
    await passaggioAdmin(scuro, { ...contesto, passoSicuro });

    await passoSicuro('tema chiaro', async () => {
      const chiaro = await nuovaPagina({ colorScheme: 'light' });
      await chiaro.addInitScript(() => localStorage.setItem('ishtar-tema', 'chiaro'));
      await accediAdminBrowser(chiaro);
      await chiaro.goto(`${CONSOLE}/prodotti/catalogo`);
      await chiaro.locator('.prodotto').first().waitFor();
      await chiaro.waitForTimeout(800);
      check('Browser: tema chiaro attivo', (await chiaro.evaluate(() => document.documentElement.dataset.tema)) === 'chiaro');
      await scatta(chiaro, '9-griglia-chiaro');
      await chiaro.locator('.prodotto a').nth(5).click();
      await chiaro.locator('.cassetto .varianti').first().waitFor();
      await chiaro.waitForTimeout(600);
      await scatta(chiaro, '10-scheda-chiaro');
    });

    await passoSicuro('telefono', async () => {
      const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
      // Su telefono il menu laterale è nascosto: l'accesso si controlla dalla pagina.
      await telefono.goto(CONSOLE);
      await telefono.locator('main').first().waitFor();
      await telefono.goto(`${CONSOLE}/prodotti/catalogo`);
      await telefono.locator('.prodotto').first().waitFor();
      await telefono.waitForTimeout(500);
      check('Browser: catalogo senza scorrimento laterale a 390 px', await senzaScorrimento(telefono));
      await scatta(telefono, '11-telefono-griglia');
      await telefono.goto(`${CONSOLE}/prodotti/catalogo?vista=elenco`);
      await telefono.locator('table.tabella tbody tr').first().waitFor();
      check('Browser: elenco senza scorrimento laterale a 390 px', await senzaScorrimento(telefono));
      await telefono.locator('table.tabella tbody tr').nth(5).click();
      await telefono.locator('.cassetto .varianti').first().waitFor();
      await telefono.waitForTimeout(500);
      check('Browser: cassetto senza scorrimento laterale a 390 px', await senzaScorrimento(telefono));
      const foglio = await telefono.locator('.cassetto').boundingBox();
      check('Browser: a 390 px il cassetto è un foglio dal basso', Math.abs(foglio.y - 67.5) < 2 && foglio.width === 390, `y ${Math.round(foglio.y)}, largo ${foglio.width}`);
      await scatta(telefono, '12-telefono-scheda');
      await telefono.goto(`${CONSOLE}/prodotti/catalogo?nuovo=1`);
      await telefono.getByRole('dialog', { name: 'New product' }).waitFor();
      check('Browser: modulo senza scorrimento laterale a 390 px', await senzaScorrimento(telefono));
      await telefono.waitForTimeout(300);
      await scatta(telefono, '13-telefono-nuovo');
      await telefono.goto(`${CONSOLE}/prodotti/collezioni`);
      await telefono.locator('.collezione-nuova').waitFor();
      check('Browser: collezioni senza scorrimento laterale a 390 px', await senzaScorrimento(telefono));
    });

    const portale = await nuovaPagina();
    await passaggioAzienda(portale, { ...contesto, passoSicuro });
    await passaggioRevisione(scuro, portale, { ...contesto, passoSicuro });
    check('Browser: nessun errore JavaScript', errori.length === 0, errori[0]?.slice(0, 150));
  } finally {
    await browser.close();
  }
}

async function corpo() {
// ---------- Elenco e filtri ----------
const elenco = await chiama('/admin/catalogo/prodotti?limit=100', admin);
const prodotti = elenco.corpo.prodotti ?? [];
check('Catalogo con i prodotti reali', elenco.stato === 200 && elenco.corpo.totale >= 18, `${elenco.corpo.totale} prodotti`);
const pillole = elenco.corpo.categorie;
check('Conteggi per categoria', pillole?.totale === elenco.corpo.totale && pillole?.voci?.length >= 1 && pillole.voci.every((v) => v.conteggio >= 1), `${pillole?.voci?.length} categorie`);
check('Conteggi per stato coerenti', elenco.corpo.conteggi?.tutti === elenco.corpo.totale, JSON.stringify(elenco.corpo.conteggi));
const conPrezzo = prodotti.find((p) => p.prezzo_min !== null);
check('Prezzo letto dalle offerte, in euro', conPrezzo?.prezzo_min > 0 && conPrezzo?.prezzo_max >= conPrezzo?.prezzo_min, `${conPrezzo?.titolo}: ${conPrezzo?.prezzo_min}-${conPrezzo?.prezzo_max}`);
check('Azienda, varianti e scorte in elenco', conPrezzo?.aziende?.length >= 1 && conPrezzo?.varianti >= 1 && conPrezzo?.scorte >= 0);
check('Nessun margine nell\'elenco', !JSON.stringify(elenco.corpo).includes('margine'));

const pubblicati = await chiama('/admin/catalogo/prodotti?stato=published&limit=100', admin);
check('Filtro per stato', pubblicati.corpo.prodotti?.every((p) => p.stato === 'published') && pubblicati.corpo.totale === elenco.corpo.conteggi.published);
const categoriaId = prodotti.find((p) => p.categorie.length)?.categorie[0].id;
const perCategoria = await chiama(`/admin/catalogo/prodotti?categoria=${categoriaId}&limit=100`, admin);
check('Filtro per categoria', perCategoria.corpo.totale >= 1 && perCategoria.corpo.prodotti.every((p) => p.categorie.some((c) => c.id === categoriaId)), `${perCategoria.corpo.totale} prodotti`);
const perAzienda = await chiama(`/admin/catalogo/prodotti?azienda=${azienda.azienda}&limit=100`, admin);
check('Filtro per azienda', perAzienda.stato === 200 && perAzienda.corpo.totale >= 1 && perAzienda.corpo.prodotti.every((p) => p.aziende.some((a) => a.id === azienda.azienda)), `${perAzienda.corpo.totale} prodotti`);
const cercati = await chiama(`/admin/catalogo/prodotti?q=${encodeURIComponent(conPrezzo.titolo.split(' ')[0])}&limit=100`, admin);
check('Ricerca per nome', cercati.corpo.prodotti?.some((p) => p.id === conPrezzo.id), `${cercati.corpo.totale} risultati`);
const nessuno = await chiama(`/admin/catalogo/prodotti?q=parolachenonesiste${stamp}`, admin);
check('Ricerca senza risultati', nessuno.stato === 200 && nessuno.corpo.totale === 0);
check('Vendite a 30 giorni in elenco', prodotti.every((p) => typeof p.venduti_30 === 'number'));
const venduti = await chiama(`/admin/catalogo/prodotti/${conPrezzo.id}`, admin);
check('Vendite vere in scheda con 14 giorni', venduti.corpo.prodotto?.vendite?.giorni?.length === 14 && venduti.corpo.prodotto.vendite.pezzi >= 0, JSON.stringify(venduti.corpo.prodotto?.vendite).slice(0, 80));
const prima = await chiama('/admin/catalogo/prodotti?limit=2&offset=0', admin);
const seconda = await chiama('/admin/catalogo/prodotti?limit=2&offset=2', admin);
check('Paginazione', prima.corpo.prodotti.length === 2 && seconda.corpo.prodotti.length >= 1 && prima.corpo.prodotti[0].id !== seconda.corpo.prodotti[0].id);

// ---------- Creazione dall'amministratore ----------
const codice = `PROVA-${stamp}`;
const senzaNome = await chiama('/admin/catalogo/prodotti', admin, { corpo: { titolo: '  ', varianti: [{ titolo: 'S', sku: `${codice}-X` }] } });
check('Nome vuoto rifiutato con un messaggio chiaro', senzaNome.stato === 400 && senzaNome.corpo.message === 'Enter a product name', senzaNome.corpo.message);
const eanErrato = await chiama('/admin/catalogo/prodotti', admin, { corpo: { titolo: 'Prova ean', varianti: [{ titolo: 'S', sku: `${codice}-E`, ean: '12' }] } });
check('EAN errato rifiutato', eanErrato.stato === 400 && eanErrato.corpo.message?.includes('EAN'), eanErrato.corpo.message);

const creato = await crea(admin, '/admin/catalogo/prodotti', corpoProdotto(`Prova blazer ${stamp}`, {
  stato: 'draft',
  azienda_id: azienda.azienda,
  categoria_id: categoriaId,
  tinta: 3,
  seo_titolo: 'Blazer di prova',
  seo_descrizione: 'Descrizione per i motori di ricerca',
  prezzo_vendita: 120,
  varianti: [
    { titolo: 'S', sku: `${codice}-S`, ean: '8001234567890', quantita: 5 },
    { titolo: 'M', sku: `${codice}-M`, ean: '8001234567891', quantita: 7 },
  ],
}));
check('Prodotto creato con offerte', creato.stato === 201, JSON.stringify(creato.corpo).slice(0, 120));
const id = creato.corpo.prodotto?.id;
const doppio = await crea(admin, '/admin/catalogo/prodotti', corpoProdotto('Prova doppio', { varianti: [{ titolo: 'S', sku: `${codice}-S` }] }));
check('Codice già usato rifiutato', doppio.stato === 400 && doppio.corpo.message?.includes('already used'), doppio.corpo.message);

const scheda = (await chiama(`/admin/catalogo/prodotti/${id}`, admin)).corpo.prodotto;
check('Scheda con i dati previsti', scheda?.brand === 'Prova Atelier' && scheda?.stagione === 'Spring/Summer' && scheda?.genere === 'Women' && scheda?.composizione === '100% lino' && scheda?.cura === 'Lavare a 30 gradi' && scheda?.peso === 420 && scheda?.seo_titolo === 'Blazer di prova');
check('Categoria e azienda in scheda', scheda?.categorie?.[0]?.id === categoriaId && scheda?.aziende?.[0]?.id === azienda.azienda);
const offertaS = scheda?.varianti?.[0]?.offerte?.[0];
check('Variante con SKU, EAN, prezzo e scorte', scheda?.varianti?.[0]?.sku === `${codice}-S` && scheda?.varianti?.[0]?.ean === '8001234567890' && offertaS?.prezzo === 120 && offertaS?.scorte === 5, JSON.stringify(offertaS).slice(0, 160));
check('Il proprietario vede cessione e margine', offertaS?.prezzo_cessione === 40 && offertaS?.margine === 80 && Math.abs(offertaS?.margine_percento - 2 / 3) < 0.001);
check('Punto di riordino sulla riga', Number.isInteger(offertaS?.soglia) && offertaS.soglia >= 0, `${offertaS?.soglia}`);
check('Colore della tessera salvato', scheda?.tinta === 3);
const tintaErrata = await chiama('/admin/catalogo/prodotti', admin, { corpo: { titolo: 'Prova tinta', tinta: 9, varianti: [{ titolo: 'S', sku: `${codice}-T` }] } });
check('Colore della tessera fuori scala rifiutato', tintaErrata.stato === 400, tintaErrata.corpo.message);
const conSoglia = (await chiama(`/admin/catalogo/prodotti?q=${stamp}&limit=10`, admin)).corpo.prodotti?.find((p) => p.id === id);
check('Elenco: tinta e scorte basse', conSoglia?.tinta === 3 && typeof conSoglia?.scorte_basse === 'boolean', JSON.stringify({ t: conSoglia?.tinta, b: conSoglia?.scorte_basse }));
const perComposizione = await chiama('/admin/catalogo/prodotti?q=lino&limit=100', admin);
check('Ricerca per composizione', perComposizione.corpo.prodotti?.some((p) => p.id === id), `${perComposizione.corpo.totale} risultati`);
const perCodice = await chiama(`/admin/catalogo/prodotti?q=${encodeURIComponent(`${codice}-S`)}&limit=100`, admin);
check('Ricerca per SKU', perCodice.corpo.prodotti?.some((p) => p.id === id), `${perCodice.corpo.totale} risultati`);
const senzaEsito = await chiama(`/admin/catalogo/prodotti?q=parolachenonesiste${stamp}&stato=published`, admin);
check('Pillole e conteggi non seguono la ricerca', senzaEsito.corpo.totale === 0 && senzaEsito.corpo.categorie?.totale === senzaEsito.corpo.conteggi?.published, JSON.stringify({ pillole: senzaEsito.corpo.categorie?.totale, conteggi: senzaEsito.corpo.conteggi?.published }));

// ---------- Modifica ----------
const modifica = await chiama(`/admin/products/${id}`, admin, { corpo: { title: `Prova blazer modificato ${stamp}`, weight: 500, metadata: { brand: 'Prova Due' } } });
const dopoModifica = (await chiama(`/admin/catalogo/prodotti/${id}`, admin)).corpo.prodotto;
check('Modifica reale della scheda', modifica.stato === 200 && dopoModifica?.titolo.includes('modificato') && dopoModifica?.peso === 500 && dopoModifica?.brand === 'Prova Due' && dopoModifica?.stagione === 'Spring/Summer');
const variante = dopoModifica.varianti[0];
const salva = await chiama(`/admin/catalogo/prodotti/${id}/varianti/${variante.id}`, admin, {
  corpo: { titolo: 'S piccola', ean: '8001234567899', offerte: [{ id: variante.offerte[0].id, prezzo: 130, prezzo_cessione: 45, quantita: 9 }] },
});
const dopoVariante = (await chiama(`/admin/catalogo/prodotti/${id}`, admin)).corpo.prodotto.varianti.find((v) => v.id === variante.id);
check('Variante, prezzo, cessione e scorte salvati', salva.stato === 200 && dopoVariante?.titolo === 'S piccola' && dopoVariante?.ean === '8001234567899' && dopoVariante?.offerte[0].prezzo === 130 && dopoVariante?.offerte[0].prezzo_cessione === 45 && dopoVariante?.offerte[0].scorte === 9, JSON.stringify(salva.corpo).slice(0, 140));
const prezziOfferta = await chiama(`/admin/offers/${variante.offerte[0].id}?fields=id,prices.amount,prices.currency_code`, admin);
check('Un solo prezzo in euro dopo la modifica', prezziOfferta.corpo.offer?.prices?.filter((p) => p.currency_code === 'eur').length === 1);
check('Registro: variante modificata', await nelRegistro('Variant, price or stock changed'));
const nuovaVariante = await chiama(`/admin/catalogo/prodotti/${id}/varianti`, admin, { corpo: { titolo: 'L', sku: `${codice}-L`, ean: '8001234567892', azienda_id: azienda.azienda, prezzo: 125, quantita: 2 } });
check('Variante aggiunta con la sua offerta', nuovaVariante.stato === 201, JSON.stringify(nuovaVariante.corpo).slice(0, 140));
const conTre = (await chiama(`/admin/catalogo/prodotti/${id}`, admin)).corpo.prodotto;
check('Tre varianti nell\'ordine giusto', conTre.varianti.length === 3 && conTre.varianti[2].titolo === 'L' && conTre.varianti[2].offerte[0]?.scorte === 2, conTre.varianti.map((v) => v.titolo).join(', '));
const toltaL = await chiama(`/admin/catalogo/prodotti/${id}/varianti/${conTre.varianti[2].id}`, admin, { metodo: 'DELETE' });
check('Variante eliminata', toltaL.stato === 200 && (await chiama(`/admin/catalogo/prodotti/${id}`, admin)).corpo.prodotto.varianti.length === 2);

// ---------- Stato e azioni in blocco ----------
const pubblica = await chiama(`/admin/products/${id}`, admin, { corpo: { status: 'published' } });
check('Pubblicazione dalla scheda', pubblica.stato === 200 && (await chiama(`/admin/catalogo/prodotti/${id}`, admin)).corpo.prodotto.stato === 'published');
const secondo = await crea(admin, '/admin/catalogo/prodotti', corpoProdotto(`Prova secondo ${stamp}`, { varianti: [{ titolo: 'Unica', sku: `${codice}-U` }] }));
const secondoId = secondo.corpo.prodotto?.id;
const inBozza = await chiama('/admin/catalogo/blocco', admin, { corpo: { azione: 'bozza', ids: [id, secondoId] } });
check('In blocco: torna in bozza', inBozza.stato === 200 && inBozza.corpo.aggiornati === 1 && inBozza.corpo.saltati === 1, JSON.stringify(inBozza.corpo));
const inVendita = await chiama('/admin/catalogo/blocco', admin, { corpo: { azione: 'pubblica', ids: [id, secondoId] } });
const statiBlocco = await chiama(`/admin/catalogo/prodotti?q=${encodeURIComponent(`Prova`)}&stato=published&limit=100`, admin);
check('In blocco: pubblica', inVendita.corpo.aggiornati === 2 && [id, secondoId].every((x) => statiBlocco.corpo.prodotti.some((p) => p.id === x)), JSON.stringify(inVendita.corpo));

check('Registro: azione in blocco', await nelRegistro('Bulk action on products'));

const archivia = await chiama('/admin/catalogo/blocco', admin, { corpo: { azione: 'archivia', ids: [secondoId] } });
const archiviati = await chiama('/admin/catalogo/prodotti?stato=archived&limit=100', admin);
const leBozze = await chiama('/admin/catalogo/prodotti?stato=draft&limit=100', admin);
check('In blocco: archivia', archivia.corpo.aggiornati === 1 && archiviati.corpo.prodotti?.some((p) => p.id === secondoId && p.stato === 'archived') && archiviati.corpo.totale === archiviati.corpo.conteggi.archived, JSON.stringify(archivia.corpo));
check('Un prodotto archiviato non è fra le bozze', !leBozze.corpo.prodotti?.some((p) => p.id === secondoId) && leBozze.corpo.totale === leBozze.corpo.conteggi.draft);
check('Archiviato anche in scheda', (await chiama(`/admin/catalogo/prodotti/${secondoId}`, admin)).corpo.prodotto?.stato === 'archived');
const fuoriArchivio = await chiama('/admin/catalogo/blocco', admin, { corpo: { azione: 'pubblica', ids: [secondoId] } });
check("La pubblicazione toglie dall'archivio", fuoriArchivio.corpo.aggiornati === 1 && (await chiama(`/admin/catalogo/prodotti/${secondoId}`, admin)).corpo.prodotto?.stato === 'published');

// ---------- Collezioni ----------
const collezione = await chiama('/admin/collections', admin, { corpo: { title: `Prova collezione ${stamp}` } });
const collezioneId = collezione.corpo.collection?.id;
if (collezioneId) daPulire.collezioni.add(collezioneId);
check('Collezione creata', collezione.stato === 200 && Boolean(collezioneId));
const leCarte = (await chiama('/admin/catalogo/collezioni', admin)).corpo.collezioni ?? [];
check('La collezione nuova sta in fondo, come nel pannello', leCarte.at(-1)?.id === collezioneId, leCarte.at(-1)?.titolo);
const assegna = await chiama('/admin/catalogo/blocco', admin, { corpo: { azione: 'collezione', ids: [id, secondoId], collezione_id: collezioneId } });
const inCollezione = await chiama(`/admin/catalogo/prodotti?collezione=${collezioneId}`, admin);
check('In blocco: assegna alla collezione', assegna.corpo.aggiornati === 2 && inCollezione.corpo.totale === 2, `${inCollezione.corpo.totale} prodotti`);
const rinomina = await chiama(`/admin/collections/${collezioneId}`, admin, { corpo: { title: `Prova collezione nuova ${stamp}` } });
check('Collezione modificata', rinomina.stato === 200 && rinomina.corpo.collection?.title.includes('nuova'));
const togli = await chiama(`/admin/collections/${collezioneId}/products`, admin, { corpo: { remove: [secondoId] } });
check('Prodotto tolto dalla collezione', togli.stato === 200 && (await chiama(`/admin/catalogo/prodotti?collezione=${collezioneId}`, admin)).corpo.totale === 1);
const conConteggio = await chiama(`/admin/collections/${collezioneId}?fields=id,title,products.id`, admin);
check('Conteggio prodotti della collezione', conConteggio.corpo.collection?.products?.length === 1, JSON.stringify(conConteggio.corpo).slice(0, 120));

// ---------- Portale azienda ----------
const taglie = ['S', 'M', 'L'].map((t, i) => ({ titolo: t, sku: `${codice}-AZ-${t}`, ean: `800123456790${i}`, quantita: 3 + i }));
const vendorCrea = await crea(azienda, '/vendor/catalogo/prodotti', corpoProdotto(`Prova azienda ${stamp}`, { categoria_id: categoriaId, varianti: taglie, prezzo_vendita: 1 }));
check('Azienda: prodotto completo creato', vendorCrea.stato === 201, JSON.stringify(vendorCrea.corpo).slice(0, 140));
const vendorId = vendorCrea.corpo.prodotto?.id;
const mio = (await chiama(`/vendor/catalogo/prodotti/${vendorId}`, azienda)).corpo.prodotto;
check('Azienda: scheda con cessione, consigliato, quantità', mio?.stato === 'proposed' && mio?.prezzo_cessione === 40 && mio?.prezzo_consigliato === 95 && mio?.varianti?.map((v) => v.quantita).join() === '3,4,5', JSON.stringify(mio?.varianti?.map((v) => v.quantita)));
check('Azienda: la scheda non contiene prezzi di vendita né margini', !/"prezzo"|prezzo_vendita|prezzo_min|margine/.test(JSON.stringify(mio)));
const mieRighe = await chiama('/vendor/catalogo/prodotti', azienda);
check('Azienda: elenco con i propri prodotti', mieRighe.corpo.prodotti?.some((p) => p.id === vendorId) && !/"prezzo"|prezzo_min|margine/.test(JSON.stringify(mieRighe.corpo)), `${mieRighe.corpo.totale} prodotti`);
check('Il prezzo di vendita mandato dall\'azienda è ignorato', (await chiama(`/admin/catalogo/prodotti/${vendorId}`, admin)).corpo.prodotto.prezzo_min === null);

check('Un\'altra azienda non apre la scheda', negato(await chiama(`/vendor/catalogo/prodotti/${vendorId}`, altra)));
check('Un\'altra azienda non la modifica', negato(await chiama(`/vendor/catalogo/prodotti/${vendorId}`, altra, { corpo: { titolo: 'Intrusione' } })));
const altrui = await chiama('/vendor/catalogo/prodotti?limit=200', altra);
check('Un\'altra azienda non la vede in elenco', !altrui.corpo.prodotti?.some((p) => p.id === vendorId), `${altrui.corpo.totale} prodotti`);
const offerteVendor = await chiama('/vendor/offers?limit=5', azienda);
check('Le offerte native non danno il prezzo di vendita all\'azienda', offerteVendor.stato === 200 && offerteVendor.corpo.offers?.length > 0 && !JSON.stringify(offerteVendor.corpo).includes('"prices"'));
const forzato = await chiama('/vendor/offers?limit=5&fields=id,prices.amount,product_variant.prices.amount', azienda);
check('Neanche chiedendoli con i campi', !/"amount"/.test(JSON.stringify(forzato.corpo)), `stato ${forzato.stato}`);
const unaOfferta = await chiama(`/vendor/offers/${offerteVendor.corpo.offers[0].id}`, azienda);
check('Neanche sulla singola offerta', !JSON.stringify(unaOfferta.corpo).includes('"prices"'));
const varianti = await chiama('/vendor/product-variants?limit=3&fields=id,offers.prices.amount,offers.metadata', azienda);
check('Neanche dalle varianti', !/"amount"|prezzo_cessione/.test(JSON.stringify(varianti.corpo)), `stato ${varianti.stato}`);

// Approvazione e prezzi che tornano in revisione.
const appr = await chiama(`/admin/products/${vendorId}/confirm`, admin, { corpo: {} });
check('Prodotto dell\'azienda approvato', appr.stato === 200);
const cambioPrezzo = await chiama(`/vendor/catalogo/prodotti/${vendorId}`, azienda, { corpo: { prezzo_cessione: 44 } });
check('Dopo l\'approvazione il prezzo torna in revisione', cambioPrezzo.stato === 200 && cambioPrezzo.corpo.in_revisione === true, JSON.stringify(cambioPrezzo.corpo));
const propostaLetta = (await chiama(`/vendor/catalogo/prodotti/${vendorId}`, azienda)).corpo.prodotto;
check('Il prezzo in vigore non cambia finché non è approvato', propostaLetta.prezzo_cessione === 40 && propostaLetta.proposta?.prezzo_cessione === 44);
const proposte = await chiama('/admin/catalogo/proposte', admin);
const propostaAdmin = proposte.corpo.proposte?.find((p) => p.prodotto_id === vendorId);
check('La proposta arriva in revisione', propostaAdmin?.attuale?.prezzo_cessione === 40 && propostaAdmin?.proposta?.prezzo_cessione === 44);
const decisa = await chiama('/admin/catalogo/proposte', admin, { corpo: { prodotto_id: vendorId, azienda_id: azienda.azienda, esito: 'approva' } });
const dopoProposta = (await chiama(`/vendor/catalogo/prodotti/${vendorId}`, azienda)).corpo.prodotto;
check('Proposta approvata', decisa.stato === 200 && dopoProposta.prezzo_cessione === 44 && !dopoProposta.proposta);
check('Registro: proposta decisa', await nelRegistro('Price proposal decided'));
await chiama(`/vendor/catalogo/prodotti/${vendorId}`, azienda, { corpo: { prezzo_consigliato: 99 } });
await chiama('/admin/catalogo/proposte', admin, { corpo: { prodotto_id: vendorId, azienda_id: azienda.azienda, esito: 'rifiuta' } });
const dopoRifiuto = (await chiama(`/vendor/catalogo/prodotti/${vendorId}`, azienda)).corpo.prodotto;
check('Proposta rifiutata', dopoRifiuto.prezzo_consigliato === 95 && !dopoRifiuto.proposta);
const cambioTesto = await chiama(`/vendor/catalogo/prodotti/${vendorId}`, azienda, { corpo: { composizione: '100% cotone' } });
check('Dopo l\'approvazione i testi tornano in revisione', cambioTesto.corpo.in_revisione === true && (await chiama(`/admin/catalogo/prodotti/${vendorId}`, admin)).corpo.prodotto.composizione === '100% lino');
const secondoCambio = await chiama(`/vendor/catalogo/prodotti/${vendorId}`, azienda, { corpo: { composizione: '100% seta' } });
check('Una sola modifica in attesa alla volta', secondoCambio.stato === 400 && secondoCambio.corpo.message?.includes('waiting for approval'), secondoCambio.corpo.message);
const inAttesa = await chiama('/admin/product-changes?limit=100', admin);
const change = inAttesa.corpo.product_changes?.find((m) => m.product_id === vendorId && m.status === 'pending');
const confermaCambio = await chiama(`/admin/product-changes/${change?.id}/confirm`, admin, { corpo: {} });
check('Modifica ai testi approvata', confermaCambio.stato === 200 && (await chiama(`/admin/catalogo/prodotti/${vendorId}`, admin)).corpo.prodotto.composizione === '100% cotone');
const senzaCambi = await chiama(`/vendor/catalogo/prodotti/${vendorId}`, azienda, { corpo: { composizione: '100% cotone' } });
check('Nessuna richiesta vuota se non cambia nulla', senzaCambi.corpo.in_revisione === false);

// Azienda senza deposito: il primo nasce quando serve una quantità.
const aziende = (await chiama('/admin/sellers?limit=100&fields=id,name,status,stock_locations.id', admin)).corpo.sellers ?? [];
const senzaDeposito = aziende.find((a) => a.status === 'open' && !a.stock_locations?.length);
if (senzaDeposito) {
  const conDeposito = await crea(admin, '/admin/catalogo/prodotti', corpoProdotto(`Prova deposito ${stamp}`, { azienda_id: senzaDeposito.id, varianti: [{ titolo: 'Unica', sku: `${codice}-DEP`, quantita: 4 }] }));
  const letto = (await chiama(`/admin/catalogo/prodotti/${conDeposito.corpo.prodotto?.id}`, admin)).corpo.prodotto;
  check('Azienda senza deposito: quantità salvata in un deposito nuovo', letto?.scorte === 4, `${senzaDeposito.name}: ${letto?.scorte}`);
  const conNuovoDeposito = (await chiama(`/admin/sellers/${senzaDeposito.id}?fields=id,stock_locations.id`, admin)).corpo.seller;
  daPulire.deposito = conNuovoDeposito?.stock_locations?.[0]?.id;
}

// ---------- Margini per ruolo ----------
const emailCollab = `prova-lettura-${stamp}@multioutfit.test`;
const passwordCollab = crypto.randomBytes(12).toString('base64url');
await chiama('/admin/team', admin, { corpo: { email: emailCollab, ruolo: 'lettura' } });
daPulire.collaboratori.push(emailCollab);
const link = tokenDaEmail(await emailPer(emailCollab));
const registrato = await chiama('/auth/user/emailpass/register', null, { corpo: { email: emailCollab, password: passwordCollab } });
await chiama(`/admin/invites/accept?token=${encodeURIComponent(link?.searchParams.get('token') ?? '')}`, { token: registrato.corpo?.token }, { corpo: { first_name: 'Prova', last_name: 'Lettura' } });
const lettura = await accediAdmin(emailCollab, passwordCollab);
const senzaMargini = await chiama(`/admin/catalogo/prodotti/${id}`, lettura);
const testoLettura = JSON.stringify(senzaMargini.corpo);
check('Sola lettura vede la scheda senza cessione né margine', senzaMargini.stato === 200 && !/prezzo_cessione|margine|proposta/.test(testoLettura), `stato ${senzaMargini.stato}`);
check('Sola lettura vede comunque il prezzo di vendita', senzaMargini.corpo.prodotto?.prezzo_min > 0);
const offertaNativa = await chiama(`/admin/offers/${variante.offerte[0].id}`, lettura);
check('Sola lettura non legge la cessione dalle offerte native', offertaNativa.stato === 200 && !JSON.stringify(offertaNativa.corpo).includes('prezzo_cessione'));
for (const percorso of [
  `/admin/offers?limit=5&fields=id,metadata`,
  `/admin/products/${id}?fields=id,variants.offers.metadata`,
  `/admin/products?limit=5&fields=id,variants.offers.metadata`,
  `/admin/product-variants?limit=5&fields=id,offers.metadata`,
  `/admin/sellers/${azienda.azienda}?fields=id,offers.metadata`,
  `/admin/inventory-items?limit=5&fields=id,offers.metadata`,
]) {
  const tentativo = await chiama(percorso, lettura);
  check(`Sola lettura non forza la cessione: ${percorso.split('?')[0].replace(id, ':id').replace(azienda.azienda, ':id')}`, !JSON.stringify(tentativo.corpo).includes('prezzo_cessione'), `stato ${tentativo.stato}`);
}
check('Il proprietario la legge', JSON.stringify((await chiama(`/admin/offers/${variante.offerte[0].id}`, admin)).corpo).includes('prezzo_cessione'));
check('Sola lettura non crea prodotti', negato(await chiama('/admin/catalogo/prodotti', lettura, { corpo: corpoProdotto(`Prova vietata ${stamp}`, { varianti: [{ titolo: 'S', sku: `${codice}-V` }] }) })));
check('Sola lettura non elimina prodotti', negato(await chiama(`/admin/catalogo/prodotti/${id}`, lettura, { metodo: 'DELETE' })));
check('Sola lettura non usa le azioni in blocco', negato(await chiama('/admin/catalogo/blocco', lettura, { corpo: { azione: 'pubblica', ids: [id] } })));
check('Sola lettura non modifica i prezzi', negato(await chiama(`/admin/catalogo/prodotti/${id}/varianti/${variante.id}`, lettura, { corpo: { offerte: [{ id: variante.offerte[0].id, prezzo: 1 }] } })));
check('Sola lettura non vede le proposte di prezzo', negato(await chiama('/admin/catalogo/proposte', lettura)));
check('Sola lettura non vede le collezioni', negato(await chiama('/admin/catalogo/collezioni', lettura)));

// La rotta pubblica del negozio non deve mai dare cessione e proposte.
const chiavi = await chiama('/admin/api-keys?type=publishable&limit=1&fields=id,token', admin);
const canali = await chiama('/admin/sales-channels?limit=1&fields=id', admin);
await chiama(`/admin/sales-channels/${canali.corpo.sales_channels?.[0]?.id}/products`, admin, { corpo: { add: [id] } });
const pubblico = { 'x-publishable-api-key': chiavi.corpo.api_keys?.[0]?.token };
const negozio = await chiama(`/store/offers?limit=200&product_id=${id}`, null, { headers: pubblico });
check('Rotta pubblica: offerte lette senza cessione', negozio.stato === 200 && negozio.corpo.offers?.length > 0 && !/prezzo_cessione|prezzo_consigliato|proposta_prezzi/.test(JSON.stringify(negozio.corpo)), `${negozio.corpo.offers?.length} offerte, stato ${negozio.stato}`);
const unaPubblica = negozio.corpo.offers?.[0] ? await chiama(`/store/offers/${negozio.corpo.offers[0].id}`, null, { headers: pubblico }) : { corpo: {} };
check('Rotta pubblica: singola offerta senza cessione', !/prezzo_cessione|prezzo_consigliato/.test(JSON.stringify(unaPubblica.corpo)));
await chiama(`/admin/sales-channels/${canali.corpo.sales_channels?.[0]?.id}/products`, admin, { corpo: { remove: [id] } });

// Stessi attacchi dalla rotta pubblica e da un'azienda concorrente sullo stesso prodotto.
await chiama(`/admin/sales-channels/${canali.corpo.sales_channels?.[0]?.id}/products`, admin, { corpo: { add: [id] } });
for (const percorso of [`/store/products/${id}?fields=id,offers.metadata,variants.offers.metadata`, `/store/products?limit=20&fields=id,offers.metadata`, `/store/sellers/${azienda.azienda}?fields=id,offers.metadata`]) {
  const tentativo = await chiama(percorso, null, { headers: pubblico });
  check(`Rotta pubblica forzata: ${percorso.split('?')[0].replace(id, ':id').replace(azienda.azienda, ':id')}`, !/prezzo_cessione|proposta_prezzi/.test(JSON.stringify(tentativo.corpo)), `stato ${tentativo.stato}`);
}
await chiama(`/admin/sales-channels/${canali.corpo.sales_channels?.[0]?.id}/products`, admin, { corpo: { remove: [id] } });

const condiviso = await chiama(`/admin/products/${id}/sellers`, admin, { corpo: { add: [altra.azienda] } });
check('Prodotto condiviso fra due aziende per la prova', condiviso.stato < 300, `stato ${condiviso.stato}`);
for (const percorso of [
  `/vendor/products/${id}?fields=id,offers.metadata,offers.prices.amount`,
  `/vendor/products?limit=50&fields=id,offers.metadata,offers.prices.amount`,
  `/vendor/product-variants?limit=50&fields=id,product_id,offers.metadata,offers.prices.amount`,
  `/vendor/sellers/${altra.azienda}?fields=id,offers.metadata,offers.prices.amount`,
]) {
  const tentativo = await chiama(percorso, altra);
  check(`Azienda concorrente forzata: ${percorso.split('?')[0].replace(id, ':id').replace(altra.azienda, ':id')}`, !/prezzo_cessione|proposta_prezzi|"amount"/.test(JSON.stringify(tentativo.corpo)), `stato ${tentativo.stato}`);
}
const schedaCondivisa = await chiama(`/vendor/catalogo/prodotti/${id}`, altra);
check('Sul prodotto condiviso ogni azienda vede solo le proprie offerte', schedaCondivisa.stato === 200 && schedaCondivisa.corpo.prodotto?.prezzo_cessione === null && !/Sole Society/.test(JSON.stringify(schedaCondivisa.corpo)), `stato ${schedaCondivisa.stato}`);
await chiama(`/admin/products/${id}/sellers`, admin, { corpo: { remove: [altra.azienda] } });

// Ruolo aziendale senza diritto di modifica.
const emailMagazzino = `prova-magazzino-${stamp}@multioutfit.test`;
daPulire.membri.push(emailMagazzino);
const invitoMembro = await chiama(`/vendor/sellers/${azienda.azienda}/members`, azienda, { corpo: { email: emailMagazzino, role_id: 'role_seller_inventory_management' } });
check('Invito a un magazziniere', invitoMembro.stato < 300, JSON.stringify(invitoMembro.corpo).slice(0, 120));
const linkMembro = tokenDaEmail(await emailPer(emailMagazzino));
const passwordMembro = crypto.randomBytes(12).toString('base64url');
const regMembro = await chiama('/auth/member/emailpass/register', null, { corpo: { email: emailMagazzino, password: passwordMembro } });
const accetta = await chiama('/vendor/members/invites/accept', { token: regMembro.corpo?.token }, { corpo: { invite_token: linkMembro?.searchParams.get('token'), first_name: 'Prova', last_name: 'Magazzino' } });
check('Magazziniere attivato', accetta.stato < 300, JSON.stringify(accetta.corpo).slice(0, 140));
const magazziniere = await accediAzienda(emailMagazzino, passwordMembro);
check('Il magazziniere legge i prodotti', (await chiama('/vendor/catalogo/prodotti', magazziniere)).stato === 200);
check('Il magazziniere non crea prodotti', negato(await chiama('/vendor/catalogo/prodotti', magazziniere, { corpo: corpoProdotto(`Prova mag ${stamp}`, { varianti: [{ titolo: 'S', sku: `${codice}-MAG` }] }) })));
check('Il magazziniere non modifica i prodotti', negato(await chiama(`/vendor/catalogo/prodotti/${vendorId}`, magazziniere, { corpo: { titolo: 'Vietato' } })));

// ---------- Eliminazione ----------
const prova = (await chiama(`/admin/catalogo/prodotti/${id}`, admin)).corpo.prodotto;
const voci = (await chiama(`/admin/offers/${prova.varianti[0].offerte[0].id}?fields=id,inventory_item_link.inventory_item_id`, admin)).corpo.offer?.inventory_item_link?.map((l) => l.inventory_item_id) ?? [];
const elimina = await chiama(`/admin/catalogo/prodotti/${id}`, admin, { metodo: 'DELETE' });
daPulire.prodotti.delete(id);
check('Prodotto eliminato', elimina.stato === 200 && negato(await chiama(`/admin/catalogo/prodotti/${id}`, admin)));
const voceRimasta = voci.length ? await chiama(`/admin/inventory-items/${voci[0]}`, admin) : { stato: 0 };
check('Nessuna voce di magazzino orfana', voci.length > 0 && negato(voceRimasta), `${voci.length} voci, stato ${voceRimasta.stato}`);

// ---------- Browser ----------
await provaBrowser({ check, stamp, codice, categoriaId, daPulire });

}

// La pulizia gira anche se la prova si ferma a metà: l'utente guarda lo stesso database.
try {
  await corpo();
} catch (errore) {
  check('La prova arriva in fondo', false, errore.message.slice(0, 160));
}

const creatiNelBrowser = (await chiama(`/admin/catalogo/prodotti?q=${stamp}&limit=100`, admin)).corpo.prodotti ?? [];
for (const { id: creato } of creatiNelBrowser) daPulire.prodotti.add(creato);
for (const prodottoId of daPulire.prodotti) await chiama(`/admin/catalogo/prodotti/${prodottoId}`, admin, { metodo: 'DELETE' });
const leCollezioni = (await chiama('/admin/catalogo/collezioni', admin)).corpo.collezioni ?? [];
for (const { id: collezione } of leCollezioni.filter((c) => c.titolo.includes(String(stamp)))) daPulire.collezioni.add(collezione);
for (const collezione of daPulire.collezioni) await chiama(`/admin/collections/${collezione}`, admin, { metodo: 'DELETE' });
if (daPulire.deposito) await chiama(`/admin/stock-locations/${daPulire.deposito}`, admin, { metodo: 'DELETE' });
const residui = await chiama(`/admin/catalogo/prodotti?q=${stamp}&limit=100`, admin);
check('Nessun prodotto di prova rimasto', residui.corpo.totale === 0, `${residui.corpo.totale} rimasti`);
const team = await chiama('/admin/team', admin);
for (const email of daPulire.collaboratori) {
  const collabId = team.corpo.collaboratori?.find((c) => c.email === email)?.id;
  if (collabId) await chiama(`/admin/team/${collabId}`, admin, { metodo: 'DELETE' });
}
const membri = await chiama(`/vendor/sellers/${azienda.azienda}/members?limit=200`, azienda);
for (const email of daPulire.membri) {
  const membro = membri.corpo.seller_members?.find((m) => m.member?.email === email);
  if (membro) await chiama(`/vendor/sellers/${azienda.azienda}/members/${membro.id}`, azienda, { metodo: 'DELETE' });
}

chiudi('sezione Prodotti operativa');
process.exit(process.exitCode ?? 0);
