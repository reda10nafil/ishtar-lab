// Prova di Shop till: conto, sconti, vendita vera con ordine, pagamento e scorte, annullo, permessi e passaggio nel browser.
// Uso: node infra/prova-cassa.mjs [--solo-api]. Le vendite si annullano e il resto si cancella: un ordine annullato resta nell'elenco.
import crypto from 'node:crypto';
import path from 'node:path';
import { accediAdmin, accediAzienda, attendiBackend, chiama as chiamaBase, CONSOLE, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';

const { check, chiudi } = nuovaProva();
const soloApi = process.argv.includes('--solo-api');
const chiama = async (...argomenti) => {
  // Il backend riparte quando un altro lavoro salva un file: si aspetta e si riprova.
  for (let tentativo = 0; ; tentativo += 1) {
    try {
      return await chiamaBase(...argomenti);
    } catch (errore) {
      if (tentativo >= 5) throw errore;
      await attendiBackend();
    }
  }
};
const stamp = Date.now();

await attendiBackend();
const admin = await accediAdmin();
const azienda = await accediAzienda('seller@mercur.dev');
const pulizia = { vendite: new Set(), persone: [], clienti: [], sconti: [] };

const collaboratore = async (ruolo) => {
  const email = `prova-cassa-${ruolo}-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const token = tokenDaEmail(await emailPer(email))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: 'Cassa' } });
  pulizia.persone.push(email);
  return accediAdmin(email, password);
};

const stato = async () => (await chiama('/admin/cassa', admin)).corpo;
const offertaDa = (dati, id) => dati.prodotti.flatMap((p) => p.taglie.flatMap((t) => t.offerte)).find((o) => o.id === id);
const scorte = async (id) => offertaDa(await stato(), id)?.disponibili;
const conto = (righe, codice = '') => chiama(`/admin/cassa/anteprima?${righe.map((r) => `riga=${r.offerta_id}:${r.quantita}`).join('&')}${codice ? `&codice=${codice}` : ''}`, admin);
const vendi = async (corpo) => {
  const r = await chiama('/admin/cassa/vendite', admin, { corpo });
  if (r.corpo?.vendita?.id) pulizia.vendite.add(r.corpo.vendita.id);
  return r;
};
const annulla = async (id) => {
  const r = await chiama(`/admin/cassa/vendite/${id}/annulla`, admin, { corpo: {} });
  if (r.stato === 200) pulizia.vendite.delete(id);
  return r;
};

// STATO DELLA CASSA
const iniziale = await stato();
check('La cassa si apre', Array.isArray(iniziale.prodotti) && iniziale.prodotti.length > 0, `${iniziale.prodotti?.length} prodotti`);
check('Nessun dato mancante per vendere', iniziale.mancanti.length === 0, iniziale.mancanti.join(' '));
check('Ogni prodotto ha taglie con offerte e prezzo', iniziale.prodotti.every((p) => p.taglie.length && p.taglie.every((t) => t.offerte.every((o) => o.prezzo >= 0))));
const pubblicati = (await chiama('/admin/products?limit=200&status[]=published&fields=id', admin)).corpo.products.map((p) => p.id);
check('Solo prodotti pubblicati', iniziale.prodotti.every((p) => pubblicati.includes(p.id)));
check('Categorie vere sui prodotti', iniziale.prodotti.some((p) => p.categorie.length));

// Si usano le ultime offerte: gli altri lavori prendono di solito le prime.
const candidati = [...iniziale.prodotti].reverse().filter((p) => p.disponibili > 1000).flatMap((p) => p.taglie.slice(-1).flatMap((t) => t.offerte.slice(-1)));
const [prima, seconda] = candidati;
check('Due offerte con scorte per la prova', Boolean(prima && seconda));

// CONTO
const riga1 = { offerta_id: prima.id, quantita: 2 };
const riga2 = { offerta_id: seconda.id, quantita: 1 };
const base = await conto([riga1]);
check('Conto dal server', base.stato === 200 && base.corpo.totale === prima.prezzo * 2, JSON.stringify(base.corpo));
check('Offerta inesistente respinta', (await conto([{ offerta_id: 'offer_nessuna', quantita: 1 }])).stato === 400);
const sbagliato = await conto([riga1], 'PROVANESSUNO');
check('Codice inesistente: messaggio in inglese', sbagliato.stato === 400 && /isn't live/.test(sbagliato.corpo.message), sbagliato.corpo.message);

const codice = `PROVACASSA${stamp}`.slice(0, 30);
const nuovoSconto = await chiama('/admin/sconti/codici', admin, { corpo: { codice, tipo: 'percentuale', valore: 10, limite_usi: 5 } });
pulizia.sconti.push(nuovoSconto.corpo.codice?.id);
check('Codice di sconto creato', nuovoSconto.stato === 201);
const usi = async () => (await chiama(`/admin/sconti/codici/${pulizia.sconti[0]}`, admin)).corpo.codice?.usi;
const scontato = await conto([riga1, riga2], codice.toLowerCase());
const lordo = prima.prezzo * 2 + seconda.prezzo;
check('Il codice vero toglie il 10%', scontato.stato === 200 && Math.abs(scontato.corpo.sconto - lordo * 0.1) < 0.02, JSON.stringify(scontato.corpo));
const inPausa = `PROVAPAUSA${stamp}`.slice(0, 30);
const pausa = await chiama('/admin/sconti/codici', admin, { corpo: { codice: inPausa, tipo: 'percentuale', valore: 5, attivo: false } });
pulizia.sconti.push(pausa.corpo.codice?.id);
const fermo = await conto([riga1], inPausa);
check('Codice in pausa respinto', fermo.stato === 400 && /paused/.test(fermo.corpo.message), fermo.corpo.message);

// VENDITA IN CONTANTI
const prezzo1 = base.corpo.totale;
check('Contanti insufficienti respinti', (await vendi({ righe: [riga1], metodo: 'contanti', ricevuto: prezzo1 - 1, totale_atteso: prezzo1 })).stato === 400);
check('Totale cambiato respinto', (await vendi({ righe: [riga1], metodo: 'contanti', ricevuto: 99999, totale_atteso: prezzo1 + 1 })).stato === 400);
check('Quantità oltre il limite respinta', (await vendi({ righe: [{ offerta_id: prima.id, quantita: 10000 }], metodo: 'carta', totale_atteso: prima.prezzo * 10000 })).stato === 400);
const scarsa = iniziale.prodotti.flatMap((p) => p.taglie.flatMap((t) => t.offerte)).find((o) => o.disponibili > 0 && o.disponibili < 9000);
if (scarsa) {
  const troppi = scarsa.disponibili + 1;
  const rifiuto = await vendi({ righe: [{ offerta_id: scarsa.id, quantita: troppi }], metodo: 'carta', totale_atteso: scarsa.prezzo * troppi });
  check('Scorte insufficienti respinte', rifiuto.stato === 400 && /left/.test(rifiuto.corpo.message), rifiuto.corpo.message);
}
check('Cestino vuoto respinto', (await vendi({ righe: [], metodo: 'carta', totale_atteso: 0 })).stato === 400);

const scortePrima = await scorte(prima.id);
const oggiPrima = (await stato()).oggi;
const contanti = await vendi({ righe: [riga1], metodo: 'contanti', ricevuto: prezzo1 + 7.5, totale_atteso: prezzo1 });
const vendita = contanti.corpo.vendita;
check('Vendita in contanti riuscita', contanti.stato === 201 && Boolean(vendita?.numero), JSON.stringify(contanti.corpo).slice(0, 160));
check('Resto calcolato', vendita?.resto === 7.5 && vendita?.ricevuto === prezzo1 + 7.5);

const ordine = (await chiama(`/admin/orders/${vendita.id}?fields=id,display_id,status,payment_status,fulfillment_status,is_draft_order,total,metadata,*items,*fulfillments`, admin)).corpo.order;
check('La vendita è un ordine vero', ordine?.display_id === vendita.numero && ordine?.is_draft_order === false);
check('Ordine marcato come cassa', ordine?.metadata?.canale === 'cassa' && ordine?.metadata?.pagamento === 'contanti');
check('Pagamento registrato', ordine?.payment_status === 'captured', ordine?.payment_status);
check('Merce consegnata al banco', ordine?.fulfillment_status === 'delivered', ordine?.fulfillment_status);
check('Totale dell\'ordine uguale al conto', Number(ordine?.total) === prezzo1);
const elenco = (await chiama('/admin/orders?limit=20&order=-created_at&fields=id', admin)).corpo.orders.map((o) => o.id);
check('Compare fra gli ordini', elenco.includes(vendita.id));
check('Scorte scalate', (await scorte(prima.id)) === scortePrima - 2, `${scortePrima} -> ${await scorte(prima.id)}`);
const oggiDopo = (await stato()).oggi;
check('Incasso di oggi aggiornato', oggiDopo.vendite === oggiPrima.vendite + 1 && oggiDopo.incassato === oggiPrima.incassato + prezzo1);

// VENDITA CON CARTA, CODICE E CLIENTE
const cliente = await chiama('/admin/customers', admin, { corpo: { email: `prova-cassa-${stamp}@multioutfit.test`, first_name: 'Prova', last_name: `Cassa ${stamp}` } });
pulizia.clienti.push(cliente.corpo.customer?.id);
const trovati = await chiama(`/admin/cassa/clienti?q=${stamp}`, admin);
check('Ricerca del cliente alla cassa', trovati.corpo.clienti?.some((c) => c.id === cliente.corpo.customer?.id));
const carta = await vendi({ righe: [riga1, riga2], codice, cliente_id: cliente.corpo.customer.id, metodo: 'carta', totale_atteso: scontato.corpo.totale });
const venditaCarta = carta.corpo.vendita;
check('Vendita con carta riuscita', carta.stato === 201 && venditaCarta?.metodo === 'carta', JSON.stringify(carta.corpo).slice(0, 160));
check('Scontrino con sconto e cliente', venditaCarta?.sconto === scontato.corpo.sconto && venditaCarta?.cliente?.email === cliente.corpo.customer.email);
const ordineCarta = (await chiama(`/admin/orders/${venditaCarta.id}?fields=id,customer_id,discount_total,total,payment_status`, admin)).corpo.order;
check('Ordine legato al cliente, con lo sconto', ordineCarta?.customer_id === cliente.corpo.customer.id && Number(ordineCarta?.discount_total) === scontato.corpo.sconto);
check('Uso del codice registrato', (await usi()) === 1, `${await usi()}`);

// PERMESSI
check('Azienda respinta', negato(await chiama('/admin/cassa', azienda)));
check('Senza accesso respinto', negato(await chiama('/admin/cassa', null)));
const senza = await collaboratore('marketing');
check('Ruolo senza permesso: niente cassa', negato(await chiama('/admin/cassa', senza)));
check('Ruolo senza permesso: niente vendita', negato(await chiama('/admin/cassa/vendite', senza, { corpo: { righe: [riga2], metodo: 'carta', totale_atteso: seconda.prezzo } })));
const lettura = await collaboratore('lettura');
const vistaLettura = await chiama('/admin/cassa', lettura);
if (vistaLettura.stato === 200) check('Ruolo di sola lettura: niente vendita', negato(await chiama('/admin/cassa/vendite', lettura, { corpo: { righe: [riga2], metodo: 'carta', totale_atteso: seconda.prezzo } })));
else check('Ruolo di sola lettura senza cassa', negato(vistaLettura));
const banco = await collaboratore('ordini');
check('Ruolo Orders & till: apre la cassa', (await chiama('/admin/cassa', banco)).stato === 200);
const aziendaOrdini = await chiama(`/vendor/orders?limit=50&fields=id`, azienda);
check('L\'azienda non vede un ordine misto o altrui', !aziendaOrdini.corpo.orders?.some((o) => o.id === venditaCarta.id));

// ANNULLO
const annullata = await annulla(vendita.id);
check('Vendita annullata', annullata.stato === 200, JSON.stringify(annullata.corpo).slice(0, 120));
check('Annullare due volte è respinto', (await chiama(`/admin/cassa/vendite/${vendita.id}/annulla`, admin, { corpo: {} })).stato >= 400);
const ordineAnnullato = (await chiama(`/admin/orders/${vendita.id}?fields=id,status,payment_status`, admin)).corpo.order;
check('Ordine annullato e rimborsato', ordineAnnullato?.status === 'canceled', `${ordineAnnullato?.status} ${ordineAnnullato?.payment_status}`);
await annulla(venditaCarta.id);
check('Scorte tornate come prima', (await scorte(prima.id)) === scortePrima, `${await scorte(prima.id)} su ${scortePrima}`);
check('Uso del codice restituito', (await usi()) === 0, `${await usi()}`);
const oggiFine = (await stato()).oggi;
check('Incasso di oggi tornato com\'era', oggiFine.vendite === oggiPrima.vendite && oggiFine.incassato === oggiPrima.incassato);
const altro = await chiama('/admin/cassa/vendite/order_nessuno/annulla', admin, { corpo: {} });
check('Annullo di un ordine che non è della cassa respinto', altro.stato === 404);

// BROWSER
if (!soloApi) {
  const { apriBrowser, accediAdminBrowser, CARTELLA_SCREENSHOT } = await import('./lib-browser.mjs');
  const { browser, nuovaPagina, errori } = await apriBrowser();
  const apriCassa = async (pagina) => {
    await accediAdminBrowser(pagina);
    await pagina.goto(`${CONSOLE}/cassa`);
    await pagina.locator('.cassa-scheda').first().waitFor({ timeout: 60000 });
  };
  const scatta = (pagina, nome) => pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `cassa-${nome}.png`) });
  const pagina = await nuovaPagina();
  await apriCassa(pagina);
  await pagina.waitForTimeout(1200);
  await scatta(pagina, 'scuro');

  check('Titolo inglese', await pagina.getByRole('heading', { name: 'Shop till' }).isVisible());
  check('La pagina dice che non c\'è lettore', (await pagina.locator('.contenuto').innerText()).includes('No card reader:'));
  for (const voce of ['Online shop', 'Shop till', 'Wholesale']) check(`Scheda ${voce}`, await pagina.locator('.schede').getByRole('link', { name: voce, exact: true }).isVisible());
  check('Incasso di oggi a schermo', (await pagina.locator('.cassa__oggi').innerText()).includes('Today on the till'));
  check('Ricerca presente', await pagina.getByPlaceholder('Find a product').isVisible());
  check('Pillola Everything attiva', (await pagina.getByRole('button', { name: 'Everything', exact: true }).getAttribute('aria-pressed')) === 'true');
  check('Cestino vuoto', (await pagina.locator('.cassa__cestino').innerText()).includes('Empty basket'));
  check('Charge disattivato a cestino vuoto', await pagina.getByRole('button', { name: /^Charge/ }).isDisabled());

  const quante = await pagina.locator('.cassa-scheda').count();
  const pillole = pagina.locator('.cassa__categorie button');
  await pillole.nth(1).click();
  await pagina.waitForTimeout(300);
  check('Il filtro di categoria riduce la griglia', (await pagina.locator('.cassa-scheda').count()) < quante);
  await pillole.nth(0).click();
  await pagina.getByPlaceholder('Find a product').fill('zzz-nessun-prodotto');
  await pagina.waitForTimeout(200);
  check('Ricerca senza risultati spiegata', (await pagina.locator('.cassa__nulla').innerText()).includes('Nothing matches'));
  await pagina.getByPlaceholder('Find a product').fill('');

  const scheda = pagina.locator('.cassa-scheda:not(.cassa-scheda--esaurita)').first();
  await scheda.click();
  await pagina.getByRole('dialog').waitFor();
  check('Scelta della taglia', (await pagina.getByRole('dialog').innerText()).includes('Choose a size'));
  await scatta(pagina, 'taglia');
  await pagina.getByRole('button', { name: /Add to basket/ }).click();
  await pagina.waitForTimeout(800);
  check('Il cestino conta il prodotto', (await pagina.locator('.cassa__cestino').innerText()).includes('1 item'));
  check('Contatore sulla scheda', (await scheda.locator('.cassa-scheda__conta').innerText()) === '1');
  await pagina.locator('.cassa-passo__piu').click();
  await pagina.getByText('2 items').waitFor();
  check('Il passo aumenta la quantità', true);

  await pagina.getByPlaceholder('Discount code').fill('PROVANESSUNO');
  await pagina.getByRole('button', { name: 'Apply' }).click();
  await pagina.getByText("PROVANESSUNO isn't live").waitFor();
  check('Codice sbagliato: avviso', true);
  await pagina.getByPlaceholder('Discount code').fill(codice);
  await pagina.getByRole('button', { name: 'Apply' }).click();
  await pagina.locator('.cassa-totali__sconto').waitFor();
  check('Codice vero applicato ai totali', (await pagina.locator('.cassa-totali').innerText()).includes(codice));
  check('Codice mostrato al posto del campo', (await pagina.locator('.cassa-applicato').innerText()).includes(codice) && (await pagina.getByPlaceholder('Discount code').count()) === 0);
  await pagina.getByRole('button', { name: `Remove ${codice}` }).click();
  await pagina.getByPlaceholder('Discount code').waitFor();
  check('Il codice si toglie', (await pagina.locator('.cassa-totali__sconto').count()) === 0);
  await pagina.getByPlaceholder('Discount code').fill(codice);
  await pagina.getByPlaceholder('Discount code').press('Enter');
  await pagina.locator('.cassa-totali__sconto').waitFor();
  check('Il codice si applica anche con Invio', true);

  await pagina.getByPlaceholder('Customer (optional)').fill(String(stamp));
  await pagina.locator('.cassa-cliente__elenco button').first().click();
  check('Cliente scelto', await pagina.locator('.cassa-cliente--scelto').isVisible());
  await scatta(pagina, 'cestino');

  await pagina.waitForFunction(() => !document.querySelector('.cassa-incassa')?.disabled);
  await pagina.getByRole('button', { name: /^Charge/ }).click();
  const finestra = pagina.getByRole('dialog');
  await finestra.waitFor();
  check('Avviso sul lettore nel pagamento', (await finestra.innerText()).includes('No card reader is connected'));
  check('Il codice compare nel pagamento', (await finestra.innerText()).includes(`· ${codice}`));
  await pagina.waitForTimeout(500);
  await scatta(pagina, 'carta');
  await finestra.getByRole('button', { name: 'Cash', exact: true }).click();
  check('Take cash fermo senza importo', await finestra.getByRole('button', { name: 'Take cash' }).isDisabled());
  await finestra.getByPlaceholder(/./).fill('1');
  check('Importo corto segnalato', (await finestra.locator('.incasso__resto').innerText()).includes('short'));
  await finestra.locator('.incasso__tagli button').last().click();
  await pagina.waitForTimeout(200);
  check('Resto a schermo', (await finestra.locator('.incasso__resto').innerText()).startsWith('Change'));
  await scatta(pagina, 'contanti');
  await finestra.getByRole('button', { name: 'Take cash' }).click();
  await pagina.locator('.scontrino').waitFor({ timeout: 40000 });
  await pagina.waitForTimeout(1500);
  check('Scontrino con la vendita', (await pagina.locator('.scontrino').innerText()).includes('Sale #'));
  await scatta(pagina, 'pagato');
  await pagina.evaluate(() => { window.__stampa = 0; window.print = () => { window.__stampa += 1; }; });
  await pagina.getByRole('button', { name: 'Print' }).click();
  check('Stampa dal browser', (await pagina.evaluate(() => window.__stampa)) === 1);
  const collegamento = await pagina.getByRole('link', { name: /View order/ }).getAttribute('href');
  const idOrdine = collegamento.split('/').pop();
  pulizia.vendite.add(idOrdine);
  check('Vendita nel browser diventata ordine', (await chiama(`/admin/orders/${idOrdine}?fields=id,metadata`, admin)).corpo.order?.metadata?.canale === 'cassa');
  await pagina.getByRole('button', { name: 'Next customer' }).click();
  await pagina.waitForTimeout(500);
  check('Next customer svuota il cestino', (await pagina.locator('.cassa__cestino').innerText()).includes('Empty basket'));
  await annulla(idOrdine);

  const chiara = await nuovaPagina({ colorScheme: 'light' });
  await chiara.addInitScript("try { localStorage.setItem('ishtar-tema', 'chiaro') } catch {}");
  await apriCassa(chiara);
  await chiara.waitForTimeout(1000);
  await scatta(chiara, 'chiaro');
  check('Tema chiaro attivo', (await chiara.evaluate(() => document.documentElement.dataset.tema)) === 'chiaro');

  const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
  await telefono.goto(CONSOLE);
  await telefono.locator('.contenuto').waitFor();
  await telefono.goto(`${CONSOLE}/cassa`);
  await telefono.locator('.cassa-scheda').first().waitFor({ timeout: 60000 });
  await telefono.waitForTimeout(800);
  const largo = await telefono.evaluate(() => document.documentElement.scrollWidth);
  check('Telefono senza scorrimento laterale', largo <= 390, `${largo}`);
  check('Cestino chiuso sul telefono', !(await telefono.locator('.cassa__cestino').isVisible()));
  await telefono.locator('.cassa-scheda:not(.cassa-scheda--esaurita)').first().click();
  await telefono.getByRole('button', { name: /Add to basket/ }).click();
  await telefono.waitForTimeout(700);
  await scatta(telefono, 'telefono');
  await telefono.locator('.cassa__bottone').click();
  check('View basket apre il cestino', await telefono.locator('.cassa__cestino').isVisible());
  await telefono.waitForTimeout(300);
  await scatta(telefono, 'telefono-cestino');
  check('Telefono con il cestino: niente scorrimento laterale', (await telefono.evaluate(() => document.documentElement.scrollWidth)) <= 390);

  const propri = errori.filter((e) => !/Failed to fetch|net::|ERR_/.test(e));
  check('Nessun errore nella pagina', propri.length === 0, propri.slice(0, 2).join(' | ').slice(0, 200));
  await browser.close();
}

// PULIZIA
for (const id of pulizia.vendite) await annulla(id);
for (const id of pulizia.sconti) if (id) await chiama(`/admin/sconti/codici/${id}`, admin, { metodo: 'DELETE' });
for (const id of pulizia.clienti) if (id) await chiama(`/admin/customers/${id}`, admin, { metodo: 'DELETE' });
const squadra = (await chiama('/admin/team', admin)).corpo;
for (const email of pulizia.persone) {
  const persona = squadra.collaboratori?.find((c) => c.email === email);
  if (persona) await chiama(`/admin/team/${persona.id}`, admin, { metodo: 'DELETE' });
}
check('Pulizia: nessuna vendita aperta', pulizia.vendite.size === 0);

chiudi('cassa funzionante');
