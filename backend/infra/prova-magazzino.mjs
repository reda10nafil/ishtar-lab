// Prova del Magazzino: scorte per azienda, correzioni, conteggio, soglie, riserve, movimenti e isolamento.
// Lavora su un articolo «Prova» creato qui e cancellato alla fine: i dati veri non cambiano.
import crypto from 'node:crypto';
import path from 'node:path';
import { CONSOLE, accediAdmin, accediAzienda, attendiBackend, chiama as chiamaBase, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';
import { CARTELLA_SCREENSHOT, accediAdminBrowser, accediAziendaBrowser, apriBrowser } from './lib-browser.mjs';
import { presenti } from '../piattaforma/packages/api/src/api/admin/magazzino/lib/presenti.ts';

/** Il backend riparte quando un altro lavoro salva un file: la richiesta si ripete quando torna. */
async function chiama(...argomenti) {
  for (let tentativo = 0; ; tentativo += 1) {
    try {
      return await chiamaBase(...argomenti);
    } catch (errore) {
      if (tentativo >= 6) throw errore;
      await attendiBackend();
    }
  }
}

const { check, chiudi } = nuovaProva();
await attendiBackend();
const stamp = Date.now();
const admin = await accediAdmin();
const a = await accediAzienda('seller@mercur.dev');
const b = await accediAzienda('kickz@mercur.dev');
const t = await accediAzienda('trailhead@mercur.dev');
const skuProva = `PROVA-${stamp}`;
const titoloProva = `Prova articolo ${stamp}`;

/** Se il backend sta ripartendo l'email può tardare di mezzo minuto: senza non si può continuare. */
async function attendiEmail(indirizzo) {
  const messaggio = await emailPer(indirizzo, 240);
  if (!messaggio) throw new Error(`Email per ${indirizzo} non arrivata`);
  return messaggio;
}

/** L'accesso dell'azienda passa dal backend, che può essere in riavvio per un altro lavoro. */
async function entraComeAzienda(pagina, email) {
  try {
    await accediAziendaBrowser(pagina, email);
  } catch {
    await attendiBackend();
    await accediAziendaBrowser(pagina, email);
  }
}

async function collaboratore(ruolo) {
  const email = `prova-${ruolo}-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  collaboratori.push({ email });
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const token = tokenDaEmail(await attendiEmail(email))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  const accettato = await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: ruolo } });
  if (accettato.stato !== 200) throw new Error(`Invito di ${email} non accettato: HTTP ${accettato.stato}`);
  return { email, sessione: await accediAdmin(email, password) };
}

/** Membro vero di un'azienda: serve a provare che i permessi valgono anche sulle rotte `/vendor`. */
async function membro(azienda, etichetta) {
  const ruoli = (await chiama('/vendor/team/ruoli', azienda)).corpo.ruoli ?? [];
  const email = `prova-membro-${etichetta.toLowerCase().replace(/[^a-z]/g, '')}-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  membri.push({ email });
  await chiama(`/vendor/sellers/${azienda.azienda}/members`, azienda, { corpo: { email, role_id: ruoli.find((r) => r.etichetta === etichetta)?.id } });
  const invito = tokenDaEmail(await attendiEmail(email))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/member/emailpass/register', null, { corpo: { email, password } });
  const accettato = await chiama('/vendor/members/invites/accept', { token: iscritto.corpo?.token }, { corpo: { invite_token: invito, first_name: 'Prova', last_name: etichetta } });
  if (accettato.stato !== 200) throw new Error(`Invito di ${email} non accettato: HTTP ${accettato.stato}`);
  return { email, sessione: await accediAzienda(email, password) };
}

const rigaDi = (corpo, sku = skuProva) => corpo.righe?.find((r) => r.sku === sku);
const scorteProva = async (s = a, base = '/vendor/magazzino') => rigaDi((await chiama(`${base}?q=${skuProva}`, s)).corpo);
const collaboratori = [];
const membri = [];
let articoloId = null;
let depositoA = null;
let aperto = null;

try {
  // Cancellando un prodotto la relazione con l'offerta può arrivare con un elemento vuoto: un 500 per tutti
  check('Un legame vuoto non ferma il magazzino', presenti([undefined, { seller_id: 'a' }, null]).length === 1 && presenti(null).length === 0 && presenti(undefined).length === 0);

  // Dati veri: un deposito per azienda, ogni azienda con la propria merce
  const tutte = await chiama('/admin/magazzino?tutte=1', admin);
  check('Amministratore: scorte di tutte le aziende', tutte.stato === 200 && tutte.corpo.conteggio >= 244, `${tutte.corpo.conteggio} righe`);
  check('Filtro per azienda disponibile', tutte.corpo.aziende?.length >= 3, tutte.corpo.aziende?.map((x) => x.nome).join(', '));
  check('Ogni deposito appartiene a un\'azienda', tutte.corpo.depositi?.length >= 3 && tutte.corpo.depositi.every((d) => d.azienda_id), tutte.corpo.depositi?.map((d) => d.nome).join(', '));
  check('Ogni riga ha prodotto, azienda e deposito', tutte.corpo.righe.every((r) => r.prodotto && r.azienda && r.deposito));
  check('Elenco dal più scarso', tutte.corpo.righe.every((r, i, righe) => i === 0 || righe[i - 1].disponibili <= r.disponibili));
  const offerte = await chiama('/vendor/offers?limit=1', a);
  const diA = tutte.corpo.righe.filter((r) => r.azienda_id === a.azienda);
  check('Le righe di un\'azienda coincidono con le sue offerte', diA.length >= offerte.corpo.count, `${diA.length} righe, ${offerte.corpo.count} offerte`);

  const perAzienda = await chiama(`/admin/magazzino?azienda=${b.azienda}&limit=5`, admin);
  check('Filtro per azienda', perAzienda.corpo.righe?.every((r) => r.azienda_id === b.azienda) && perAzienda.corpo.conteggio > 0, `${perAzienda.corpo.conteggio} righe`);
  const deposito = tutte.corpo.depositi.find((d) => d.azienda_id === b.azienda);
  const perDeposito = await chiama(`/admin/magazzino?deposito=${deposito.id}&limit=5`, admin);
  check('Filtro per deposito', perDeposito.corpo.righe?.every((r) => r.deposito_id === deposito.id) && perDeposito.corpo.conteggio > 0);
  const esempio = tutte.corpo.righe[0];
  const perSku = await chiama(`/admin/magazzino?q=${encodeURIComponent(esempio.sku)}`, admin);
  check('Ricerca per SKU', perSku.corpo.righe?.some((r) => r.sku === esempio.sku));
  const perProdotto = await chiama(`/admin/magazzino?q=${encodeURIComponent(esempio.prodotto.slice(0, 6).toLowerCase())}&limit=200`, admin);
  check('Ricerca per prodotto', perProdotto.corpo.righe?.some((r) => r.prodotto === esempio.prodotto));
  const perStato = await chiama('/admin/magazzino?stato=disponibile&limit=5', admin);
  check('Filtro per stato', perStato.corpo.righe?.every((r) => r.stato === 'disponibile'));
  check('Stato sconosciuto rifiutato', (await chiama('/admin/magazzino?stato=inesistente', admin)).stato === 400);
  const pagina = await chiama('/admin/magazzino?limit=10&offset=10', admin);
  check('Paginazione', pagina.corpo.righe?.length === 10 && pagina.corpo.conteggio >= 244);

  // Azienda: solo le proprie scorte
  const mie = await chiama('/vendor/magazzino?tutte=1', a);
  check('Azienda: solo le proprie scorte', mie.stato === 200 && mie.corpo.righe.length > 0 && mie.corpo.righe.every((r) => r.azienda_id === a.azienda), `${mie.corpo.conteggio} righe di ${a.nome}`);
  check('Azienda: un solo deposito, il suo', mie.corpo.depositi?.length === 1 && mie.corpo.depositi[0].azienda_id === a.azienda);
  const finta = await chiama(`/vendor/magazzino?azienda=${b.azienda}&limit=200`, a);
  check('Il filtro azienda non apre le scorte altrui', finta.corpo.righe?.every((r) => r.azienda_id === a.azienda));
  const diTrailhead = await chiama('/vendor/magazzino?tutte=1', t);
  check('Trailhead vede solo le sue, non tutti i 244 articoli', diTrailhead.corpo.righe?.every((r) => r.azienda_id === t.azienda) && diTrailhead.corpo.conteggio < 244, `${diTrailhead.corpo.conteggio} righe`);
  check('Fingersi un\'altra azienda è respinto', negato(await chiama('/vendor/magazzino', { token: a.token, azienda: b.azienda })));
  check('Senza accesso non si legge nulla', negato(await chiama('/vendor/magazzino')) && negato(await chiama('/admin/magazzino')));
  check('Un\'azienda non usa le rotte amministratore', negato(await chiama('/admin/magazzino', a)));
  check('Azienda: nessun valore a costo', mie.corpo.vede_valore === false && mie.corpo.righe.every((r) => r.valore === null && r.costo_unitario === null));

  // Articolo di prova, senza scorte e senza deposito
  const creato = await chiama('/vendor/inventory-items', a, { corpo: { sku: skuProva, title: titoloProva } });
  articoloId = creato.corpo.inventory_item?.id;
  check('Articolo di prova creato', Boolean(articoloId), `HTTP ${creato.stato}`);
  depositoA = mie.corpo.depositi[0].id;
  const nuovo = await scorteProva();
  check('Articolo nuovo: compare a zero e risulta esaurito', nuovo?.giacenza === 0 && nuovo?.stato === 'esaurito' && nuovo?.deposito_id === depositoA, nuovo?.stato);
  check('Il nome dell\'articolo fa da prodotto', nuovo?.prodotto === titoloProva);
  check('Un\'altra azienda non lo vede', !rigaDi((await chiama(`/vendor/magazzino?q=${skuProva}`, b)).corpo));

  // Correzioni: la quantità cambia subito, senza revisione
  const url = `/vendor/magazzino/articoli/${articoloId}/correzione`;
  const correggi = (corpo, s = a) => chiama(url, s, { corpo: { deposito_id: depositoA, motivo: 'rifornimento', ...corpo } });
  // «New quantity» con la giacenza mostrata (prima): vale solo se è ancora quella.
  const prima = await correggi({ quantita: 20, prima: 0, nota: 'Prova: primo carico' });
  check('Correzione: nuova quantità', prima.stato === 200 && prima.corpo.dopo === 20, JSON.stringify(prima.corpo).slice(0, 90));
  check('La quantità si aggiorna subito', (await scorteProva())?.giacenza === 20);
  check('Si vede subito anche dall\'amministratore', (await scorteProva(admin, '/admin/magazzino'))?.giacenza === 20);
  const meno = await correggi({ variazione: -3, motivo: 'danneggiato' });
  check('Correzione: variazione', meno.corpo.prima === 20 && meno.corpo.dopo === 17);
  const sotto = await correggi({ variazione: -100 });
  check('Non si scende sotto zero', sotto.stato === 400, sotto.corpo?.message);
  const uguale = await correggi({ quantita: 17, prima: 17 });
  check('Quantità uguale rifiutata', uguale.stato === 400, uguale.corpo?.message);
  const vecchia = await correggi({ quantita: 30, prima: 20 });
  check('Quantità nuova partita da una giacenza vecchia: 412 con quella attuale', vecchia.stato === 412 && /now 17/.test(vecchia.corpo?.message ?? ''), vecchia.corpo?.message);
  const senzaPrima = await correggi({ quantita: 30 });
  check('Quantità nuova senza giacenza di partenza (console di prima): invito a ricaricare', senzaPrima.stato === 400 && /reload/i.test(senzaPrima.corpo?.message ?? ''), senzaPrima.corpo?.message);
  const doppia = await correggi({ quantita: 18, variazione: 1 });
  check('Quantità e variazione insieme rifiutate', doppia.stato === 400, doppia.corpo?.message);
  const negativa = await correggi({ quantita: -1 });
  check('Quantità negativa rifiutata', negativa.stato === 400, negativa.corpo?.message);
  const senzaMotivo = await chiama(url, a, { corpo: { deposito_id: depositoA, quantita: 5 } });
  check('Il motivo è obbligatorio, in italiano', senzaMotivo.stato === 400 && /reason/i.test(senzaMotivo.corpo?.message ?? ''), senzaMotivo.corpo?.message);

  // Isolamento delle scritture
  const altrui = mie.corpo.righe[0];
  const diB = (await chiama('/vendor/magazzino?limit=1', b)).corpo.righe[0];
  check('Un\'azienda non apre la scheda di un articolo altrui', negato(await chiama(`/vendor/magazzino/articoli/${diB.articolo_id}`, a)));
  const verso = await chiama(`/vendor/magazzino/articoli/${diB.articolo_id}/correzione`, a, { corpo: { deposito_id: diB.deposito_id, quantita: 1, motivo: 'rettifica' } });
  check('Un\'azienda non corregge scorte altrui', negato(verso), `HTTP ${verso.stato}`);
  const inCasaSua = await chiama(`/vendor/magazzino/articoli/${diB.articolo_id}/correzione`, a, { corpo: { deposito_id: depositoA, quantita: 1, motivo: 'rettifica' } });
  check('Né dichiarando il proprio deposito', negato(inCasaSua), `HTTP ${inCasaSua.stato}`);
  const daTrailhead = await chiama(`/vendor/magazzino/articoli/${altrui.articolo_id}/correzione`, t, { corpo: { deposito_id: altrui.deposito_id, quantita: 1, motivo: 'rettifica' } });
  check('Trailhead non corregge articoli di altri, anche se il legame li assegna a lei', negato(daTrailhead), `HTTP ${daTrailhead.stato}`);
  check('La quantità altrui resta uguale', (await chiama(`/admin/magazzino/articoli/${diB.articolo_id}`, admin)).corpo.livelli?.[0]?.giacenza === diB.giacenza);
  const sogliaAltrui = await chiama(`/vendor/magazzino/articoli/${diB.articolo_id}/soglia`, a, { corpo: { soglia: 1 } });
  check('Un\'azienda non cambia la soglia di articoli altrui', negato(sogliaAltrui), `HTTP ${sogliaAltrui.stato}`);

  // Conteggio
  const misto = await chiama('/vendor/magazzino/conteggio', a, {
    corpo: { righe: [{ articolo_id: articoloId, deposito_id: depositoA, contata: 99, prima: 17 }, { articolo_id: diB.articolo_id, deposito_id: diB.deposito_id, contata: 0, prima: diB.giacenza }] },
  });
  check('Conteggio con una riga altrui respinto', negato(misto), `HTTP ${misto.stato}`);
  check('Conteggio respinto: non cambia nulla', (await scorteProva())?.giacenza === 17);
  const riga = { articolo_id: articoloId, deposito_id: depositoA };
  check('Riga doppia nel conteggio rifiutata', (await chiama('/vendor/magazzino/conteggio', a, { corpo: { righe: [{ ...riga, contata: 1, prima: 17 }, { ...riga, contata: 2, prima: 17 }] } })).stato === 400);
  const contatoVecchio = await chiama('/vendor/magazzino/conteggio', a, { corpo: { righe: [{ ...riga, contata: 14, prima: 20 }] } });
  check('Conteggio partito da una giacenza vecchia: 412, nessuna scrittura', contatoVecchio.stato === 412 && (await scorteProva())?.giacenza === 17, contatoVecchio.corpo?.message);
  check('Conteggio vuoto rifiutato', (await chiama('/vendor/magazzino/conteggio', a, { corpo: { righe: [] } })).stato === 400);
  const contato = await chiama('/vendor/magazzino/conteggio', a, { corpo: { righe: [{ ...riga, contata: 15, prima: 17 }], nota: 'Prova: conteggio' } });
  check('Conteggio registrato', contato.stato === 200 && contato.corpo.cambiati === 1 && contato.corpo.differenza === -2, JSON.stringify(contato.corpo));
  const dopoConteggio = await scorteProva();
  check('Il conteggio aggiorna quantità e data', dopoConteggio?.giacenza === 15 && Boolean(dopoConteggio?.ultimo_conteggio));
  const invariato = await chiama('/vendor/magazzino/conteggio', a, { corpo: { righe: [{ ...riga, contata: 15, prima: 15 }] } });
  check('Conteggio senza differenze: nessuna variazione', invariato.corpo.cambiati === 0 && invariato.corpo.contati === 1);

  // Movimenti reali
  const storia = await chiama(`/vendor/magazzino/movimenti?q=${skuProva}`, a);
  check('Movimenti: uno per ogni variazione reale', storia.corpo.conteggio === 3, `${storia.corpo.conteggio} movimenti`);
  check('Movimenti: il più recente per primo', storia.corpo.movimenti?.[0]?.tipo === 'conteggio' && storia.corpo.movimenti[0].prima === 17 && storia.corpo.movimenti[0].dopo === 15);
  check('Movimenti: dicono chi e perché', storia.corpo.movimenti?.[2]?.chi === 'seller@mercur.dev' && storia.corpo.movimenti[2].motivo === 'rifornimento' && storia.corpo.movimenti[2].nota === 'Prova: primo carico');
  const perTipo = await chiama(`/vendor/magazzino/movimenti?q=${skuProva}&tipo=correzione`, a);
  check('Movimenti: filtro per tipo', perTipo.corpo.conteggio === 2);
  check('Movimenti: l\'amministratore li vede', (await chiama(`/admin/magazzino/movimenti?q=${skuProva}`, admin)).corpo.conteggio === 3);
  check('Movimenti: un\'altra azienda no', (await chiama(`/vendor/magazzino/movimenti?q=${skuProva}`, b)).corpo.conteggio === 0);
  const scheda = await chiama(`/vendor/magazzino/articoli/${articoloId}`, a);
  check('Scheda articolo con livelli e storico', scheda.stato === 200 && scheda.corpo.livelli?.length === 1 && scheda.corpo.movimenti?.length === 3);

  // Soglie: articolo, azienda, predefinita
  const basse = async (s, base) => (await chiama(`${base}/scorte-basse`, s)).corpo;
  check('Sopra la soglia predefinita: disponibile', (await scorteProva())?.stato === 'disponibile' && (await scorteProva())?.origine_soglia === 'predefinita');
  await correggi({ quantita: 4, prima: (await scorteProva())?.giacenza, motivo: 'rettifica' });
  const bassa = await scorteProva();
  check('A 4 unità: in esaurimento con la soglia predefinita', bassa?.stato === 'esaurimento' && bassa?.soglia === 5);
  const avvisi = await basse(admin, '/admin/magazzino');
  check('Avvisi: GET /admin/magazzino/scorte-basse', avvisi.scorte_basse?.some((r) => r.sku === skuProva) && avvisi.in_esaurimento >= 1, `${avvisi.conteggio} articoli`);
  check('Avvisi: filtro per azienda', (await chiama(`/admin/magazzino/scorte-basse?azienda=${b.azienda}`, admin)).corpo.scorte_basse?.every((r) => r.azienda_id === b.azienda));
  check('Avvisi: l\'azienda vede i suoi', (await basse(a, '/vendor/magazzino')).scorte_basse?.some((r) => r.sku === skuProva));
  check('Avvisi: le altre aziende no', !(await basse(b, '/vendor/magazzino')).scorte_basse?.some((r) => r.sku === skuProva));

  await correggi({ quantita: 8, prima: (await scorteProva())?.giacenza, motivo: 'rettifica' });
  const sogliaAzienda = await chiama('/vendor/magazzino/soglia', a, { corpo: { soglia: 10, azienda_id: b.azienda } });
  check('Soglia dell\'azienda salvata', sogliaAzienda.stato === 200 && sogliaAzienda.corpo.soglia === 10);
  const conAzienda = await scorteProva();
  check('La soglia dell\'azienda si applica', conAzienda?.stato === 'esaurimento' && conAzienda?.soglia === 10 && conAzienda?.origine_soglia === 'azienda');
  const diSoglie = (await chiama('/admin/magazzino/soglie', admin)).corpo.aziende ?? [];
  check('Soglia salvata solo sull\'azienda collegata', diSoglie.find((x) => x.id === a.azienda)?.soglia === 10 && diSoglie.find((x) => x.id === b.azienda)?.soglia !== 10);
  const sogliaArticolo = await chiama(`/vendor/magazzino/articoli/${articoloId}/soglia`, a, { corpo: { soglia: 3 } });
  check('Soglia dell\'articolo salvata', sogliaArticolo.stato === 200 && sogliaArticolo.corpo.soglia === 3);
  const conArticolo = await scorteProva();
  check('La soglia dell\'articolo vince su quella dell\'azienda', conArticolo?.stato === 'disponibile' && conArticolo?.soglia === 3 && conArticolo?.origine_soglia === 'articolo');
  check('Riepilogo soglie: articoli personalizzati', (await chiama('/vendor/magazzino/soglia', a)).corpo.articoli?.some((r) => r.sku === skuProva));
  check('Soglia negativa rifiutata', (await chiama(`/vendor/magazzino/articoli/${articoloId}/soglia`, a, { corpo: { soglia: -1 } })).stato === 400);
  const daAdmin = await chiama(`/admin/magazzino/articoli/${articoloId}/soglia`, admin, { corpo: { soglia: null } });
  check('L\'amministratore toglie la soglia dell\'articolo', daAdmin.stato === 200 && (await scorteProva())?.origine_soglia === 'azienda');
  const sogliaDaAdmin = await chiama('/admin/magazzino/soglie', admin, { corpo: { azienda_id: a.azienda, soglia: null } });
  check('L\'amministratore toglie la soglia dell\'azienda', sogliaDaAdmin.stato === 200 && (await scorteProva())?.origine_soglia === 'predefinita');
  check('Azienda inesistente rifiutata', negato(await chiama('/admin/magazzino/soglie', admin, { corpo: { azienda_id: 'sel_inesistente', soglia: 1 } })));

  // Riserve
  const riserva = await chiama('/admin/magazzino/riserve', admin, { corpo: { articolo_id: articoloId, deposito_id: depositoA, quantita: 3, descrizione: 'Prova: riserva' } });
  check('Riserva creata', riserva.stato === 201 && Boolean(riserva.corpo.id), `HTTP ${riserva.stato}`);
  const riservata = await scorteProva();
  check('La riserva riduce le disponibili', riservata?.riservate === 3 && riservata?.disponibili === 5 && riservata?.giacenza === 8);
  const troppe = await chiama('/admin/magazzino/riserve', admin, { corpo: { articolo_id: articoloId, deposito_id: depositoA, quantita: 6 } });
  check('Riserva oltre il disponibile rifiutata', troppe.stato === 400, troppe.corpo?.message);
  check('L\'azienda vede la riserva sulla sua merce', (await chiama(`/vendor/magazzino/riserve?q=${skuProva}`, a)).corpo.riserve?.[0]?.quantita === 3);
  check('Le altre aziende no', (await chiama(`/vendor/magazzino/riserve?q=${skuProva}`, b)).corpo.conteggio === 0);
  check('L\'amministratore la vede', (await chiama(`/admin/magazzino/riserve?q=${skuProva}`, admin)).corpo.riserve?.[0]?.origine === 'manuale');
  check('Riserve in scheda articolo', (await chiama(`/vendor/magazzino/articoli/${articoloId}`, a)).corpo.riserve?.length === 1);
  check('Un\'azienda non crea riserve da qui', negato(await chiama('/admin/magazzino/riserve', a, { corpo: { articolo_id: articoloId, deposito_id: depositoA, quantita: 1 } })));
  const tolta = await chiama(`/admin/magazzino/riserve/${riserva.corpo.id}`, admin, { metodo: 'DELETE' });
  check('Riserva tolta', tolta.stato === 200 && tolta.corpo.eliminata === true);
  check('Le unità tornano disponibili', (await scorteProva())?.disponibili === 8);
  check('Riserva inesistente: non trovata', negato(await chiama('/admin/magazzino/riserve/res_inesistente', admin, { metodo: 'DELETE' })));

  // Valore a costo: solo con il permesso e solo se il costo esiste
  const senzaCosto = await chiama(`/admin/magazzino?q=${skuProva}`, admin);
  check('Senza costo il valore non si inventa', rigaDi(senzaCosto.corpo)?.valore === null && senzaCosto.corpo.riepilogo.valore === null && senzaCosto.corpo.riepilogo.senza_costo === 1);
  const costo = await chiama(`/vendor/inventory-items/${articoloId}`, a, { corpo: { metadata: { prezzo_cessione: 12.5 } } });
  check('Prezzo di cessione inserito sull\'articolo di prova', costo.stato === 200, `HTTP ${costo.stato}`);
  const conCosto = await chiama(`/admin/magazzino?q=${skuProva}`, admin);
  check('Con il permesso margini: valore a costo', rigaDi(conCosto.corpo)?.valore === 100 && conCosto.corpo.riepilogo.valore === 100 && conCosto.corpo.vede_valore === true, `${rigaDi(conCosto.corpo)?.valore} euro`);
  check('L\'azienda non vede il costo nemmeno se c\'è', (await scorteProva())?.valore === null && (await scorteProva())?.costo_unitario === null);

  // Ruoli dei collaboratori: limiti sul server
  const operatore = await collaboratore('ordini');
  const catalogo = await collaboratore('catalogo');
  const lettura = await collaboratore('lettura');
  const marketing = await collaboratore('marketing');
  const daOperatore = await chiama(`/admin/magazzino?q=${skuProva}`, operatore.sessione);
  check('Senza margini il valore non esce dal server', daOperatore.stato === 200 && daOperatore.corpo.vede_valore === false && rigaDi(daOperatore.corpo)?.valore === null && rigaDi(daOperatore.corpo)?.costo_unitario === null && daOperatore.corpo.riepilogo.valore === null);
  check('Senza margini il valore non esce nemmeno dagli avvisi', (await chiama('/admin/magazzino/scorte-basse', operatore.sessione)).corpo.scorte_basse?.every((r) => r.valore === null));
  const daCatalogo = await chiama(`/admin/magazzino?q=${skuProva}`, catalogo.sessione);
  check('Con margini il ruolo Catalogo vede il valore', rigaDi(daCatalogo.corpo)?.valore === 100);
  const dallaLettura = await chiama('/admin/magazzino?limit=1', lettura.sessione);
  check('Sola lettura vede le scorte', dallaLettura.stato === 200, `HTTP ${dallaLettura.stato} ${dallaLettura.stato === 200 ? '' : JSON.stringify(dallaLettura.corpo).slice(0, 120)}`);
  check('Sola lettura non cambia le soglie', negato(await chiama('/admin/magazzino/soglie', lettura.sessione, { corpo: { azienda_id: a.azienda, soglia: 1 } })));
  check('Catalogo non cambia le soglie degli articoli', negato(await chiama(`/admin/magazzino/articoli/${articoloId}/soglia`, catalogo.sessione, { corpo: { soglia: 1 } })));
  check('Sola lettura non crea riserve', negato(await chiama('/admin/magazzino/riserve', lettura.sessione, { corpo: { articolo_id: articoloId, deposito_id: depositoA, quantita: 1 } })));
  check('L\'operatore ordini cambia le soglie', (await chiama(`/admin/magazzino/articoli/${articoloId}/soglia`, operatore.sessione, { corpo: { soglia: null } })).stato === 200);
  check('Marketing non entra nel magazzino', negato(await chiama('/admin/magazzino', marketing.sessione)));
  check('Marketing non legge gli avvisi di scorta', negato(await chiama('/admin/magazzino/scorte-basse', marketing.sessione)));

  // Ruoli delle aziende: il permesso vale anche sulle rotte /vendor, non solo sul pannello
  const contabile = await membro(a, 'Contabilità');
  const magazziniere = await membro(a, 'Magazziniere');
  check('Membri di prova nell\'azienda giusta', contabile.sessione.azienda === a.azienda && magazziniere.sessione.azienda === a.azienda);
  const permessiContabile = (await chiama('/vendor/permessi/me', contabile.sessione)).corpo.permessi ?? {};
  check('La contabilità aziendale non ha il permesso magazzino', !permessiContabile.magazzino, JSON.stringify(Object.keys(permessiContabile)).slice(0, 80));
  const lettoDaContabile = await chiama('/vendor/magazzino', contabile.sessione);
  check('Contabilità aziendale respinta: scorte', negato(lettoDaContabile), `HTTP ${lettoDaContabile.stato}`);
  check('Contabilità aziendale respinta: avvisi', negato(await chiama('/vendor/magazzino/scorte-basse', contabile.sessione)));
  check('Contabilità aziendale respinta: movimenti e riserve', negato(await chiama('/vendor/magazzino/movimenti', contabile.sessione)) && negato(await chiama('/vendor/magazzino/riserve', contabile.sessione)));
  const scrittoDaContabile = await correggi({ quantita: 9, motivo: 'rettifica' }, contabile.sessione);
  check('Contabilità aziendale respinta: correzione', negato(scrittoDaContabile), `HTTP ${scrittoDaContabile.stato}`);
  check('Contabilità aziendale respinta: conteggio', negato(await chiama('/vendor/magazzino/conteggio', contabile.sessione, { corpo: { righe: [{ ...riga, contata: 9 }] } })));
  check('Contabilità aziendale respinta: soglia', negato(await chiama('/vendor/magazzino/soglia', contabile.sessione, { corpo: { soglia: 1 } })));
  check('La quantità resta quella di prima', (await scorteProva())?.giacenza === 8);
  check('Il magazziniere legge le scorte della sua azienda', (await chiama('/vendor/magazzino?limit=1', magazziniere.sessione)).corpo.righe?.every((r) => r.azienda_id === a.azienda));
  const corretto = await correggi({ quantita: 9, prima: (await scorteProva())?.giacenza, motivo: 'rettifica' }, magazziniere.sessione);
  check('Il magazziniere corregge le quantità', corretto.stato === 200 && corretto.corpo.dopo === 9, `HTTP ${corretto.stato}`);
  const ultimo = (await chiama(`/vendor/magazzino/movimenti?q=${skuProva}`, a)).corpo.movimenti?.[0];
  check('Il movimento dice quale membro l\'ha fatto', ultimo?.chi === magazziniere.email, ultimo?.chi);

  // Interfaccia reale nel browser
  const { browser, nuovaPagina, errori } = await apriBrowser();
  aperto = browser;

  const scuro = await nuovaPagina();
  await accediAdminBrowser(scuro);
  await scuro.goto(`${CONSOLE}/magazzino`);
  await scuro.locator('h1', { hasText: 'Products' }).waitFor();
  await scuro.locator('.tabella tbody tr').first().waitFor();
  check('Browser: /magazzino apre le scorte', scuro.url().endsWith('/magazzino/scorte'));
  check('Browser: righe vere nella tabella', (await scuro.locator('.tabella tbody tr').count()) === 25);
  const schedeProdotti = scuro.getByRole('navigation', { name: 'Product sections' });
  const nomiSchede = (await schedeProdotti.getByRole('link').allInnerTexts()).map((t) => t.replace(/\s*\d+$/, '').trim());
  check('Browser: schede Catalogue, Inventory, Collections', nomiSchede.join() === 'Catalogue,Inventory,Collections', nomiSchede.join());
  check('Browser: Inventory è la scheda attiva di Products', (await schedeProdotti.getByRole('link', { name: /Inventory/ }).getAttribute('aria-current')) === 'page');
  check('Browser: Collections porta alla pagina giusta', (await schedeProdotti.getByRole('link', { name: 'Collections' }).getAttribute('href')) === '/prodotti/collezioni');
  const quote = await scuro.locator('.mag-barra select').evaluateAll((filtri) => filtri.map((f) => Math.round(f.getBoundingClientRect().top)));
  check('Browser: i filtri stanno sulla stessa riga', quote.length === 2 && new Set(quote).size === 1, quote.join(', '));
  await scuro.getByLabel('Company', { exact: true }).selectOption({ label: b.nome });
  await scuro.locator('.tabella tbody tr').first().getByText(b.nome, { exact: true }).waitFor();
  check('Browser: filtro per azienda', (await scuro.locator('.tabella tbody tr').first().innerText()).includes(b.nome));
  await scuro.getByLabel('Company', { exact: true }).selectOption({ label: 'All companies' });
  await scuro.getByRole('searchbox', { name: 'Search by SKU or product' }).fill(skuProva);
  await scuro.locator('.tabella tbody tr').filter({ hasText: skuProva }).waitFor();
  check('Browser: ricerca per SKU', (await scuro.locator('.tabella tbody tr').count()) === 1);
  await scuro.getByRole('button', { name: 'Out of stock', exact: true }).click();
  await scuro.getByText('No items found').waitFor();
  check('Browser: pillole di stato', (await scuro.locator('.tabella tbody tr').count()) === 0);
  await scuro.getByRole('button', { name: 'Everything', exact: true }).click();
  await scuro.locator('.tabella tbody tr').filter({ hasText: skuProva }).waitFor();
  check('Browser: valore a costo per il proprietario', (await scuro.getByText('Stock value at cost').count()) > 0 && (await scuro.locator('body').innerText()).includes('112.50'));
  await scuro.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'magazzino-admin-scuro.png'), fullPage: true });
  const scarico = scuro.waitForEvent('download');
  await scuro.getByRole('button', { name: 'Export CSV' }).click();
  check('Browser: esportazione CSV', (await (await scarico).suggestedFilename()).endsWith('.csv'));

  const chiaro = await nuovaPagina({ colorScheme: 'light' });
  await accediAdminBrowser(chiaro);
  await chiaro.goto(`${CONSOLE}/magazzino/soglie`);
  await chiaro.getByRole('heading', { name: 'Default safety stock', exact: false }).first().waitFor();
  await chiaro.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'magazzino-soglie-chiaro.png'), fullPage: true });
  check('Browser: tema chiaro senza colori fissi', await chiaro.evaluate(() => document.documentElement.dataset.tema === 'chiaro'));
  await chiaro.getByLabel(`Safety stock for ${a.nome}`).fill('11');
  await chiaro.getByRole('row', { name: new RegExp(a.nome) }).getByRole('button', { name: 'Save' }).click();
  await chiaro.getByText(`Safety stock for ${a.nome} updated`).waitFor();
  check('Browser: soglia dell\'azienda salvata dalla pagina', (await scorteProva())?.origine_soglia === 'azienda' && (await scorteProva())?.soglia === 11);
  await chiaro.getByLabel(`Safety stock for ${a.nome}`).fill('');
  await chiaro.getByRole('row', { name: new RegExp(a.nome) }).getByRole('button', { name: 'Save' }).click();
  await chiaro.waitForFunction(() => document.querySelectorAll('.avvisi p').length >= 2);

  await scuro.goto(`${CONSOLE}/magazzino/scorte/${articoloId}`);
  await scuro.getByRole('button', { name: 'Set aside' }).click();
  const moduloRiserva = scuro.getByRole('dialog', { name: 'Set aside' });
  await moduloRiserva.getByLabel('Quantity').fill('2');
  await moduloRiserva.getByLabel('Description').fill('Prova: dal browser');
  await moduloRiserva.getByRole('button', { name: 'Save reservation' }).click();
  await scuro.getByRole('cell', { name: 'Prova: dal browser' }).waitFor();
  check('Browser: riserva creata dalla scheda', (await scorteProva())?.riservate === 2);
  await scuro.goto(`${CONSOLE}/magazzino/riserve`);
  await scuro.locator('.tabella tbody tr').filter({ hasText: skuProva }).waitFor();
  await scuro.getByRole('button', { name: 'Release', exact: true }).click();
  await scuro.getByRole('button', { name: 'Yes, release' }).click();
  await scuro.getByText('Reservation released').first().waitFor();
  check('Browser: riserva tolta con conferma', (await scorteProva())?.riservate === 0);

  const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
  await accediAdminBrowser(telefono);
  await telefono.goto(`${CONSOLE}/magazzino/scorte`);
  await telefono.locator('.tabella tbody tr').first().waitFor();
  await telefono.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'magazzino-telefono.png'), fullPage: true });
  const campiTelefono = await telefono.locator('.tabella tbody tr').first().locator('td:visible').count();
  check('Browser: su telefono ogni riga mostra l\'essenziale', campiTelefono <= 6, `${campiTelefono} campi`);
  check('Browser: telefono senza scorrimento laterale', await telefono.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  const azienda = await nuovaPagina();
  await entraComeAzienda(azienda, 'seller@mercur.dev');
  await azienda.goto(`${CONSOLE}/magazzino/scorte`);
  await azienda.locator('.tabella tbody tr').first().waitFor();
  check('Browser: l\'azienda non ha il filtro aziende', (await azienda.getByLabel('Company', { exact: true }).count()) === 0);
  check('Browser: l\'azienda non vede le schede di Products', (await azienda.getByRole('navigation', { name: 'Product sections' }).count()) === 0);
  check('Browser: per l\'azienda la pagina si chiama Inventory', (await azienda.locator('h1').innerText()) === 'Inventory');
  check('Browser: l\'azienda non vede il valore a costo', (await azienda.getByText('Stock value at cost').count()) === 0);
  await azienda.goto(`${CONSOLE}/magazzino/scorte/${articoloId}`);
  await azienda.getByRole('button', { name: 'Adjust quantity' }).click();
  await azienda.getByLabel('New quantity').fill('30');
  await azienda.getByLabel('Reason').selectOption({ label: 'Restock' });
  await azienda.getByRole('button', { name: 'Save adjustment' }).click();
  await azienda.getByRole('cell', { name: '30', exact: true }).first().waitFor();
  check('Browser: correzione reale dal modulo', (await scorteProva())?.giacenza === 30);
  await azienda.getByRole('button', { name: 'Change safety stock' }).click();
  await azienda.getByRole('dialog', { name: 'Safety stock for this item' }).getByLabel('Safety stock').fill('7');
  await azienda.getByRole('button', { name: 'Save safety stock' }).click();
  await azienda.getByText('Safety stock updated').waitFor();
  check('Browser: soglia dell\'articolo salvata dalla scheda', (await scorteProva())?.origine_soglia === 'articolo' && (await scorteProva())?.soglia === 7);
  await azienda.goto(`${CONSOLE}/magazzino/conteggio`);
  await azienda.getByRole('searchbox', { name: 'Search by SKU or product' }).fill(skuProva);
  await azienda.locator('.tabella tbody tr').filter({ hasText: skuProva }).waitFor();
  await azienda.getByLabel(`Counted quantity for ${skuProva}`).fill('28');
  await azienda.getByRole('button', { name: 'Record count' }).click();
  await azienda.getByRole('button', { name: 'Confirm count' }).click();
  await azienda.getByText('Stock count recorded').waitFor();
  check('Browser: conteggio reale dalla pagina', (await scorteProva())?.giacenza === 28);
  await azienda.goto(`${CONSOLE}/magazzino/movimenti`);
  await azienda.locator('.tabella tbody tr').filter({ hasText: skuProva }).first().waitFor();
  check('Browser: movimenti visibili', true);
  await azienda.screenshot({ path: path.join(CARTELLA_SCREENSHOT, 'magazzino-azienda-movimenti.png'), fullPage: true });
  const testo = await azienda.locator('main').innerText();
  check('Browser: nessuna parola italiana a schermo', !/\b(giacenza|deposito|azienda|scorte|quantità|disponibili|riservate|esaurito|conteggio|soglia|movimenti|correzione)\b/i.test(testo));
  check('Browser: nessun errore in console', errori.length === 0, errori.slice(0, 2).join(' | '));
} finally {
  await aperto?.close();
  if (articoloId) {
    const via = await chiama(`/vendor/inventory-items/${articoloId}`, a, { metodo: 'DELETE' });
    check('Articolo di prova cancellato', via.stato === 200 && !rigaDi((await chiama(`/admin/magazzino?q=${skuProva}`, admin)).corpo), `HTTP ${via.stato}`);
  }
  await chiama('/admin/magazzino/soglie', admin, { corpo: { azienda_id: a.azienda, soglia: null } });
  const persone = (await chiama(`/vendor/sellers/${a.azienda}/members?limit=100`, a)).corpo.seller_members ?? [];
  for (const { email } of membri) {
    const voce = persone.find((m) => m.member?.email === email);
    if (voce) {
      const via = await chiama(`/vendor/sellers/${a.azienda}/members/${voce.id}`, a, { metodo: 'DELETE' });
      check(`Membro di prova tolto dall'azienda`, via.stato === 200, `HTTP ${via.stato}`);
    }
  }
  const { collaboratori: squadra = [], inviti = [] } = (await chiama('/admin/team', admin)).corpo;
  for (const { email } of collaboratori) {
    const persona = squadra.find((c) => c.email === email)?.id;
    if (persona) await chiama(`/admin/team/${persona}`, admin, { metodo: 'DELETE' });
    const invito = inviti.find((i) => i.email === email)?.id;
    if (invito) await chiama(`/admin/team/inviti/${invito}`, admin, { metodo: 'DELETE' });
  }
}

const registro = (await chiama('/admin/registro', admin)).corpo.voci?.map((v) => v.azione) ?? [];
for (const attesa of ['Stock quantity adjusted', 'Stock count recorded', 'Company safety stock changed', 'Reservation created', 'Reservation released']) {
  check(`Registro: ${attesa}`, registro.includes(attesa));
}

chiudi('magazzino funzionante e isolato per azienda');
