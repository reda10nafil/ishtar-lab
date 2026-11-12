// Conta i dati fittizi per tipo e apre le pagine principali nel browser: screenshot in `.scratch/console/demo-*.png`.
// Uso, dalla cartella multi-outfit: node infra/in-coda.mjs infra/demo/verifica.mjs [--senza-browser]
import path from 'node:path';
import { CONSOLE } from '../lib.mjs';
import { CARTELLA_SCREENSHOT, accediAdminBrowser, apriBrowser } from '../lib-browser.mjs';
import { accediAdmin, deve, leggiRegistro, sql } from './comune.mjs';

const conta = (tabella, condizione = 'deleted_at is null') => Number(sql(`select count(*) from ${tabella} where ${condizione}`)[0][0]);

const r = leggiRegistro();
const ids = Object.values(r.ordini).flatMap((s) => s.ordini ?? []);
const elenco = ids.map((id) => `'${id}'`).join(',') || `''`;
const CONTEGGI = {
  'prodotti riempiti': conta('product', `deleted_at is null and metadata->>'demo' = 'true'`),
  'prodotti ancora senza brand': conta('product', `deleted_at is null and status = 'published' and coalesce(metadata->>'brand', '') = ''`),
  collezioni: conta('product_collection'),
  'prodotti in collezione': conta('product', 'deleted_at is null and collection_id is not null'),
  'clienti fittizi': conta('customer', `deleted_at is null and metadata->>'demo' = 'true'`),
  'clienti di prova rimasti': conta('customer', `deleted_at is null and email ilike 'prova%'`),
  'indirizzi clienti': conta('customer_address'),
  gruppi: conta('customer_group'),
  'ordini fittizi': conta('"order"', `deleted_at is null and metadata->>'demo' = 'true'`),
  'gruppi d ordine nel registro': Object.values(r.ordini).filter((s) => s.ordini?.length).length,
  bozze: conta('"order"', `deleted_at is null and is_draft_order = true and status = 'draft'`),
  resi: conta('"return"'),
  sconti: conta('promotion'),
  'carte regalo': conta('carta_regalo'),
  'proposte di sconto': conta('proposta_sconto'),
  rivenditori: conta('rivenditore'),
  trattative: conta('trattativa'),
  outfit: conta('outfit'),
  'richieste di assistenza': conta('richiesta_assistenza'),
  campagne: conta('campagna_marketing'),
  'pagine online': conta('pagina_negozio'),
  'offerte con cessione': conta('offer', `deleted_at is null and metadata->>'prezzo_cessione' is not null`),
};
for (const [nome, valore] of Object.entries(CONTEGGI)) console.log(`${String(valore).padStart(5)}  ${nome}`);

console.log('\nOrdini per stato e canale:');
for (const riga of sql(`select coalesce(metadata->>'canale', 'online'), status, count(*) from "order" where id in (${elenco}) and deleted_at is null group by 1, 2 order by 1, 2`)) console.log(`  ${riga.join('  ')}`);
console.log('\nOrdini per mese:');
console.log(`  ${sql(`select to_char(created_at, 'YYYY-MM'), count(*) from "order" where id in (${elenco}) and deleted_at is null group by 1 order by 1`).map((x) => x.join(':')).join('  ')}`);

const admin = await accediAdmin();
const { negozio } = await deve('/admin/impostazioni', admin);
console.log(`\nNegozio: ${negozio.nome}, ${negozio.email}, obiettivo ${negozio.obiettivo_giornaliero}`);
const { stores } = await deve('/admin/stores?fields=id,metadata', admin);
console.log(`Blocchi in metadata.demo: ${Object.keys(stores[0].metadata?.demo ?? {}).join(', ')}`);
const { conteggi, riquadri, canali } = await deve('/admin/ordini?limit=1', admin);
console.log(`Orders: ${JSON.stringify({ conteggi, riquadri, canali })}`);

if (!process.argv.includes('--senza-browser')) {
  const PAGINE = [
    ['overview', '/'],
    ['orders', '/ordini/tutti'],
    ['products', '/prodotti/catalogo'],
    ['collections', '/prodotti/collezioni'],
    ['inventory', '/magazzino'],
    ['customers', '/clienti/persone'],
    ['discounts', '/sconti/codici'],
    ['gift', '/sconti/carte-regalo'],
    ['traffic', '/analisi/traffico'],
    ['sales', '/analisi/vendite'],
    ['campaigns', '/marketing/campagne'],
    ['wholesale', '/ingrosso'],
    ['storefront', '/negozio-online'],
    ['outfit', '/outfit'],
    ['help', '/assistenza'],
  ];
  const { browser, nuovaPagina, errori } = await apriBrowser();
  const pagina = await nuovaPagina();
  await accediAdminBrowser(pagina);
  for (const [nome, rotta] of PAGINE) {
    await pagina.goto(`${CONSOLE}${rotta}`);
    await pagina.waitForLoadState('networkidle').catch(() => undefined);
    await pagina.waitForTimeout(1500);
    await pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `demo-${nome}.png`) });
    const testo = await pagina.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
    const righe = await pagina.locator('main tbody tr').count();
    console.log(`${nome.padEnd(12)} testo ${String(testo.length).padStart(5)}  righe ${String(righe).padStart(3)}  ${testo.replace(/\s+/g, ' ').slice(0, 150)}`);
  }
  console.log(`Errori nel browser: ${errori.length}${errori.length ? ` — ${errori.slice(0, 3).join(' | ').slice(0, 300)}` : ''}`);
  await browser.close();
}
