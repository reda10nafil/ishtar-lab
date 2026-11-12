// Toglie i dati fittizi e rimette il negozio com'era. Lavora solo su ciò che è scritto nel registro
// `.log/demo-creati.json`: i dati veri e i residui delle prove non si toccano. Si può rilanciare.
// Uso, dalla cartella multi-outfit: node infra/in-coda.mjs infra/togli-demo.mjs [fasi...]
// Gli ordini non hanno una rotta di eliminazione: si annullano quando si può e si nascondono nel database,
// come già fanno le prove, solo se il loro id è nel registro.
import fs from 'node:fs';
import { chiama, contesto, deve, elencoSql, PERCORSO_REGISTRO, racconta, sql } from './demo/comune.mjs';

const elimina = async (percorso, sessione) => {
  const esito = await chiama(percorso, sessione, { metodo: 'DELETE' });
  if (esito.stato >= 400 && esito.stato !== 404) throw new Error(`DELETE ${percorso}: ${esito.stato} ${JSON.stringify(esito.corpo).slice(0, 300)}`);
};

/** Toglie una voce alla volta dal registro: se il lavoro si ferma, riparte da quelle rimaste. */
async function svuota(c, nome, lavoro) {
  const voci = Object.entries(c.r[nome] ?? {});
  for (const [chiave, valore] of voci) {
    await lavoro(valore, chiave);
    delete c.r[nome][chiave];
    c.salva();
  }
  racconta(`${nome}: ${voci.length} tolti`);
}

async function metadatiNegozio({ r, admin, salva }) {
  const { stores } = await deve('/admin/stores?fields=id,metadata', admin);
  const [store] = stores;
  const { demo: _demo, impostazioni: _impostazioni, ...resto } = store.metadata ?? {};
  const originali = r.negozio?.metadata ?? {};
  const metadata = { ...resto, ...(originali.impostazioni ? { impostazioni: originali.impostazioni } : {}) };
  await deve(`/admin/stores/${store.id}`, admin, { corpo: { ...(r.negozio ? { name: r.negozio.nome } : {}), metadata } });
  racconta('negozio: nome e metadati rimessi');
  r.negozio = null;
  salva();
}

async function automazioni(c) {
  await svuota(c, 'automazioni', ({ oggetto, testo, attiva }, chiave) => deve(`/admin/marketing/automazioni/${chiave}`, c.admin, { corpo: { oggetto, testo, attiva } }));
}

const campagne = (c) => svuota(c, 'campagne', ({ id }) => elimina(`/admin/marketing/campagne/${id}`, c.admin));
const richieste = (c) => svuota(c, 'richieste', ({ id }) => elimina(`/admin/assistenza/richieste/${id}`, c.admin));
/** Un outfit pubblicato non si elimina: prima si archivia. */
const outfit = (c) =>
  svuota(c, 'outfit', async ({ id }) => {
    await chiama(`/admin/outfit/${id}/stato`, c.admin, { corpo: { stato: 'archiviato' } });
    await elimina(`/admin/outfit/${id}`, c.admin);
  });

async function proposte(c) {
  await svuota(c, 'proposte_prezzi', ({ prodotto, azienda }) => chiama('/admin/catalogo/proposte', c.admin, { corpo: { prodotto_id: prodotto, azienda_id: azienda, esito: 'rifiuta' } }));
  await svuota(c, 'proposte', async ({ id }) => {
    const [riga] = sql(`select coalesce(promozione_id, '') from proposta_sconto where id = ${elencoSql([id])}`);
    if (riga?.[0]) await elimina(`/admin/sconti/codici/${riga[0]}`, c.admin);
    await elimina(`/admin/sconti/proposte/${id}`, c.admin);
  });
}

const carte = (c) =>
  svuota(c, 'carte', async ({ id }) => {
    await chiama(`/admin/carte-regalo/${id}/blocco`, c.admin, { corpo: { congelata: false } });
    await chiama(`/admin/carte-regalo/${id}/annulla`, c.admin, { corpo: { motivo: 'Demo data removed' } });
    await elimina(`/admin/carte-regalo/${id}`, c.admin);
  });

async function ordini(c) {
  const { r, admin, salva } = c;
  const vere = Object.values(r.ordini).flatMap((s) => s.ordini ?? []);
  const bozze = Object.values(r.bozze).map((b) => b.id).filter(Boolean);
  for (const stato of Object.values(r.ordini)) {
    if (stato.ordini?.[0] && !stato.annullato) await chiama(`/admin/ordini/${stato.ordini[0]}/annulla`, admin, { corpo: {} });
  }
  const ids = [...vere, ...bozze];
  if (ids.length) {
    const elenco = elencoSql(ids);
    sql(`
      update "return" set deleted_at = now() where deleted_at is null and order_id in (${elenco});
      update "order" set deleted_at = now() where deleted_at is null and id in (${elenco});`);
  }
  r.ordini = {};
  r.bozze = {};
  delete r.piano_ordini;
  salva();
  racconta(`ordini: ${ids.length} nascosti`);
  await svuota(c, 'motivi_reso', (id) => elimina(`/admin/return-reasons/${id}`, admin));
}

async function prodotti(c) {
  const { admin } = c;
  await svuota(c, 'prodotti', async (voce, id) => {
    for (const [varianteId, variante] of Object.entries(voce.varianti)) {
      const offerte = Object.entries(variante.offerte).map(([offerta, o]) => ({
        id: offerta,
        prezzo_cessione: o.prezzo_cessione,
        prezzo_consigliato: o.prezzo_consigliato,
        ...(o.depositi === 1 ? { quantita: o.scorte } : {}),
      }));
      await deve(`/admin/catalogo/prodotti/${id}/varianti/${varianteId}`, admin, { corpo: { ean: variante.ean, offerte } });
    }
    // Un oggetto vuoto azzera i metadati, uno pieno si unisce a quelli che ci sono: servono due passi.
    const { metadata, material, weight, categorie } = voce.originale;
    await deve(`/admin/products/${id}`, admin, { corpo: { metadata: {}, material, weight, categories: categorie.map((categoria) => ({ id: categoria })) } });
    if (metadata && Object.keys(metadata).length) await deve(`/admin/products/${id}`, admin, { corpo: { metadata } });
  });
}

const collezioni = (c) => svuota(c, 'collezioni', (id) => elimina(`/admin/collections/${id}`, c.admin));
const gruppi = (c) => svuota(c, 'gruppi', ({ id }) => elimina(`/admin/clienti/gruppi/${id}`, c.admin));
/** I clienti nuovi con il consenso ricevono il benvenuto su Mailpit: le righe di consegna vanno via con loro. */
async function clienti(c) {
  const ids = Object.values(c.r.clienti).map(({ id }) => id);
  if (ids.length) sql(`update consegna_marketing set deleted_at = now() where deleted_at is null and cliente_id in (${elencoSql(ids)});`);
  await svuota(c, 'clienti', ({ id }) => elimina(`/admin/clienti/${id}`, c.admin));
}
const sconti = (c) => svuota(c, 'sconti', (id) => elimina(`/admin/sconti/codici/${id}`, c.admin));

async function ingrosso(c) {
  await svuota(c, 'trattative', ({ id }) => elimina(`/admin/ingrosso/trattative/${id}`, c.admin));
  await svuota(c, 'rivenditori', (id) => elimina(`/admin/ingrosso/rivenditori/${id}`, c.admin));
}

async function vetrina(c) {
  const { r, admin, salva } = c;
  await svuota(c, 'pagine', (id) => elimina(`/admin/negozio-online/pagine/${id}`, admin));
  if (r.vetrina) await deve('/admin/negozio-online', admin, { corpo: r.vetrina });
  r.vetrina = null;
  salva();
}

async function spedizioni({ r, admin, salva }) {
  if (!r.spedizioni) return;
  for (const [id, o] of Object.entries(r.spedizioni.opzioni)) await deve(`/admin/impostazioni/spedizioni/opzioni/${id}`, admin, { corpo: o });
  await deve('/admin/impostazioni/spedizioni', admin, { corpo: { giorni_max_evasione: r.spedizioni.giorni_max_evasione } });
  r.spedizioni = null;
  salva();
  racconta('spedizioni: rimesse');
}

const FASI = [
  ['automazioni', automazioni],
  ['campagne', campagne],
  ['richieste', richieste],
  ['outfit', outfit],
  ['proposte', proposte],
  ['carte', carte],
  ['ordini', ordini],
  ['prodotti', prodotti],
  ['collezioni', collezioni],
  ['gruppi', gruppi],
  ['clienti', clienti],
  ['sconti', sconti],
  ['ingrosso', ingrosso],
  ['vetrina', vetrina],
  ['spedizioni', spedizioni],
  ['negozio', metadatiNegozio],
];

const scelte = process.argv.slice(2);
const sconosciute = scelte.filter((s) => !FASI.some(([nome]) => nome === s));
if (sconosciute.length) throw new Error(`Fasi sconosciute: ${sconosciute.join(', ')}`);

const c = await contesto();
let errori = 0;
for (const [nome, fase] of FASI) {
  if (scelte.length && !scelte.includes(nome)) continue;
  racconta(`--- ${nome}`);
  try {
    await fase(c);
  } catch (errore) {
    errori += 1;
    racconta(`ERRORE in ${nome}: ${errore.message}`);
  }
}
if (!scelte.length && !errori) {
  fs.rmSync(PERCORSO_REGISTRO, { force: true });
  racconta('Registro cancellato: il negozio è tornato com\'era');
}
racconta(errori ? `Finito con ${errori} fasi da rilanciare` : 'Finito');
process.exitCode = errori ? 1 : 0;
