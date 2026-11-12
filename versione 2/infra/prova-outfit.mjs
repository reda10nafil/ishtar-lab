// Prova di Outfit Studio: funzioni via API, permessi, isolamento delle aziende e un passaggio reale nel browser.
// Crea prodotti e offerte propri con nome «Prova» e li cancella alla fine: il catalogo dimostrativo non si tocca.
// Richiede backend, console ed email di prova attivi. Screenshot in .scratch/console.
import crypto from 'node:crypto';
import path from 'node:path';
import { accediAdmin, accediAzienda, attendiBackend, chiama, CONSOLE, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';
import { accediAdminBrowser, accediAziendaBrowser, apriBrowser, CARTELLA_SCREENSHOT } from './lib-browser.mjs';

const { check, chiudi } = nuovaProva();
const stamp = Date.now();
const creati = { outfit: [], offerte: [], articoli: [], prodotti: [], collaboratori: [], membri: [] };

/** Il backend riparte quando un altro agente salva un file: la chiamata aspetta e riprova. */
async function api(percorso, sessione, opzioni) {
  for (let tentativo = 0; ; tentativo += 1) {
    try {
      return await chiama(percorso, sessione, opzioni);
    } catch (errore) {
      if (tentativo >= 6) throw errore;
      await attendiBackend();
    }
  }
}

/** L'interfaccia è in inglese: queste parole non devono comparire né nei messaggi né a schermo. */
const ITALIANO = /[àèéìòù]|\b(il|lo|gli|una|della|del|dell|non|per|con|capo|capi|azienda|aziende|prezzo|prezzi|bozza|bozze|scorte|taglie|taglia|sconto|margine|costo|tela|risultati|dettagli|descrizione|disponibile|disponibilità|acquistabile|esaurito|alternativa|salvato|salvataggio|elimina|archivia|pubblica|pubblicato|pubblicati|archiviato|archiviati|nessun|nessuno|caricamento|cerca|scegli|aggiungi|tutti|tutte)\b/i;
const inglese = (testo) => Boolean(testo) && !ITALIANO.test(testo);

const scatta = (pagina, nome, intera = false) => pagina.screenshot({ path: path.join(CARTELLA_SCREENSHOT, nome), fullPage: intera });
const senzaScorrimento = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Tutto il testo di una zona, comprese etichette per lettori di schermo e suggerimenti. I nomi di prova non contano. */
async function paroleItaliane(pagina, css = '.contenuto') {
  const testi = await pagina.evaluate((selettore) => {
    const radice = document.querySelector(selettore);
    if (!radice) return [];
    const nascosti = [...radice.querySelectorAll('[aria-label],[title],[placeholder]')].flatMap((n) => [n.getAttribute('aria-label'), n.getAttribute('title'), n.getAttribute('placeholder')]);
    return [radice.innerText, ...nascosti].filter(Boolean);
  }, css);
  const pulito = testi.join('\n').replace(/Prova [^\n.,:]*/g, ' ');
  return pulito.match(ITALIANO)?.[0] ?? null;
}

/** Aspetta che le foto dei capi siano davvero arrivate e dice quante se ne vedono. */
async function fotoVisibili(pagina, selettore) {
  await pagina
    .waitForFunction((css) => {
      const foto = [...document.querySelectorAll(css)];
      return foto.length > 0 && foto.every((f) => f.complete && f.naturalWidth > 0);
    }, selettore, { timeout: 15000 })
    .catch(() => undefined);
  return pagina.evaluate((css) => [...document.querySelectorAll(css)].filter((f) => f.naturalWidth > 0).length, selettore);
}

await attendiBackend();
const admin = await accediAdmin();
const [azA, azB, azC] = await Promise.all(['seller@mercur.dev', 'kickz@mercur.dev', 'trailhead@mercur.dev'].map((email) => accediAzienda(email)));

async function appoggiAzienda(azienda) {
  const { corpo } = await api('/vendor/offers?limit=1', azienda);
  const offerta = corpo.offers[0];
  const articolo = await api(`/admin/inventory-items/${offerta.inventory_items[0].id}`, admin);
  return { profilo: offerta.shipping_profile_id, deposito: articolo.corpo.inventory_item.location_levels[0].location_id };
}

/** Prodotto vero con offerte vere: prezzo e scorte dell'azienda, come per il cliente. */
async function creaCapo(nome, azienda, taglie, { costoOfferta, costoProdotto, foto } = {}) {
  const titolo = `Prova piece ${nome} ${stamp}`;
  const sku = (t) => `PROVAOUT-${stamp}-${nome}-${t}`.toUpperCase();
  const risposta = await api('/admin/products', admin, {
    corpo: {
      title: titolo,
      status: 'published',
      ...(foto ? { thumbnail: foto } : {}),
      ...(costoProdotto ? { metadata: { prezzo_cessione: costoProdotto } } : {}),
      variants: taglie.map((t) => ({ title: t.titolo, sku: sku(t.titolo) })),
    },
  });
  if (!risposta.corpo.product) throw new Error(`prodotto ${nome}: ${JSON.stringify(risposta.corpo)}`);
  const prodotto = risposta.corpo.product;
  creati.prodotti.push(prodotto.id);
  const { profilo, deposito } = await appoggiAzienda(azienda);
  const offerte = await api('/admin/offers/batch', admin, {
    corpo: {
      seller_id: azienda.azienda,
      offers: prodotto.variants.map((v) => {
        const taglia = taglie.find((t) => t.titolo === v.title);
        return {
          sku: sku(`OFF-${v.title}`),
          variant_id: v.id,
          shipping_profile_id: profilo,
          prices: [{ amount: taglia.prezzo, currency_code: 'eur' }],
          ...(costoOfferta ? { metadata: { prezzo_cessione: costoOfferta } } : {}),
          inventory_items: [{ sku: sku(`ART-${v.title}`), required_quantity: 1, stock_levels: [{ location_id: deposito, stocked_quantity: taglia.scorte }] }],
        };
      }),
    },
  });
  if (!offerte.corpo.offers) throw new Error(`offerte ${nome}: ${JSON.stringify(offerte.corpo)}`);
  const articoli = {};
  for (const offerta of offerte.corpo.offers) {
    creati.offerte.push(offerta.id);
    const dettaglio = await api(`/admin/offers/${offerta.id}`, admin);
    const id = dettaglio.corpo.offer.inventory_items[0].id;
    creati.articoli.push(id);
    articoli[prodotto.variants.find((v) => v.id === offerta.variant_id).title] = id;
  }
  return { id: prodotto.id, titolo, azienda: azienda.azienda, articoli, deposito };
}

/** Se un riavvio del backend perde la risposta, il prodotto si ritrova per nome: deve restare cancellabile. */
async function prodottoSemplice(titolo, status, sku) {
  const risposta = await api('/admin/products', admin, { corpo: { title: titolo, status, variants: [{ title: 'S', sku }] } });
  let id = risposta.corpo.product?.id;
  if (!id) {
    await attendiBackend();
    const trovati = await api(`/admin/products?q=${encodeURIComponent(titolo)}&fields=id,title&limit=5`, admin);
    id = trovati.corpo.products?.find((p) => p.title === titolo)?.id;
  }
  if (!id) throw new Error(`prodotto ${titolo}: ${JSON.stringify(risposta.corpo)}`);
  creati.prodotti.push(id);
  return id;
}

const scorte = (capo, taglia, quantita) => api(`/admin/inventory-items/${capo.articoli[taglia]}/location-levels/${capo.deposito}`, admin, { corpo: { stocked_quantity: quantita } });
const posto = (capo, indice, altro = {}) => ({ product_id: capo.id, azienda_id: capo.azienda, x: 5 + indice * 30, y: 10, larghezza: 40, livello: indice + 1, ...altro });
const leggi = async (id, sessione = admin) => (await api(`/admin/outfit/${id}`, sessione)).corpo.outfit;

/** Solo lettura: i metadati del negozio sono condivisi e Medusa li sostituisce interi, quindi la prova non li scrive mai. */
async function outfitConRisultati() {
  const negozio = (await api('/admin/stores?fields=id,metadata', admin)).corpo.stores?.[0];
  const risultati = negozio?.metadata?.demo?.outfit ?? {};
  const elenco = (await api('/admin/outfit?limit=100', admin)).corpo.outfit ?? [];
  return elenco.find((o) => risultati[o.nome] || risultati[o.id]);
}

async function nuovoOutfit(nome) {
  const r = await api('/admin/outfit', admin, { corpo: { nome: `${nome} ${stamp}` } });
  if (r.corpo.outfit) creati.outfit.push(r.corpo.outfit.id);
  return r;
}

async function collaboratore(ruolo) {
  const email = `prova-outfit-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  await api('/admin/team', admin, { corpo: { email, ruolo } });
  const token = tokenDaEmail(await emailPer(email))?.searchParams.get('token') ?? '';
  const registrato = await api('/auth/user/emailpass/register', null, { corpo: { email, password } });
  await api(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: registrato.corpo?.token }, { corpo: { first_name: 'Prova', last_name: 'Outfit' } });
  const sessione = await accediAdmin(email, password);
  const team = await api('/admin/team', admin);
  const id = team.corpo.collaboratori.find((c) => c.email === email)?.id;
  creati.collaboratori.push(id);
  return { sessione, cambiaRuolo: (nuovo) => api(`/admin/team/${id}`, admin, { corpo: { ruolo: nuovo } }) };
}

async function magazziniere(azienda) {
  const email = `prova-magazzino-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  const invito = await api(`/vendor/sellers/${azienda.azienda}/members`, azienda, { corpo: { email, role_id: 'role_seller_inventory_management' } });
  if (invito.stato !== 201) throw new Error(`invito magazziniere: ${JSON.stringify(invito.corpo)}`);
  const token = tokenDaEmail(await emailPer(email))?.searchParams.get('token') ?? '';
  const registrato = await api('/auth/member/emailpass/register', null, { corpo: { email, password } });
  const accettato = await api('/vendor/members/invites/accept', { token: registrato.corpo?.token }, { corpo: { invite_token: token, first_name: 'Prova', last_name: 'Magazzino' } });
  if (accettato.stato !== 200) throw new Error(`accettazione magazziniere: ${JSON.stringify(accettato.corpo)}`);
  const membri = await api(`/vendor/sellers/${azienda.azienda}/members?limit=100`, azienda);
  const membro = membri.corpo.seller_members?.find((m) => m.member?.email === email || m.email === email);
  if (membro) creati.membri.push({ azienda, id: membro.id ?? membro.member_id });
  return accediAzienda(email, password);
}

async function provaApi() {
  const dimostrativi = (await api('/admin/outfit/catalogo?limit=100', admin)).corpo.capi ?? [];
  const foto = [...new Set(dimostrativi.filter((c) => c.acquistabile).map((c) => c.foto).filter(Boolean))];
  const alfa = await creaCapo('Alfa', azA, [{ titolo: 'M', prezzo: 120, scorte: 0 }, { titolo: 'S', prezzo: 100, scorte: 5 }], { costoOfferta: 60, foto: foto[0] });
  const beta = await creaCapo('Beta', azB, [{ titolo: 'S', prezzo: 200, scorte: 3 }, { titolo: 'M', prezzo: 200, scorte: 3 }], { costoProdotto: 120, foto: foto[1] });
  const gamma = await creaCapo('Gamma', azC, [{ titolo: 'One', prezzo: 150, scorte: 2 }]);
  const senzaOfferta = await prodottoSemplice(`Prova piece without offer ${stamp}`, 'published', `PROVAOUT-${stamp}-NOFF`);
  const nonApprovato = await prodottoSemplice(`Prova piece not approved ${stamp}`, 'draft', `PROVAOUT-${stamp}-DRAFT`);

  // Catalogo: prodotti, aziende, taglie, scorte e prezzi veri.
  const catalogo = await api(`/admin/outfit/catalogo?q=${stamp}&limit=50`, admin);
  const voce = catalogo.corpo.capi?.find((c) => c.product_id === alfa.id);
  check('Catalogue shows the product with the company selling it', catalogo.stato === 200 && voce?.azienda_id === azA.azienda && voce?.azienda_nome === azA.nome, voce?.azienda_nome);
  check('Sizes follow their measure, not the alphabet', voce?.varianti?.map((v) => v.titolo).join(',') === 'S,M', voce?.varianti?.map((v) => v.titolo).join(','));
  check('Catalogue knows real sizes and stock', voce?.varianti?.length === 2 && voce.varianti.find((v) => v.titolo === 'S')?.quantita === 5 && voce.varianti.find((v) => v.titolo === 'M')?.quantita === 0);
  check('A sold out size is not available', voce?.varianti?.find((v) => v.titolo === 'M')?.disponibile === false);
  check('Reference price is the cheapest available size', voce?.prezzo === 100, String(voce?.prezzo));
  const vuota = catalogo.corpo.capi?.find((c) => c.product_id === senzaOfferta);
  check('A product without an offer is never shown as buyable', !catalogo.corpo.capi?.some((c) => c.product_id === senzaOfferta && c.acquistabile) && (vuota === undefined || inglese(vuota.problema)));
  check('An unapproved product is not in the catalogue', !catalogo.corpo.capi?.some((c) => c.product_id === nonApprovato));
  const soloB = await api(`/admin/outfit/catalogo?q=${stamp}&azienda=${azB.azienda}`, admin);
  check('Company filter shows that company only', soloB.corpo.capi?.length === 1 && soloB.corpo.capi[0].product_id === beta.id, `${soloB.corpo.capi?.length} items`);
  check('Demo catalogue can be read', dimostrativi.some((c) => c.acquistabile && c.varianti.length > 1));

  // Creazione e controlli sui dati.
  const senzaNome = await api('/admin/outfit', admin, { corpo: { nome: '   ' } });
  check('An outfit without a name is refused in English', senzaNome.stato === 400 && inglese(senzaNome.corpo?.message), senzaNome.corpo?.message);
  const creato = await nuovoOutfit('Prova outfit');
  const id = creato.corpo.outfit?.id;
  check('New outfit starts as a draft', creato.stato === 201 && creato.corpo.outfit?.stato === 'bozza');
  check('Activity log: Outfit created', (await api('/admin/registro', admin)).corpo.voci?.some((v) => v.azione === 'Outfit created'));
  check('An outfit without pieces is not buyable and says so', creato.corpo.outfit?.disponibilita?.acquistabile === false && inglese(creato.corpo.outfit?.disponibilita?.motivi?.[0]), creato.corpo.outfit?.disponibilita?.motivi?.[0]);
  const rifiuti = [
    ['A product that does not exist is refused', { capi: [posto({ id: 'prod_inesistente', azienda: azA.azienda }, 0)] }],
    ['A product without an offer is refused', { capi: [posto({ id: senzaOfferta, azienda: azA.azienda }, 0)] }],
    ['An unapproved product is refused', { capi: [posto({ id: nonApprovato, azienda: azA.azienda }, 0)] }],
    ['A company that does not sell the product is refused', { capi: [posto({ id: alfa.id, azienda: azB.azienda }, 0)] }],
    ['The same piece twice is refused', { capi: [posto(alfa, 0), posto(alfa, 1)] }],
    ['A position outside the canvas is refused', { capi: [posto(alfa, 0, { x: 140 })] }],
    ['An alternative equal to the piece is refused', { capi: [posto(alfa, 0, { alternativa_product_id: alfa.id, alternativa_azienda_id: alfa.azienda })] }],
    ['A negative price is refused', { prezzo_fisso: -5 }],
    ['An unknown discount rule is refused', { sconto_a_carico: 'nessuno' }],
  ];
  for (const [nome, corpo] of rifiuti) {
    const r = await api(`/admin/outfit/${id}`, admin, { corpo });
    check(nome, r.stato === 400 && inglese(r.corpo?.message), r.corpo?.message);
  }
  check('A missing outfit answers 404 in English', (await api('/admin/outfit/outf_inesistente', admin)).corpo?.message === 'Outfit not found');

  // Composizione: capi di aziende diverse, con la loro posizione sulla tela.
  const composto = await api(`/admin/outfit/${id}`, admin, { corpo: { descrizione: `Prova linen note ${stamp}`, capi: [posto(alfa, 0), posto(beta, 1)] } });
  let outfit = composto.corpo.outfit;
  check('Pieces from different companies in one outfit', composto.stato === 200 && new Set(outfit?.capi?.map((c) => c.azienda_id)).size === 2);
  check('Canvas position is saved', outfit?.capi?.[1]?.x === 35 && outfit.capi[1].larghezza === 40);
  check('The outfit knows the sizes of each piece', outfit?.capi?.[0]?.varianti?.length === 2 && outfit.capi[0].varianti.every((v) => v.id.startsWith('variant_')));
  const idCapo = outfit?.capi?.[0]?.id;
  outfit = (await api(`/admin/outfit/${id}`, admin, { corpo: { capi: [posto(alfa, 0, { x: 22.5, y: 31 }), posto(beta, 1)] } })).corpo.outfit;
  check('Moving a piece does not recreate it', outfit?.capi?.[0]?.id === idCapo && outfit.capi[0].x === 22.5 && outfit.capi[0].y === 31);
  check('With every piece available the outfit is buyable', outfit?.disponibilita?.acquistabile === true);

  // Prezzo e chi sostiene lo sconto.
  check('Sum of pieces comes from real prices', outfit?.prezzo?.somma === 300 && outfit.prezzo.finale === 300 && outfit.prezzo.sconto === 0, String(outfit?.prezzo?.finale));
  check('Cost is read from the supply price on offer and product', outfit?.economia?.costo_capi === 180 && outfit.economia.margine === 120, String(outfit?.economia?.margine));
  const regole = [
    ['negozio', 100, { sconto_negozio: 60, sconto_aziende: 0 }, { costo_netto: 180, margine: 60 }],
    ['aziende', 100, { sconto_negozio: 0, sconto_aziende: 60 }, { costo_netto: 120, margine: 120 }],
    ['ripartito', 25, { sconto_negozio: 15, sconto_aziende: 45 }, { costo_netto: 135, margine: 105 }],
  ];
  for (const [regola, quota, attesiSconto, attesiMargine] of regole) {
    const o = (await api(`/admin/outfit/${id}`, admin, { corpo: { modalita_prezzo: 'fisso', prezzo_fisso: 240, sconto_a_carico: regola, quota_negozio: quota } })).corpo.outfit;
    check(`Discount funded by: ${regola}`, o?.prezzo?.finale === 240 && o.prezzo.sconto === 60 && o.prezzo.sconto_negozio === attesiSconto.sconto_negozio && o.prezzo.sconto_aziende === attesiSconto.sconto_aziende, JSON.stringify(o?.prezzo));
    check(`Margin with discount funded by: ${regola}`, o?.economia?.costo_netto === attesiMargine.costo_netto && o.economia.margine === attesiMargine.margine, String(o?.economia?.margine));
  }
  await api(`/admin/outfit/${id}`, admin, { corpo: { sconto_a_carico: 'aziende' } });
  const sopra = (await api(`/admin/outfit/${id}`, admin, { corpo: { prezzo_fisso: 500 } })).corpo.outfit;
  check('A price above the sum is flagged and is not a discount', sopra?.prezzo?.sopra_somma === true && sopra.prezzo.sconto === 0);
  await api(`/admin/outfit/${id}`, admin, { corpo: { prezzo_fisso: 240 } });

  // Dati di costo mancanti: si dice, non si stima.
  const conGamma = (await api(`/admin/outfit/${id}`, admin, { corpo: { capi: [posto(alfa, 0), posto(beta, 1), posto(gamma, 2)] } })).corpo.outfit;
  check('If a cost is missing the margin stays empty, with no estimate', conGamma?.economia?.margine === null && conGamma.economia.costo_capi === null);
  check('The piece without a cost is named', conGamma?.economia?.mancanti?.length === 1 && conGamma.economia.mancanti[0] === gamma.titolo);
  await api(`/admin/outfit/${id}`, admin, { corpo: { capi: [posto(alfa, 0), posto(beta, 1)] } });

  // Disponibilità dalle scorte vere e alternativa.
  await scorte(alfa, 'S', 0);
  const esaurito = await leggi(id);
  check('With stock at zero the outfit is no longer buyable', esaurito?.disponibilita?.acquistabile === false && esaurito.disponibilita.motivi.some((m) => m.includes(alfa.titolo) && m.includes('Sold out')), esaurito?.disponibilita?.motivi?.join('; '));
  const bloccato = await api(`/admin/outfit/${id}/stato`, admin, { corpo: { stato: 'pubblicato' } });
  check('An outfit with a sold out piece cannot be published', bloccato.stato === 400 && bloccato.corpo?.message?.startsWith('Cannot publish') && bloccato.corpo.message.includes('Sold out'), bloccato.corpo?.message);
  const conAlternativa = (await api(`/admin/outfit/${id}`, admin, { corpo: { capi: [posto(alfa, 0, { alternativa_product_id: gamma.id, alternativa_azienda_id: gamma.azienda }), posto(beta, 1)] } })).corpo.outfit;
  check('The alternative makes the outfit buyable again', conAlternativa?.disponibilita?.acquistabile === true && conAlternativa.disponibilita.capi_sostituiti === 1);
  check('The piece shows as replaced', conAlternativa?.capi?.[0]?.in_sostituzione === true && conAlternativa.capi[0].alternativa?.product_id === gamma.id);
  check('The sum uses the price of the alternative', conAlternativa?.prezzo?.somma === 350, String(conAlternativa?.prezzo?.somma));
  check('The cost uses the alternative too: if missing, it says so', conAlternativa?.economia?.mancanti?.includes(gamma.titolo));

  const visteC = await api(`/vendor/outfit/${id}`, azC);
  check('The company of the alternative sees it as an alternative', visteC.stato === 200 && visteC.corpo.outfit?.capi?.length === 1 && visteC.corpo.outfit.capi[0].ruolo === 'alternativa');
  check('Without a supply price it sees its own offer price', visteC.corpo.outfit?.capi?.[0]?.valore === 150 && visteC.corpo.outfit.capi[0].valore_tipo === 'offerta');

  await scorte(alfa, 'S', 5);
  const tornato = await leggi(id);
  check('When stock returns, the main piece takes its place back', tornato?.capi?.[0]?.in_sostituzione === false && tornato.prezzo.somma === 300 && tornato.disponibilita.capi_sostituiti === 0);
  await api(`/admin/outfit/${id}`, admin, { corpo: { capi: [posto(alfa, 0), posto(beta, 1)] } });
  const senzaC = await api(`/vendor/outfit/${id}`, azC);
  check('Once the alternative is removed, that company no longer sees the outfit', negato(senzaC), `HTTP ${senzaC.stato}`);

  // Pubblicazione reale dello stato.
  const unCapo = await nuovoOutfit('Prova single');
  const idUno = unCapo.corpo.outfit.id;
  await api(`/admin/outfit/${idUno}`, admin, { corpo: { capi: [posto(alfa, 0)] } });
  const poco = await api(`/admin/outfit/${idUno}/stato`, admin, { corpo: { stato: 'pubblicato' } });
  check('One piece alone cannot be published', poco.stato === 400 && inglese(poco.corpo?.message), poco.corpo?.message);
  await api(`/admin/outfit/${idUno}`, admin, { corpo: { capi: [posto(alfa, 0), posto(beta, 1)], modalita_prezzo: 'fisso', prezzo_fisso: null } });
  const senzaPrezzo = await api(`/admin/outfit/${idUno}/stato`, admin, { corpo: { stato: 'pubblicato' } });
  check('A missing outfit price blocks publishing', senzaPrezzo.stato === 400 && senzaPrezzo.corpo?.message?.includes('Outfit price is missing'), senzaPrezzo.corpo?.message);
  await api(`/admin/outfit/${idUno}`, admin, { corpo: { capi: [posto(alfa, 0)], modalita_prezzo: 'somma' } });

  const statoSbagliato = await api(`/admin/outfit/${id}/stato`, admin, { corpo: { stato: 'venduto' } });
  check('An unknown status is refused', statoSbagliato.stato === 400 && inglese(statoSbagliato.corpo?.message), statoSbagliato.corpo?.message);
  const pubblicato = await api(`/admin/outfit/${id}/stato`, admin, { corpo: { stato: 'pubblicato' } });
  check('Publishing works', pubblicato.stato === 200 && pubblicato.corpo.outfit?.stato === 'pubblicato' && Boolean(pubblicato.corpo.outfit.pubblicato_il));
  check('Published status stays saved', (await leggi(id))?.stato === 'pubblicato');
  const fermo = await api(`/admin/outfit/${id}`, admin, { corpo: { nome: 'Prova changed' } });
  check('A published outfit cannot be edited without going back to draft', fermo.stato === 400 && inglese(fermo.corpo?.message), fermo.corpo?.message);
  const noElimina = await api(`/admin/outfit/${id}`, admin, { metodo: 'DELETE' });
  check('A published outfit cannot be deleted', noElimina.stato === 400 && inglese(noElimina.corpo?.message), noElimina.corpo?.message);
  const archiviato = await api(`/admin/outfit/${id}/stato`, admin, { corpo: { stato: 'archiviato' } });
  check('Archiving works', archiviato.corpo.outfit?.stato === 'archiviato');
  const inBozza = await api(`/admin/outfit/${id}/stato`, admin, { corpo: { stato: 'bozza' } });
  check('Back to draft works and clears the publishing date', inBozza.corpo.outfit?.stato === 'bozza' && inBozza.corpo.outfit.pubblicato_il === null);
  await api(`/admin/outfit/${id}/stato`, admin, { corpo: { stato: 'pubblicato' } });

  // Elenco, filtri e ricerca.
  const elenco = await api(`/admin/outfit?q=${stamp}`, admin);
  check('Search by name', elenco.stato === 200 && elenco.corpo.count === 2, `${elenco.corpo.count} outfits`);
  check('The list carries the composition for the photo', elenco.corpo.outfit?.find((o) => o.id === id)?.capi?.every((c) => c.foto !== undefined && typeof c.x === 'number'));
  check('The list does not carry sizes and stock', elenco.corpo.outfit?.every((o) => o.capi.every((c) => c.varianti === undefined)));
  const aziendaA = elenco.corpo.aziende?.find((x) => x.nome === azA.nome);
  check('The list offers only companies present in outfits, with a count', elenco.corpo.aziende?.length === 2 && aziendaA?.outfit === 2 && elenco.corpo.aziende.find((x) => x.nome === azB.nome)?.outfit === 1, elenco.corpo.aziende?.map((x) => `${x.nome} ${x.outfit}`).join(', '));
  check('Counts by status', elenco.corpo.conteggi?.pubblicato === 1 && elenco.corpo.conteggi?.bozza === 1 && elenco.corpo.conteggi?.archiviato === 0, JSON.stringify(elenco.corpo.conteggi));
  const pubblicati = await api(`/admin/outfit?q=${stamp}&stato=pubblicato`, admin);
  check('Status filter', pubblicati.corpo.count === 1 && pubblicati.corpo.outfit[0].id === id);
  check('Company pills count the chosen status, as in the panel', pubblicati.corpo.aziende?.find((x) => x.nome === azA.nome)?.outfit === 1, pubblicati.corpo.aziende?.map((x) => `${x.nome} ${x.outfit}`).join(', '));
  const perCodice = async (testo) => (await api(`/admin/outfit?q=${encodeURIComponent(testo)}`, admin)).corpo.outfit?.some((o) => o.id === id);
  check('Search finds a note', await perCodice(`linen note ${stamp}`));
  check('Search finds a piece by name', await perCodice(beta.titolo));
  check('Search finds a piece by SKU', await perCodice(`PROVAOUT-${stamp}-BETA-M`));
  check('Without demo data, results stay empty', (await leggi(id))?.risultati === null);
  const conDati = await outfitConRisultati();
  if (conDati) {
    const lettura = await leggi(conDati.id);
    check('With demo data, results reach the outfit', lettura?.risultati?.viste > 0 && lettura.risultati.serie?.length > 0, conDati.nome);
    const suaAzienda = (await api('/vendor/outfit?limit=100', azA)).corpo.outfit ?? [];
    check('Companies never receive results', !/viste|incasso|risultati/.test(JSON.stringify(suaAzienda)));
  } else {
    console.log('Demo results not loaded yet: full block not checked');
  }
  await scorte(beta, 'S', 0);
  await scorte(beta, 'M', 0);
  const nonAcquistabili = await api(`/admin/outfit?q=${stamp}&disponibilita=non_acquistabili`, admin);
  check('Availability filter', nonAcquistabili.corpo.outfit?.some((o) => o.id === id) && nonAcquistabili.corpo.outfit.every((o) => !o.disponibilita.acquistabile), `${nonAcquistabili.corpo.count} outfits`);
  check('A published outfit follows real stock', (await leggi(id))?.disponibilita?.acquistabile === false);
  await scorte(beta, 'S', 3);
  await scorte(beta, 'M', 3);
  const perAzienda = await api(`/admin/outfit?q=${stamp}&azienda=${azB.azienda}`, admin);
  check('Company filter', perAzienda.corpo.count === 1 && perAzienda.corpo.outfit[0].id === id);

  // Aziende: solo i propri capi, sul server.
  const mioElenco = await api('/vendor/outfit', azA);
  const mio = mioElenco.corpo.outfit?.find((o) => o.id === id);
  check('A company sees the outfit with one of its pieces', mioElenco.stato === 200 && Boolean(mio));
  const dettaglio = await api(`/vendor/outfit/${id}`, azA);
  const testo = JSON.stringify(dettaglio.corpo);
  check('It sees its own piece only', dettaglio.corpo.outfit?.capi?.length === 1 && dettaglio.corpo.outfit.capi[0].titolo === alfa.titolo && dettaglio.corpo.outfit.altri_capi === 1);
  check('No trace of another company\'s piece', !testo.includes(beta.titolo) && !testo.includes(beta.id) && !testo.includes(azB.azienda) && !testo.includes(azB.nome));
  check('No margin and no total cost', !/margine|economia|costo|sconto_aziende/.test(testo));
  check('No outfit price', !/prezzo_fisso|"finale"|"somma"|"prezzo"/.test(testo));
  check('It sees its own supply price', dettaglio.corpo.outfit?.capi?.[0]?.valore === 60 && dettaglio.corpo.outfit.capi[0].valore_tipo === 'cessione');
  check('Never supply price and sale price together: the margin cannot be derived', dettaglio.corpo.outfit?.capi?.[0]?.varianti?.every((v) => v.valore === 60) && !testo.includes(':100,'));
  check('It sees its own sizes and stock', dettaglio.corpo.outfit?.capi?.[0]?.varianti?.find((v) => v.titolo === 'S')?.quantita === 5);
  check('It sees only its share of the discount', dettaglio.corpo.outfit?.capi?.[0]?.sconto_a_carico === 20, String(dettaglio.corpo.outfit?.capi?.[0]?.sconto_a_carico));
  const suo = await api(`/vendor/outfit/${id}`, azB);
  check('The other company sees its own numbers', suo.corpo.outfit?.capi?.[0]?.valore === 120 && suo.corpo.outfit.capi[0].sconto_a_carico === 40 && !JSON.stringify(suo.corpo).includes(alfa.titolo));
  const estranea = await api(`/vendor/outfit/${idUno}`, azB);
  check('An outfit without its pieces does not exist for a company', negato(estranea), `HTTP ${estranea.stato}`);
  check('Nor does it appear in its list', !(await api('/vendor/outfit?limit=100', azB)).corpo.outfit?.some((o) => o.id === idUno));
  check('The company list has the same limit', !JSON.stringify(mio ?? {}).includes(beta.titolo));
  check('Status filter for companies too', (await api('/vendor/outfit?stato=archiviato', azA)).corpo.outfit?.every((o) => o.stato === 'archiviato'));
  check('Search for companies too', (await api(`/vendor/outfit?q=Prova%20single%20${stamp}`, azA)).corpo.count === 1);
  check('A company cannot pose as another through the header', negato(await api(`/vendor/outfit/${id}`, { token: azA.token, azienda: azB.azienda })));
  check('A company cannot write: no write routes', negato(await api(`/vendor/outfit/${id}`, azA, { corpo: { nome: 'Violazione' } })) && negato(await api(`/vendor/outfit/${id}`, azA, { metodo: 'DELETE' })) && negato(await api('/vendor/outfit', azA, { corpo: { nome: 'Violazione' } })));
  check('A company cannot enter panel routes', negato(await api(`/admin/outfit/${id}`, azA)) && negato(await api('/admin/outfit/catalogo', azA)));

  const mag = await magazziniere(azA);
  check('Warehouse staff do not see outfits, as the spec says', negato(await api('/vendor/outfit', mag)) && negato(await api(`/vendor/outfit/${id}`, mag)));

  // Ruoli del pannello.
  const collab = await collaboratore('lettura');
  const s = collab.sessione;
  check('Read-only role sees outfits', (await api(`/admin/outfit/${id}`, s)).stato === 200);
  const lettura = JSON.stringify((await api(`/admin/outfit/${id}`, s)).corpo);
  check('Without the margins permission no cost or margin arrives', !/economia|margine|"costo"/.test(lettura));
  check('Not in the list either', !/economia|margine|"costo"/.test(JSON.stringify((await api(`/admin/outfit?q=${stamp}`, s)).corpo)));
  check('Read-only role cannot create', negato(await api('/admin/outfit', s, { corpo: { nome: 'Prova violation' } })));
  check('Read-only role cannot edit', negato(await api(`/admin/outfit/${idUno}`, s, { corpo: { nome: 'Prova violation' } })));
  check('Read-only role cannot open the picker catalogue', negato(await api('/admin/outfit/catalogo', s)));
  check('Read-only role cannot publish', negato(await api(`/admin/outfit/${idUno}/stato`, s, { corpo: { stato: 'archiviato' } })));
  await collab.cambiaRuolo('marketing');
  check('Marketing edits a draft', (await api(`/admin/outfit/${idUno}`, s, { corpo: { descrizione: 'Prova marketing' } })).stato === 200);
  const catalogoMarketing = await api(`/admin/outfit/catalogo?q=${stamp}`, s);
  check('Marketing opens the catalogue, without costs', catalogoMarketing.stato === 200 && !/"costo"/.test(JSON.stringify(catalogoMarketing.corpo)));
  check('Marketing does not see margins', !/economia|margine/.test(JSON.stringify((await api(`/admin/outfit/${id}`, s)).corpo)));
  check('Marketing cannot publish', negato(await api(`/admin/outfit/${idUno}/stato`, s, { corpo: { stato: 'pubblicato' } })));
  check('Marketing cannot delete', negato(await api(`/admin/outfit/${idUno}`, s, { metodo: 'DELETE' })));
  await collab.cambiaRuolo('ordini');
  check('A role without the outfit permission is refused', negato(await api('/admin/outfit', s)) && negato(await api(`/admin/outfit/${id}`, s)));
  await collab.cambiaRuolo('catalogo');
  check('Catalogue manager sees margins', (await leggi(id, s))?.economia?.margine === 120, String((await leggi(id, s))?.economia?.margine));
  check('Catalogue manager manages status', (await api(`/admin/outfit/${idUno}/stato`, s, { corpo: { stato: 'archiviato' } })).corpo.outfit?.stato === 'archiviato');

  // Eliminazione e registro.
  const eliminato = await api(`/admin/outfit/${idUno}`, admin, { metodo: 'DELETE' });
  check('Deleting works', eliminato.stato === 200 && eliminato.corpo.eliminato === true);
  check('A deleted outfit is gone', (await api(`/admin/outfit/${idUno}`, admin)).stato === 404);
  creati.outfit = creati.outfit.filter((o) => o !== idUno);

  const registro = await api('/admin/registro', admin);
  const azioni = registro.corpo.voci?.map((v) => v.azione) ?? [];
  for (const attesa of ['Outfit updated', 'Outfit status changed', 'Outfit deleted']) {
    check(`Activity log: ${attesa}`, azioni.includes(attesa));
  }
  // Il prefisso «Negato» sta in un file comune: vale anche quando sarà tradotto.
  check('Activity log: denied attempt', azioni.some((a) => /^(negato|denied): outfit status changed$/i.test(a)));
  return { id, alfa, beta, gamma };
}

async function apriElenco(pagina) {
  await attendiBackend();
  await pagina.goto(`${CONSOLE}/outfit`);
  await pagina.locator('.griglia-outfit, .vuoto').first().waitFor({ timeout: 40000 });
}

async function provaBrowser({ alfa, beta, gamma }) {
  const { browser, nuovaPagina, errori } = await apriBrowser();
  try {
    await attendiBackend();
    const pagina = await nuovaPagina();
    await accediAdminBrowser(pagina);

    await pagina.goto(`${CONSOLE}/outfit`);
    const ricerca = pagina.getByLabel('Search by name, note or piece');
    await ricerca.fill(`Inesistente ${stamp}`);
    await pagina.getByText('Nothing here').waitFor();
    check('Browser: empty state names the search', (await pagina.locator('.vuoto').innerText()).includes(`match “Inesistente ${stamp}”`));
    await pagina.getByRole('button', { name: 'Clear filters' }).click();
    check('Browser: Clear filters empties the search', (await ricerca.inputValue()) === '');

    // Nuovo outfit dal parametro usato dal menu Nuovo.
    await pagina.goto(`${CONSOLE}/outfit?nuovo=1`);
    await pagina.getByRole('dialog').waitFor();
    check('Browser: the new outfit dialog is in English', (await paroleItaliane(pagina, '.modale')) === null, String(await paroleItaliane(pagina, '.modale')));
    await pagina.getByRole('button', { name: 'Save draft' }).click();
    await pagina.getByText('Give it a name.').waitFor();
    check('Browser: an empty name is flagged under the field', (await pagina.getByRole('dialog').count()) === 1);
    await pagina.getByLabel('Outfit name').fill(`Prova browser ${stamp}`);
    await pagina.getByLabel('Style notes').fill(`Prova notes ${stamp}`);
    await pagina.getByRole('button', { name: 'Save draft' }).click();
    await pagina.locator('.avvisi', { hasText: 'saved as a draft' }).waitFor();
    check('Browser: a toast confirms the draft', true);
    await pagina.waitForURL(/\/outfit\/outf_/);
    const idOutfit = new URL(pagina.url()).pathname.split('/').pop();
    creati.outfit.push(idOutfit);
    check('Browser: ?nuovo=1 opens the form and leads to the editor', Boolean(idOutfit));
    check('Browser: style notes reach the server', (await leggi(idOutfit)).descrizione === `Prova notes ${stamp}`);

    // I modali escono con un movimento: finché dura ne esiste ancora la copia.
    const modaleChiuso = () => pagina.waitForFunction(() => !document.querySelector('.modale'));
    const aggiungi = async (capo) => {
      await pagina.getByRole('button', { name: 'Add piece' }).click();
      await pagina.getByLabel('Search the catalogue').fill(capo.titolo);
      const voce = pagina.locator('.catalogo-capi__voce', { hasText: capo.titolo });
      await voce.getByRole('button', { name: 'Choose' }).click();
      await modaleChiuso();
    };
    await pagina.getByRole('button', { name: 'Add piece' }).click();
    await pagina.locator('.catalogo-capi__voce').first().waitFor();
    check('Browser: the piece picker is in English', (await paroleItaliane(pagina, '.modale')) === null, String(await paroleItaliane(pagina, '.modale')));
    await pagina.getByRole('button', { name: 'Close' }).click();
    await modaleChiuso();

    await aggiungi(alfa);
    await pagina.locator('[data-prova="pezzo"]').first().waitFor();
    await aggiungi(beta);
    await pagina.locator('[data-prova="pezzo"]').nth(1).waitFor();
    check('Browser: two pieces from different companies on the canvas', (await pagina.locator('[data-prova="pezzo"]').count()) === 2);
    check('Browser: sizes appear in the list of pieces', await pagina.locator('.taglie li', { hasText: 'S' }).first().isVisible());
    check('Browser: real photos on the canvas', (await fotoVisibili(pagina, '.tela__pezzo img')) === 2);

    // I capi nuovi si sovrappongono: il mouse afferra quello in cima, cioè l'ultimo aggiunto.
    const pezzo = pagina.locator('[data-prova="pezzo"]').last();
    const prima = (await leggi(idOutfit)).capi.find((c) => c.product_id === beta.id);
    const box = await pezzo.boundingBox();
    await pagina.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await pagina.mouse.down();
    await pagina.waitForTimeout(260);
    check('Browser: the piece in hand is lifted', await pezzo.evaluate((e) => e.classList.contains('tela__pezzo--preso') && getComputedStyle(e).scale !== 'none'));
    const fotogrammi = pagina.evaluate(() => new Promise((fatto) => {
      const e = document.querySelector('.tela__pezzo--preso');
      const prezzo = document.querySelector('.conti');
      const inizio = performance.now();
      const posizioni = [];
      let scritture = 0;
      const spia = new MutationObserver((voci) => { scritture += voci.length; });
      spia.observe(prezzo, { subtree: true, childList: true, characterData: true });
      const passo = () => {
        posizioni.push(Math.round(e.getBoundingClientRect().x * 10) / 10);
        if (performance.now() - inizio < 900) requestAnimationFrame(passo);
        else {
          spia.disconnect();
          const inMoto = posizioni.filter((x, i) => i > 0 && x !== posizioni[i - 1]).length;
          const primo = posizioni.findIndex((x) => x !== posizioni[0]);
          const ultimo = posizioni.findLastIndex((x, i) => i > 0 && x !== posizioni[i - 1]);
          fatto({ inMoto, durante: Math.max(1, ultimo - primo + 1), scritture });
        }
      };
      requestAnimationFrame(passo);
    }));
    // Un gesto vero: un piccolo passo a ogni fotogramma, non una raffica.
    for (let passo = 1; passo <= 30; passo += 1) {
      await pagina.mouse.move(box.x + box.width / 2 + (70 * passo) / 30, box.y + box.height / 2 + (60 * passo) / 30);
      await pagina.waitForTimeout(16);
    }
    const passi = await fotogrammi;
    check('Browser: dragging is smooth, frame by frame', passi.inMoto >= 4 && passi.inMoto / passi.durante >= 0.75, `moved in ${passi.inMoto} of ${passi.durante} frames`);
    check('Browser: dragging does not touch the rest of the page', passi.scritture === 0, `${passi.scritture} changes`);
    await pagina.mouse.up();
    await pagina.getByText('All changes saved').waitFor();
    await pagina.waitForTimeout(900);
    await pagina.getByText('All changes saved').waitFor();
    const dopo = (await leggi(idOutfit)).capi.find((c) => c.product_id === beta.id);
    check('Browser: dragging with the mouse moves the piece on the server', dopo.x > prima.x + 3 && dopo.y > prima.y + 3, `x ${prima.x} → ${dopo.x}, y ${prima.y} → ${dopo.y}`);

    await pezzo.focus();
    await pagina.keyboard.press('ArrowRight');
    await pagina.waitForTimeout(800);
    await pagina.getByText('All changes saved').waitFor();
    const conTasto = (await leggi(idOutfit)).capi.find((c) => c.product_id === beta.id);
    check('Browser: the keyboard moves the piece too', conTasto.x > dopo.x, `x ${dopo.x} → ${conTasto.x}`);

    await pagina.locator('.capo-riga', { hasText: alfa.titolo }).getByRole('button', { name: 'Add an alternative' }).click();
    await pagina.getByLabel('Search the catalogue').fill(gamma.titolo);
    await pagina.locator('.catalogo-capi__voce', { hasText: gamma.titolo }).getByRole('button', { name: 'Choose' }).click();
    await modaleChiuso();
    await pagina.getByText(`Alternative: ${gamma.titolo}`).waitFor();
    check('Browser: an alternative is chosen from the catalogue', (await leggi(idOutfit)).capi.find((c) => c.product_id === alfa.id).alternativa?.product_id === gamma.id);
    await pagina.getByRole('button', { name: `Remove the alternative for ${alfa.titolo}` }).click();
    await pagina.getByText(`Alternative: ${gamma.titolo}`).waitFor({ state: 'detached' });
    check('Browser: the alternative is removed', (await leggi(idOutfit)).capi.find((c) => c.product_id === alfa.id).alternativa === null);

    const campoNome = pagina.getByLabel('Outfit name');
    await campoNome.fill('');
    check('Browser: the name can be emptied to retype it', (await campoNome.inputValue()) === '');
    await campoNome.fill(`Prova browser ${stamp} renamed`);
    await pagina.getByRole('heading', { name: `Prova browser ${stamp} renamed` }).waitFor();
    await campoNome.fill(`Prova browser ${stamp}`);
    await pagina.getByRole('heading', { name: `Prova browser ${stamp}`, exact: true }).waitFor();
    await pagina.waitForTimeout(800);
    await pagina.getByText('All changes saved').waitFor();
    check('Browser: the new name reaches the server', (await leggi(idOutfit)).nome === `Prova browser ${stamp}`);

    await pagina.getByRole('button', { name: 'Outfit price' }).click();
    await pagina.getByLabel('Price for the whole outfit').fill('240');
    await pagina.getByText('Outfit discount').waitFor();
    await pagina.getByRole('button', { name: 'Companies', exact: true }).click();
    await pagina.getByText('Funded by companies').waitFor();
    check('Browser: outfit price and discount rule come from the server', (await pagina.locator('.conti').first().innerText()).includes('60.00'));
    check('Browser: the owner sees cost and margin', await pagina.getByRole('heading', { name: 'Cost and margin' }).isVisible());
    await pagina.locator('.outfit-tessere', { hasText: '50%' }).waitFor();
    const tessere = await pagina.locator('.outfit-tessere').innerText();
    check('Browser: number tiles for price, margin and pieces', /Customer price/.test(tessere) && /240\.00/.test(tessere) && /Margin/.test(tessere) && /50%/.test(tessere) && /Pieces/.test(tessere), tessere.replace(/\s+/g, ' '));
    check('Browser: amounts use the shop currency formatter', /[^\d\s]\s?240\.00|240\.00\s?[A-Z]{3}/.test(tessere));
    check('Browser: honest empty results', await pagina.getByText('No data yet').isVisible());
    await pagina.getByText('All changes saved').waitFor();
    await pagina.waitForTimeout(900);
    await scatta(pagina, 'outfit-2-editor-scuro.png', true);
    const testoEditor = await pagina.locator('.contenuto').innerText();
    check('Browser: no raw values on screen', !/\b(undefined|null|NaN|bozza|pubblicato|archiviato)\b/.test(testoEditor));
    check('Browser: the editor has no Italian words', (await paroleItaliane(pagina)) === null, String(await paroleItaliane(pagina)));

    // Un riavvio del backend durante il clic non è un errore dell'interfaccia: si riprova, gli altri messaggi fermano la prova.
    const etichettaPubblicato = pagina.locator('.studio__barra .etichetta', { hasText: 'Published' });
    for (let tentativo = 1; tentativo <= 4; tentativo += 1) {
      await pagina.getByRole('button', { name: 'Publish' }).click();
      const riuscito = await etichettaPubblicato.waitFor({ timeout: 6000 }).then(() => true, () => false);
      if (riuscito) break;
      const avviso = await pagina.locator('.avvisi').innerText().catch(() => '');
      console.log(`Publish attempt ${tentativo}: ${avviso.replace(/\s+/g, ' ') || 'no message'}`);
      if (tentativo === 4 || !/server|reach|try again/i.test(avviso)) throw new Error(`Publish did not work: ${avviso}`);
      await attendiBackend();
    }
    check('Browser: Publish changes the real status', (await leggi(idOutfit)).stato === 'pubblicato');
    check('Browser: a published outfit cannot be dragged', (await pagina.locator('.tela--modificabile').count()) === 0);
    check('Browser: the published editor has no Italian words', (await paroleItaliane(pagina)) === null, String(await paroleItaliane(pagina)));
    const interruttore = pagina.getByRole('switch', { name: 'Published' });
    check('Browser: the Published switch is on', (await interruttore.getAttribute('aria-checked')) === 'true');
    await interruttore.click();
    await pagina.locator('.studio__barra .etichetta', { hasText: 'Draft' }).waitFor();
    check('Browser: the switch moves the outfit back to draft', (await leggi(idOutfit)).stato === 'bozza');
    await interruttore.click();
    await etichettaPubblicato.waitFor();
    check('Browser: the switch publishes it again', (await leggi(idOutfit)).stato === 'pubblicato');

    const conRisultatiDemo = await outfitConRisultati();
    if (conRisultatiDemo) {
      await pagina.goto(`${CONSOLE}/outfit/${conRisultatiDemo.id}`);
      await pagina.locator('.outfit-andamento').waitFor();
      await pagina.locator('.studio__risultati dd').first().waitFor();
      await pagina.waitForTimeout(1100);
      const risultati = await pagina.locator('.studio__risultati').innerText();
      check('Browser: results block is full with demo data', /Views/.test(risultati) && /Last \d+ days/i.test(risultati) && !/Views\s+0/.test(risultati), risultati.replace(/\s+/g, ' ').slice(0, 120));
      check('Browser: the third tile shows sales', /Sold · 30 days/.test(await pagina.locator('.outfit-tessere').first().innerText()));
      await scatta(pagina, 'outfit-7-risultati.png', true);
    }

    await pagina.goto(`${CONSOLE}/outfit`);
    await pagina.getByLabel('Search by name, note or piece').fill(`Prova browser ${stamp}`);
    const scheda = pagina.locator('.outfit-scheda', { hasText: `Prova browser ${stamp}` });
    await scheda.waitFor();
    await pagina.waitForFunction(() => document.querySelectorAll('.outfit-scheda').length === 1, null, { timeout: 8000 }).catch(() => undefined);
    check('Browser: search finds the outfit', (await pagina.locator('.outfit-scheda').count()) === 1);
    check('Browser: the photo is composed of real pieces', (await scheda.locator('.foto-composta__pezzo').count()) === 2);
    check('Browser: the composed photo shows the pieces', (await fotoVisibili(pagina, '.foto-composta img')) === 2);
    check('Browser: the card has a status label and an availability pill', (await scheda.locator('.outfit-scheda__stato').innerText()) === 'Published' && (await scheda.locator('.outfit-chip').innerText()) === 'Buyable');
    await scatta(pagina, 'outfit-1-elenco.png');
    check('Browser: the list has no Italian words', (await paroleItaliane(pagina)) === null, String(await paroleItaliane(pagina)));

    const geometria = await scheda.evaluate((e) => {
      const carta = e.getBoundingClientRect();
      const foto = e.querySelector('.foto-composta').getBoundingClientRect();
      return { larga: carta.width, foto: foto.width / foto.height, margine: foto.x - carta.x };
    });
    check('Browser: card and photo keep the panel proportions', geometria.larga > 200 && geometria.larga < 216 && Math.abs(geometria.foto - 192 / 167) < 0.02 && Math.abs(geometria.margine - 10) < 0.1, JSON.stringify(geometria));
    for (const nome of ['Filter by status', 'Filter by availability', 'View', 'Filter by company']) {
      check(`Browser: control present: ${nome}`, await pagina.getByRole('group', { name: nome }).isVisible());
    }
    const cursore = pagina.getByRole('group', { name: 'Filter by status' }).locator('.selettore__pillola');
    const ritaglio = () => cursore.evaluate((e) => getComputedStyle(e).clipPath);
    const primaCursore = await ritaglio();
    await pagina.getByRole('button', { name: 'List', exact: true }).click();
    await pagina.locator('.outfit-tabella tbody tr').first().waitFor();
    check('Browser: list view shows the same outfits', (await pagina.locator('.outfit-tabella tbody tr').count()) === 1 && (await pagina.locator('.outfit-tabella').innerText()).includes('Buyable'));
    check('Browser: the list view has no Italian words', (await paroleItaliane(pagina)) === null, String(await paroleItaliane(pagina)));
    await pagina.getByRole('button', { name: 'Tiles', exact: true }).click();
    await scheda.waitFor();
    await pagina.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: /Drafts/ }).click();
    await pagina.getByText('Nothing here').waitFor();
    check('Browser: the status segment filters the list', (await pagina.locator('.outfit-scheda').count()) === 0);
    await pagina.waitForTimeout(600);
    check('Browser: the segment cursor slides to the new choice', (await ritaglio()) !== primaCursore);
    await pagina.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: 'Published' }).click();
    await scheda.waitFor();
    const pillola = pagina.getByRole('group', { name: 'Filter by company' }).getByRole('button', { name: new RegExp(azB.nome) });
    await pillola.click();
    await pagina.waitForFunction(() => document.querySelector('.filtri button[aria-pressed="true"]')?.textContent?.startsWith('Everything') === false);
    await pagina.locator('.griglia-outfit').waitFor();
    await scheda.waitFor();
    check('Browser: company pills filter the list', (await pillola.getAttribute('aria-pressed')) === 'true' && (await pagina.locator('.outfit-scheda').count()) === 1);

    const chiara = await nuovaPagina({ colorScheme: 'light' });
    await accediAdminBrowser(chiara);
    await chiara.goto(`${CONSOLE}/outfit/${idOutfit}`);
    await chiara.locator('[data-prova="pezzo"]').first().waitFor();
    check('Browser: light theme active', (await chiara.evaluate(() => document.documentElement.dataset.tema)) === 'chiaro');
    await fotoVisibili(chiara, '.tela__pezzo img');
    await scatta(chiara, 'outfit-3-editor-chiaro.png', true);
    await apriElenco(chiara);
    await fotoVisibili(chiara, '.foto-composta img');
    await scatta(chiara, 'outfit-3-elenco-chiaro.png');

    // Telefono: 390 px e tocco vero, inviato al browser come dito e non come mouse.
    await api(`/admin/outfit/${idOutfit}/stato`, admin, { corpo: { stato: 'bozza' } });
    const telefono = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'dark', locale: 'en-GB' });
    const mobile = await telefono.newPage();
    mobile.setDefaultTimeout(15000);
    mobile.on('pageerror', (e) => errori.push(e.message));
    await accediAdminBrowser(mobile);
    await apriElenco(mobile);
    check('Phone: list without sideways scrolling', await senzaScorrimento(mobile));
    check('Phone: the primary button is full width', await mobile.evaluate(() => { const b = [...document.querySelectorAll('.pagina__testa button')].find((e) => e.textContent.includes('New outfit')); return b.getBoundingClientRect().width > 300; }));
    await mobile.goto(`${CONSOLE}/outfit/${idOutfit}`);
    const dito = mobile.locator('[data-prova="pezzo"]').first();
    await dito.waitFor();
    check('Phone: editor without sideways scrolling', await senzaScorrimento(mobile));
    check('Phone: results come after pieces and price', await mobile.evaluate(() => {
      const posizione = (testo) => [...document.querySelectorAll('.riquadro h2')].find((t) => t.textContent === testo)?.getBoundingClientRect().top ?? 0;
      return posizione('Results') > posizione('Price') && posizione('Results') > posizione('Pieces and availability');
    }));
    await dito.scrollIntoViewIfNeeded();
    const primaTocco = (await leggi(idOutfit)).capi.find((c) => c.product_id === alfa.id);
    const cdp = await telefono.newCDPSession(mobile);
    const area = await dito.boundingBox();
    const inizio = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
    const scorrimentoPrima = await mobile.evaluate(() => window.scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [inizio] });
    for (let passo = 1; passo <= 8; passo += 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: inizio.x - passo * 4, y: inizio.y + passo * 5 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.getByText('All changes saved').waitFor();
    await mobile.waitForTimeout(900);
    await mobile.getByText('All changes saved').waitFor();
    const dopoTocco = (await leggi(idOutfit)).capi.find((c) => c.product_id === alfa.id);
    check('Phone: a finger moves the piece and the save arrives', Math.abs(dopoTocco.y - primaTocco.y) > 2, `y ${primaTocco.y} → ${dopoTocco.y}`);
    check('Phone: dragging a piece does not scroll the page', (await mobile.evaluate(() => window.scrollY)) === scorrimentoPrima);
    await fotoVisibili(mobile, '.tela__pezzo img');
    await scatta(mobile, 'outfit-4-telefono.png', true);
    await mobile.getByRole('button', { name: 'Add piece' }).click();
    await mobile.locator('.catalogo-capi__voce').first().waitFor();
    check('Phone: the piece picker does not scroll sideways', await senzaScorrimento(mobile));
    await scatta(mobile, 'outfit-4-telefono-catalogo.png');
    await telefono.close();

    // Azienda nel browser: stesso outfit, solo il proprio capo.
    await api(`/admin/outfit/${idOutfit}/stato`, admin, { corpo: { stato: 'pubblicato' } });
    const azienda = await nuovaPagina();
    await accediAziendaBrowser(azienda, 'seller@mercur.dev');
    await azienda.goto(`${CONSOLE}/outfit`);
    const propria = azienda.locator('.outfit-scheda', { hasText: `Prova browser ${stamp}` });
    await propria.waitFor();
    check('Company in the browser: sees the outfit, with one piece in the photo', (await propria.locator('.foto-composta__pezzo').count()) === 1);
    check('Company in the browser: the list has no Italian words', (await paroleItaliane(azienda)) === null, String(await paroleItaliane(azienda)));
    await fotoVisibili(azienda, '.outfit-scheda .foto-composta img');
    await scatta(azienda, 'outfit-5-azienda-elenco.png');
    await propria.click();
    await azienda.getByText('Stock and value').waitFor();
    const testoAzienda = await azienda.locator('.contenuto').innerText();
    check('Company in the browser: no pieces or names of others', !testoAzienda.includes(beta.titolo) && !testoAzienda.includes(azB.nome));
    check('Company in the browser: no outfit price or margin', !/240\.00|margin/i.test(testoAzienda));
    check('Company in the browser: read only', (await azienda.getByRole('button', { name: /Publish|Archive|Delete|Add piece/ }).count()) === 0 && (await azienda.locator('.tela').count()) === 0);
    check('Company in the browser: correct singular sentence', testoAzienda.includes('Together with one other piece'));
    check('Company in the browser: the page has no Italian words', (await paroleItaliane(azienda)) === null, String(await paroleItaliane(azienda)));
    check('Company in the browser: sees the photo of its piece', (await fotoVisibili(azienda, '.foto-composta img')) === 1);
    await scatta(azienda, 'outfit-5-azienda.png', true);

    const aziendaMobile = await nuovaPagina({ viewport: { width: 390, height: 844 } });
    await accediAziendaBrowser(aziendaMobile, 'seller@mercur.dev');
    await aziendaMobile.goto(`${CONSOLE}/outfit`);
    await aziendaMobile.locator('.outfit-scheda', { hasText: `Prova browser ${stamp}` }).click();
    await aziendaMobile.getByText('Stock and value').waitFor();
    check('Company on a phone: no sideways scrolling', await senzaScorrimento(aziendaMobile));
    await fotoVisibili(aziendaMobile, '.foto-composta img');
    await scatta(aziendaMobile, 'outfit-6-azienda-telefono.png', true);

    // Eliminazione dall'interfaccia: passa dalla finestra di conferma.
    await api(`/admin/outfit/${idOutfit}/stato`, admin, { corpo: { stato: 'archiviato' } });
    await pagina.goto(`${CONSOLE}/outfit/${idOutfit}`);
    await pagina.getByRole('button', { name: 'Delete' }).click();
    await pagina.getByRole('dialog', { name: 'Delete this outfit?' }).waitFor();
    check('Browser: the delete dialog is in English', (await paroleItaliane(pagina, '.modale')) === null, String(await paroleItaliane(pagina, '.modale')));
    await pagina.getByRole('dialog', { name: 'Delete this outfit?' }).getByRole('button', { name: 'Delete' }).click();
    await pagina.waitForURL(/\/outfit$/);
    check('Browser: Delete removes the outfit', (await api(`/admin/outfit/${idOutfit}`, admin)).stato === 404);
    creati.outfit = creati.outfit.filter((o) => o !== idOutfit);

    check('No errors in the browser console', errori.length === 0, errori.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
}

async function pulisci() {
  const esiti = [];
  const prova = async (azione) => {
    try {
      const esito = await azione();
      if (esito.stato >= 400) console.log(`Cleanup failed: HTTP ${esito.stato} ${JSON.stringify(esito.corpo).slice(0, 160)}`);
      esiti.push(esito.stato < 400);
    } catch (errore) {
      console.log(`Cleanup failed: ${errore.message}`);
      esiti.push(false);
    }
  };
  for (const id of creati.outfit) {
    await prova(() => api(`/admin/outfit/${id}/stato`, admin, { corpo: { stato: 'archiviato' } }));
    await prova(() => api(`/admin/outfit/${id}`, admin, { metodo: 'DELETE' }));
  }
  for (const id of creati.offerte) await prova(() => api(`/admin/offers/${id}`, admin, { metodo: 'DELETE' }));
  for (const id of creati.articoli) await prova(() => api(`/admin/inventory-items/${id}`, admin, { metodo: 'DELETE' }));
  for (const id of creati.prodotti) await prova(() => api(`/admin/products/${id}`, admin, { metodo: 'DELETE' }));
  for (const id of creati.collaboratori) await prova(() => api(`/admin/team/${id}`, admin, { metodo: 'DELETE' }));
  for (const { azienda, id } of creati.membri) await prova(() => api(`/vendor/sellers/${azienda.azienda}/members/${id}`, azienda, { metodo: 'DELETE' }));
  check('Test data cleaned up', esiti.every(Boolean), `${esiti.filter(Boolean).length} of ${esiti.length}`);
  const rimasti = await api(`/admin/outfit?q=${stamp}`, admin);
  check('No test outfits left', rimasti.corpo.count === 0, `${rimasti.corpo.count} left`);
}

try {
  const dati = await provaApi();
  await provaBrowser(dati);
} catch (errore) {
  check('The test reached the end', false, errore.stack ?? errore.message);
} finally {
  await pulisci();
  chiudi('Outfit Studio working');
}
