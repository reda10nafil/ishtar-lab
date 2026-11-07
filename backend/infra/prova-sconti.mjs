// Prova di Sconti: codici su promotions, carte regalo, proposte delle aziende, permessi e passaggio nel browser.
// Uso: node infra/prova-sconti.mjs [--solo-api]. I dati creati iniziano con «Prova» e si cancellano alla fine.
import crypto from 'node:crypto';
import { accediAdmin, accediAzienda, attendiBackend, chiama as chiamaBase, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';

const { check, chiudi } = nuovaProva();
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
const GIORNO = 86_400_000;
const tra = (giorni) => new Date(stamp + giorni * GIORNO).toISOString();

await attendiBackend();
const admin = await accediAdmin();
const aziendaA = await accediAzienda('seller@mercur.dev');
const aziendaB = await accediAzienda('kickz@mercur.dev');

const daPulire = { codici: [], carte: [], proposte: [], persone: [], membri: [], bozze: [], clienti: [] };

const collaboratore = async (ruolo) => {
  const email = `prova-sconti-${ruolo}-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const token = tokenDaEmail(await emailPer(email))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: 'Sconti' } });
  daPulire.persone.push(email);
  return accediAdmin(email, password);
};

const magazziniere = async () => {
  const email = `prova-sconti-magazzino-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  await chiama(`/vendor/sellers/${aziendaA.azienda}/members`, aziendaA, { corpo: { email, role_id: 'role_seller_inventory_management' } });
  const token = tokenDaEmail(await emailPer(email))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/member/emailpass/register', null, { corpo: { email, password } });
  await chiama('/vendor/members/invites/accept', { token: iscritto.corpo?.token }, { corpo: { invite_token: token, first_name: 'Prova', last_name: 'Magazzino' } });
  daPulire.membri.push(email);
  return accediAzienda(email, password);
};

const creaCodice = async (dati) => {
  const r = await chiama('/admin/sconti/codici', admin, { corpo: dati });
  if (r.corpo?.codice?.id) daPulire.codici.push(r.corpo.codice.id);
  return r;
};
const promozione = async (id) => {
  const r = await chiama(`/admin/promotions/${id}?fields=id,code,status,limit,*campaign,*application_method,*application_method.target_rules,*application_method.target_rules.values`, admin);
  return r.corpo?.promotion;
};

// CODICI
const codPct = `PROVA-P-${stamp}`;
const pct = await creaCodice({ codice: codPct.toLowerCase(), descrizione: 'Prova percentuale', tipo: 'percentuale', valore: 15, limite_usi: 10, attivo: true });
check('Sconto percentuale creato e attivo', pct.stato === 201 && pct.corpo.codice?.stato === 'attivo' && pct.corpo.codice?.codice === codPct, `${pct.stato} ${pct.corpo?.message ?? ''}`);
const pctReale = await promozione(pct.corpo.codice?.id);
check('È una promozione vera di Medusa', pctReale?.code === codPct && pctReale?.status === 'active' && pctReale?.application_method?.type === 'percentage' && Number(pctReale?.application_method?.value) === 15 && pctReale?.limit === 10);

const fix = await creaCodice({ codice: `PROVA-F-${stamp}`, descrizione: 'Prova importo', tipo: 'importo', valore: 10, inizio: tra(2), fine: tra(30), attivo: true });
check('Sconto a importo con date future: programmato', fix.stato === 201 && fix.corpo.codice?.stato === 'programmato', fix.corpo?.message);
const fixReale = await promozione(fix.corpo.codice?.id);
check('Le date stanno sulla campagna, importo in euro', fixReale?.application_method?.type === 'fixed' && fixReale?.application_method?.currency_code === 'eur' && Boolean(fixReale?.campaign?.ends_at));

const ship = await creaCodice({ codice: `PROVA-S-${stamp}`, tipo: 'spedizione', attivo: false });
const shipReale = await promozione(ship.corpo.codice?.id);
check('Spedizione gratuita creata in pausa', ship.corpo.codice?.tipo === 'spedizione' && ship.corpo.codice?.stato === 'in_pausa' && shipReale?.status === 'inactive');
check('La spedizione gratuita è il 100% sulle spese di spedizione', shipReale?.application_method?.target_type === 'shipping_methods' && Number(shipReale?.application_method?.value) === 100);

const invalidi = [
  ['Percentuale oltre 100', { codice: `PROVA-X-${stamp}`, tipo: 'percentuale', valore: 150 }],
  ['Valore mancante', { codice: `PROVA-X-${stamp}`, tipo: 'importo' }],
  ['Fine prima dell\'inizio', { codice: `PROVA-X-${stamp}`, tipo: 'percentuale', valore: 10, inizio: tra(5), fine: tra(1) }],
  ['Codice con spazi', { codice: 'PROVA CON SPAZI', tipo: 'percentuale', valore: 10 }],
  ['Codice già usato', { codice: codPct, tipo: 'percentuale', valore: 10 }],
  ['Limite d\'uso zero', { codice: `PROVA-X-${stamp}`, tipo: 'percentuale', valore: 10, limite_usi: 0 }],
];
for (const [nome, corpo] of invalidi) {
  const r = await creaCodice(corpo);
  check(`Rifiutato: ${nome}`, r.stato === 400 && /[a-z]+ [a-z]+/i.test(r.corpo?.message ?? '') && !/promotion|invalid|required|\b(il|la|non|deve|sconto|codice|esiste)\b/i.test(r.corpo?.message ?? ''), r.corpo?.message);
}

const cerca = await chiama(`/admin/sconti/codici?q=${encodeURIComponent(codPct.toLowerCase())}`, admin);
check('Ricerca per codice', cerca.corpo.codici?.length === 1 && cerca.corpo.codici[0].id === pct.corpo.codice?.id);
const soloPausa = await chiama(`/admin/sconti/codici?q=prova-&stato=in_pausa`, admin);
check('Filtro per stato', soloPausa.corpo.codici?.every((c) => c.stato === 'in_pausa') && soloPausa.corpo.codici?.some((c) => c.id === ship.corpo.codice?.id));
const soloTipo = await chiama(`/admin/sconti/codici?q=prova-&tipo=importo`, admin);
check('Filtro per tipo', soloTipo.corpo.codici?.every((c) => c.tipo === 'importo') && soloTipo.corpo.codici?.some((c) => c.id === fix.corpo.codice?.id));
check('Conteggi per stato', (cerca.corpo.conteggi?.attivo ?? 0) === 1 && cerca.corpo.conteggi?.tutti === 1);

const idPct = pct.corpo.codice?.id;
const modifica = await chiama(`/admin/sconti/codici/${idPct}`, admin, { corpo: { codice: codPct, descrizione: 'Prova modificata', tipo: 'percentuale', valore: 20, limite_usi: 5, inizio: tra(-1), fine: tra(10) } });
const modificaReale = await promozione(idPct);
check('Modifica di valore, limite e date', modifica.stato === 200 && modifica.corpo.codice?.valore === 20 && modifica.corpo.codice?.limite_usi === 5 && Number(modificaReale?.application_method?.value) === 20 && Boolean(modificaReale?.campaign?.ends_at), modifica.corpo?.message);
const cambioTipo = await chiama(`/admin/sconti/codici/${idPct}`, admin, { corpo: { codice: codPct, tipo: 'importo', valore: 7, limite_usi: 5, inizio: tra(-1), fine: tra(10) } });
check('Cambio da percentuale a importo', cambioTipo.corpo.codice?.tipo === 'importo' && cambioTipo.corpo.codice?.valore === 7, cambioTipo.corpo?.message);
const ritorno = await chiama(`/admin/sconti/codici/${idPct}`, admin, { corpo: { codice: codPct, tipo: 'percentuale', valore: 20, limite_usi: 5, inizio: tra(-1), fine: tra(10) } });
check('Ritorno da importo a percentuale', ritorno.corpo.codice?.tipo === 'percentuale', ritorno.corpo?.message);

const pausa = await chiama(`/admin/sconti/codici/${idPct}/stato`, admin, { corpo: { attivo: false } });
check('Messa in pausa', pausa.corpo.codice?.stato === 'in_pausa' && (await promozione(idPct))?.status === 'inactive');

// Il codice agisce davvero sul totale di un ordine: una bozza da 100 euro, modificata come fa il pannello.
const regione = (await chiama('/admin/regions?limit=1', admin)).corpo.regions?.[0]?.id;
const bozza = await chiama('/admin/draft-orders', admin, { corpo: { region_id: regione, email: `prova-sconti-${stamp}@multioutfit.test`, items: [{ title: 'Prova articolo', quantity: 1, unit_price: 100 }] } });
const idBozza = bozza.corpo.draft_order?.id;
if (idBozza) daPulire.bozze.push(idBozza);
await chiama(`/admin/draft-orders/${idBozza}/edit`, admin, { corpo: {} });
const conCodice = () => chiama(`/admin/draft-orders/${idBozza}/edit/promotions`, admin, { corpo: { promo_codes: [codPct] } });
const inPausa = await conCodice();
check('In pausa il codice viene respinto da Medusa', inPausa.stato === 400 && /not active/.test(inPausa.corpo?.message ?? ''), inPausa.corpo?.message);
await chiama(`/admin/sconti/codici/${idPct}/stato`, admin, { corpo: { attivo: true } });
const attivo = await conCodice();
const anteprima = attivo.corpo.draft_order_preview;
check('Attivo, il codice porta 100 euro a 80', attivo.stato === 200 && anteprima?.discount_total === 20 && anteprima?.total === 80, `totale ${anteprima?.total}, sconto ${anteprima?.discount_total}`);
await chiama(`/admin/draft-orders/${idBozza}/edit`, admin, { metodo: 'DELETE' });

const scaduto = await chiama(`/admin/sconti/codici/${idPct}`, admin, { corpo: { codice: codPct, tipo: 'percentuale', valore: 20, limite_usi: 5, inizio: tra(-3), fine: tra(-1) } });
check('Con la fine passata è terminato', scaduto.corpo.codice?.stato === 'terminato', scaduto.corpo.codice?.stato);
const riattiva = await chiama(`/admin/sconti/codici/${idPct}/stato`, admin, { corpo: { attivo: true } });
check('Uno sconto terminato non si riattiva senza cambiare date', riattiva.stato === 400, riattiva.corpo?.message);

const copia = await chiama(`/admin/sconti/codici/${fix.corpo.codice?.id}/duplica`, admin, { corpo: {} });
if (copia.corpo.codice?.id) daPulire.codici.push(copia.corpo.codice.id);
check('Duplicazione: copia in pausa con gli stessi dati', copia.stato === 201 && copia.corpo.codice?.stato === 'in_pausa' && copia.corpo.codice?.codice === `PROVA-F-${stamp}-COPY` && copia.corpo.codice?.valore === 10 && copia.corpo.codice?.usi === 0, copia.corpo?.message);
const copia2 = await chiama(`/admin/sconti/codici/${fix.corpo.codice?.id}/duplica`, admin, { corpo: {} });
if (copia2.corpo.codice?.id) daPulire.codici.push(copia2.corpo.codice.id);
check('La seconda copia ha un codice diverso', copia2.corpo.codice?.codice === `PROVA-F-${stamp}-COPY2`, copia2.corpo.codice?.codice);

const campagnaPrima = (await promozione(copia.corpo.codice?.id))?.campaign?.id;
const elimina = await chiama(`/admin/sconti/codici/${copia.corpo.codice?.id}`, admin, { metodo: 'DELETE' });
check('Eliminazione del codice', elimina.stato === 200 && (await chiama(`/admin/sconti/codici/${copia.corpo.codice?.id}`, admin)).stato === 404);
check('Con il codice se ne va anche la sua campagna', (await chiama(`/admin/campaigns/${campagnaPrima}`, admin)).stato === 404);

// PROPOSTE
const prodottiA = (await chiama('/vendor/sconti/prodotti', aziendaA)).corpo.prodotti ?? [];
const prodottiB = (await chiama('/vendor/sconti/prodotti', aziendaB)).corpo.prodotti ?? [];
const propria = prodottiA.find((p) => !prodottiB.some((q) => q.id === p.id));
const altrui = prodottiB.find((p) => !prodottiA.some((q) => q.id === p.id));
check('Le due aziende hanno prodotti diversi', Boolean(propria && altrui));
check('I prodotti proponibili non portano prezzi', prodottiA.length > 0 && !/price|prezzo|amount/i.test(JSON.stringify(prodottiA)));

const quantePromo = async () => (await chiama('/admin/promotions?limit=1', admin)).corpo.count;
const promoPrima = await quantePromo();
const proposta = (dati = {}) => ({ titolo: `Prova proposta ${stamp}`, tipo: 'percentuale', valore: 12, inizio: tra(3), fine: tra(20), motivo: 'Prova: svuotare la stagione', prodotti: [propria.id], ...dati });
const proponi = async (sessione, dati) => {
  const r = await chiama('/vendor/sconti/proposte', sessione, { corpo: proposta(dati) });
  if (r.corpo?.proposta?.id) daPulire.proposte.push(r.corpo.proposta.id);
  return r;
};

const prima = await proponi(aziendaA);
check("L'azienda propone: in attesa", prima.stato === 201 && prima.corpo.proposta?.stato === 'in_attesa', prima.corpo?.message);
check('Nessuno sconto parte prima dell\'approvazione', (await quantePromo()) === promoPrima && prima.corpo.proposta?.codice === null);
for (const [nome, dati] of [
  ['senza motivo', { motivo: undefined }],
  ['con date invertite', { inizio: tra(9), fine: tra(2) }],
  ['con date passate', { inizio: tra(-9), fine: tra(-2) }],
  ['oltre il 100%', { valore: 150 }],
]) {
  const r = await proponi(aziendaA, dati);
  check(`Proposta rifiutata ${nome}`, r.stato === 400, r.corpo?.message);
}
const suAltrui = await proponi(aziendaA, { prodotti: [altrui.id] });
check("Sui prodotti di un'altra azienda: rifiutata", suAltrui.stato === 400 && /your own products/.test(suAltrui.corpo?.message ?? ''), suAltrui.corpo?.message);

const elencoA = await chiama('/vendor/sconti/proposte', aziendaA);
const elencoB = await chiama('/vendor/sconti/proposte', aziendaB);
check("L'azienda vede la sua proposta", elencoA.corpo.proposte?.some((p) => p.id === prima.corpo.proposta?.id));
check("L'altra azienda non la vede", elencoB.stato === 200 && !elencoB.corpo.proposte?.some((p) => p.id === prima.corpo.proposta?.id));
check("L'altra azienda non può ritirarla", negato(await chiama(`/vendor/sconti/proposte/${prima.corpo.proposta?.id}`, aziendaB, { metodo: 'DELETE' })));
check('Nessun prezzo di vendita nelle risposte alle aziende', !/price|prezzo|amount/i.test(JSON.stringify(elencoA.corpo)));
for (const [percorso, nome] of [['/admin/sconti/codici', 'codici'], ['/admin/sconti/proposte', 'proposte di tutti'], ['/admin/carte-regalo', 'carte regalo'], ['/admin/promotions', 'promozioni admin'], ['/vendor/promotions', 'promozioni vendor']]) {
  check(`L'azienda non legge ${nome}`, negato(await chiama(percorso, aziendaA)));
}

const elencoAdmin = await chiama('/admin/sconti/proposte?stato=in_attesa', admin);
const vistaAdmin = elencoAdmin.corpo.proposte?.find((p) => p.id === prima.corpo.proposta?.id);
check("L'amministratore la vede con il nome dell'azienda", vistaAdmin?.azienda === aziendaA.nome && elencoAdmin.corpo.in_attesa >= 1, vistaAdmin?.azienda);

const codAppr = `PROVA-A-${stamp}`;
const approva = await chiama(`/admin/sconti/proposte/${prima.corpo.proposta?.id}/approva`, admin, { corpo: { codice: codAppr, nota: 'Prova: va bene' } });
check('Approvazione', approva.stato === 200 && approva.corpo.proposta?.stato === 'approvata' && approva.corpo.proposta?.codice === codAppr, approva.corpo?.message);
const scontoNato = (await chiama(`/admin/sconti/codici?q=${codAppr}`, admin)).corpo.codici?.[0];
if (scontoNato?.id) daPulire.codici.push(scontoNato.id);
const realeNato = await promozione(scontoNato?.id);
check('Solo ora esiste lo sconto, con le date proposte', scontoNato?.stato === 'programmato' && realeNato?.status === 'active' && Boolean(realeNato?.campaign?.starts_at), scontoNato?.stato);
check('Lo sconto vale solo sul prodotto proposto', realeNato?.application_method?.target_rules?.[0]?.values?.map((v) => v.value).join() === propria.id && realeNato?.application_method?.target_type === 'items');
const propostaDopo = (await chiama('/vendor/sconti/proposte', aziendaA)).corpo.proposte?.find((p) => p.id === prima.corpo.proposta?.id);
check("L'azienda vede esito, nota e codice", propostaDopo?.stato === 'approvata' && propostaDopo?.nota === 'Prova: va bene' && propostaDopo?.codice === codAppr && propostaDopo?.stato_sconto === 'programmato');
const doppia = await chiama(`/admin/sconti/proposte/${prima.corpo.proposta?.id}/approva`, admin, { corpo: {} });
check('Una proposta decisa non si approva due volte', doppia.stato === 400, doppia.corpo?.message);
const ritiroDeciso = await chiama(`/vendor/sconti/proposte/${prima.corpo.proposta?.id}`, aziendaA, { metodo: 'DELETE' });
check('Una proposta decisa non si ritira', ritiroDeciso.stato === 400, ritiroDeciso.corpo?.message);

const seconda = await proponi(aziendaA, { titolo: `Prova da rifiutare ${stamp}` });
const senzaNota = await chiama(`/admin/sconti/proposte/${seconda.corpo.proposta?.id}/rifiuta`, admin, { corpo: {} });
check('Il rifiuto richiede una nota', senzaNota.stato === 400, senzaNota.corpo?.message);
const rifiuto = await chiama(`/admin/sconti/proposte/${seconda.corpo.proposta?.id}/rifiuta`, admin, { corpo: { nota: 'Prova: margine troppo basso' } });
check('Rifiuto con nota', rifiuto.corpo.proposta?.stato === 'rifiutata', rifiuto.corpo?.message);
const rifiutataVista = (await chiama('/vendor/sconti/proposte', aziendaA)).corpo.proposte?.find((p) => p.id === seconda.corpo.proposta?.id);
check("L'azienda legge la nota del rifiuto, nessuno sconto creato", rifiutataVista?.nota === 'Prova: margine troppo basso' && rifiutataVista?.codice === null);

const tutti = await proponi(aziendaA, { titolo: `Prova tutti ${stamp}`, prodotti: null, tipo: 'importo', valore: 5 });
const apprTutti = await chiama(`/admin/sconti/proposte/${tutti.corpo.proposta?.id}/approva`, admin, { corpo: {} });
check('Il codice si genera da solo se non indicato', apprTutti.stato === 200 && /^PROVATUTTI/.test(apprTutti.corpo.proposta?.codice ?? ''), apprTutti.corpo.proposta?.codice ?? apprTutti.corpo?.message);
const scontoTutti = (await chiama(`/admin/sconti/codici?q=${apprTutti.corpo.proposta?.codice}`, admin)).corpo.codici?.[0];
if (scontoTutti?.id) daPulire.codici.push(scontoTutti.id);
check('Senza scelta vale su tutti i prodotti dell\'azienda', scontoTutti?.prodotti === prodottiA.length, `${scontoTutti?.prodotti} di ${prodottiA.length}`);

const ritirabile = await proponi(aziendaA, { titolo: `Prova da ritirare ${stamp}` });
check("L'azienda ritira una proposta in attesa", (await chiama(`/vendor/sconti/proposte/${ritirabile.corpo.proposta?.id}`, aziendaA, { metodo: 'DELETE' })).stato === 200);
const elimApprovata = await chiama(`/admin/sconti/proposte/${prima.corpo.proposta?.id}`, admin, { metodo: 'DELETE' });
check('Una proposta approvata non si elimina', elimApprovata.stato === 400, elimApprovata.corpo?.message);

// CARTE REGALO
const emetti = async (dati) => {
  const r = await chiama('/admin/carte-regalo', admin, { corpo: dati });
  if (r.corpo?.carta?.id) daPulire.carte.push(r.corpo.carta.id);
  return r;
};
const carta = await emetti({ importo: 50, destinatario_nome: `Prova Destinatario ${stamp}`, destinatario_email: 'prova@multioutfit.test', scadenza: tra(90), nota: 'Prova' });
check('Emissione con codice non indovinabile', carta.stato === 201 && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(carta.corpo.carta?.codice ?? '') && carta.corpo.carta?.saldo === 50, carta.corpo.carta?.codice ?? carta.corpo?.message);
check('Importo zero rifiutato', (await emetti({ importo: 0 })).stato === 400);
check('Scadenza passata rifiutata', (await emetti({ importo: 10, scadenza: tra(-1) })).stato === 400);
const idCarta = carta.corpo.carta?.id;
const dettaglio = await chiama(`/admin/carte-regalo/${idCarta}`, admin);
check('Primo movimento: emissione', dettaglio.corpo.carta?.movimenti?.length === 1 && dettaglio.corpo.carta.movimenti[0].tipo === 'emissione' && dettaglio.corpo.carta.movimenti[0].importo === 50);

const rett = await chiama(`/admin/carte-regalo/${idCarta}/movimenti`, admin, { corpo: { importo: -5.5, nota: 'Prova rettifica' } });
check('Rettifica del saldo', rett.stato === 201 && rett.corpo.carta?.saldo === 44.5 && rett.corpo.carta?.movimenti?.[0]?.saldo_dopo === 44.5, rett.corpo?.message);
check('Rettifica senza motivo rifiutata', (await chiama(`/admin/carte-regalo/${idCarta}/movimenti`, admin, { corpo: { importo: 1 } })).stato === 400);
const troppo = await chiama(`/admin/carte-regalo/${idCarta}/movimenti`, admin, { corpo: { importo: -1000, nota: 'Prova eccesso' } });
check('Il saldo non scende sotto zero', troppo.stato === 400 && /below zero/.test(troppo.corpo?.message ?? ''), troppo.corpo?.message);
await Promise.all(Array.from({ length: 5 }, () => chiama(`/admin/carte-regalo/${idCarta}/movimenti`, admin, { corpo: { importo: -1, nota: 'Prova simultanea' } })));
const dopoFolla = await chiama(`/admin/carte-regalo/${idCarta}`, admin);
check('Cinque rettifiche simultanee: saldo esatto', dopoFolla.corpo.carta?.saldo === 39.5 && dopoFolla.corpo.carta?.movimenti?.length === 7, `saldo ${dopoFolla.corpo.carta?.saldo}, movimenti ${dopoFolla.corpo.carta?.movimenti?.length}`);

const trovata = await chiama(`/admin/carte-regalo?q=${encodeURIComponent(`Prova Destinatario ${stamp}`)}`, admin);
check('Ricerca per destinatario', trovata.corpo.carte?.length === 1 && trovata.corpo.carte[0].id === idCarta, `${trovata.corpo.carte?.length}`);
const attive = await chiama('/admin/carte-regalo?stato=attiva', admin);
check('Filtro e totale del saldo attivo', attive.corpo.carte?.every((c) => c.stato === 'attiva') && attive.corpo.saldo_attivo >= 39.5);

check('Annullamento senza motivo rifiutato', (await chiama(`/admin/carte-regalo/${idCarta}/annulla`, admin, { corpo: {} })).stato === 400);
const elimAttiva = await chiama(`/admin/carte-regalo/${idCarta}`, admin, { metodo: 'DELETE' });
check('Una carta valida non si elimina', elimAttiva.stato === 400, elimAttiva.corpo?.message);
const annulla = await chiama(`/admin/carte-regalo/${idCarta}/annulla`, admin, { corpo: { motivo: 'Prova annullamento' } });
check('Annullamento: saldo azzerato e movimento registrato', annulla.corpo.carta?.stato === 'annullata' && annulla.corpo.carta?.saldo === 0 && annulla.corpo.carta?.movimenti?.[0]?.tipo === 'annullamento' && annulla.corpo.carta?.movimenti?.[0]?.importo === -39.5, annulla.corpo?.message);
check('Una carta annullata non cambia più', (await chiama(`/admin/carte-regalo/${idCarta}/movimenti`, admin, { corpo: { importo: 5, nota: 'Prova dopo annullamento' } })).stato === 400);
check('Non si annulla due volte', (await chiama(`/admin/carte-regalo/${idCarta}/annulla`, admin, { corpo: { motivo: 'Prova doppio' } })).stato === 400);

// PERMESSI
const sezione = await emetti({ importo: 5, destinatario_nome: `Prova permessi ${stamp}` });
const lettura = await collaboratore('marketing');
const senza = await collaboratore('ordini');
const membro = await magazziniere();
check('Solo lettura: vede i codici', (await chiama('/admin/sconti/codici', lettura)).stato === 200);
check('Solo lettura: non crea codici', negato(await chiama('/admin/sconti/codici', lettura, { corpo: { codice: `PROVA-N-${stamp}`, tipo: 'percentuale', valore: 5 } })));
check('Solo lettura: non mette in pausa', negato(await chiama(`/admin/sconti/codici/${fix.corpo.codice?.id}/stato`, lettura, { corpo: { attivo: false } })));
check('Solo lettura: non elimina', negato(await chiama(`/admin/sconti/codici/${fix.corpo.codice?.id}`, lettura, { metodo: 'DELETE' })));
check('Solo lettura: non approva', negato(await chiama(`/admin/sconti/proposte/${seconda.corpo.proposta?.id}/approva`, lettura, { corpo: {} })));
check('Solo lettura: non emette carte', negato(await chiama('/admin/carte-regalo', lettura, { corpo: { importo: 5 } })));
const cartaVista = await chiama(`/admin/carte-regalo/${sezione.corpo.carta?.id}`, lettura);
check('Solo lettura: il codice della carta è nascosto', /^•{4}-•{4}-•{4}-.{4}$/.test(cartaVista.corpo.carta?.codice ?? ''), cartaVista.corpo.carta?.codice);
check('Ruolo senza permesso: niente codici', negato(await chiama('/admin/sconti/codici', senza)));
check('Ruolo senza permesso: niente proposte', negato(await chiama('/admin/sconti/proposte', senza)));
check('Ruolo senza permesso: niente carte', negato(await chiama('/admin/carte-regalo', senza)));
check('Ruolo aziendale senza permesso: non legge', negato(await chiama('/vendor/sconti/proposte', membro)));
check('Ruolo aziendale senza permesso: niente elenco prodotti', negato(await chiama('/vendor/sconti/prodotti', membro)));
check('Ruolo aziendale senza permesso: non propone', negato(await chiama('/vendor/sconti/proposte', membro, { corpo: proposta() })));

const azioni = (await chiama('/admin/registro', admin)).corpo.voci?.map((v) => v.azione) ?? [];
for (const attesa of ['Discount created', 'Discount edited', 'Discount duplicated', 'Discount deleted', 'Discount proposal approved', 'Discount proposal rejected', 'Gift card issued', 'Gift card cancelled']) {
  check(`Registro: ${attesa}`, azioni.includes(attesa));
}
// Il prefisso delle azioni negate è nel file comune `azioni.ts`: qui conta la frase di questa sezione.
check('Registro: tentativo negato', azioni.some((a) => /: discount created$/i.test(a)));

// BROWSER
if (!process.argv.includes('--solo-api')) {
  const { apriBrowser, accediAdminBrowser, accediAziendaBrowser, CARTELLA_SCREENSHOT } = await import('./lib-browser.mjs');
  const { CONSOLE } = await import('./lib.mjs');
  const path = (await import('node:path')).default;
  const { browser, nuovaPagina, errori } = await apriBrowser();
  const senzaScorrimento = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const foto = (p, nome) => p.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `sconti-${nome}.png`), fullPage: true });
  const italiano = /\b(sconto|sconti|codice|codici|carta|carte|regalo|proposta|proposte|azienda|aziende|nessun|nessuna|attivo|attiva|terminato|salva|annulla|elimina|caricamento|scadenza|motivo|saldo|pausa)\b/i;
  // I dati delle prove iniziano con «Prova»: non sono testi dell'interfaccia.
  const testoPagina = async (p) => (await p.locator('.contenuto').first().innerText()).split('\n').filter((riga) => !/prova/i.test(riga)).join('\n');
  const giorno = (giorni) => tra(giorni).slice(0, 10);

  try {
    const p = await nuovaPagina();
    await accediAdminBrowser(p);

    await p.goto(`${CONSOLE}/sconti`);
    await p.waitForURL('**/sconti/codici');
    check('Browser: /sconti apre Codes, con le tre schede', await p.getByRole('link', { name: 'Codes' }).isVisible() && await p.getByRole('link', { name: 'Gift cards' }).isVisible() && await p.getByRole('link', { name: /^Proposals/ }).isVisible());
    check('Browser: azione nella testata, come nel pannello', await p.locator('.pagina__testa').getByRole('button', { name: 'New code' }).isVisible());

    const codice = `PROVA-B-${stamp}`;
    await p.goto(`${CONSOLE}/sconti/codici?nuovo=1`);
    const nuovo = p.getByRole('dialog', { name: 'New discount code' });
    await nuovo.waitFor();
    check('Browser: ?nuovo=1 apre il modulo', true);
    await nuovo.getByLabel('Code').fill(codice.toLowerCase());
    check('Browser: il codice si scrive in maiuscolo', (await nuovo.getByLabel('Code').inputValue()) === codice);
    await nuovo.getByLabel('Note').fill('Prova dal browser');
    await nuovo.getByLabel('Percent').fill('25');
    await nuovo.getByLabel('Use limit').fill('40');
    await nuovo.getByLabel('Ends').fill(giorno(60));
    await foto(p, 'nuovo-scuro');
    await nuovo.getByRole('button', { name: 'Create code' }).click();
    const riga = p.getByRole('row').filter({ hasText: codice });
    await riga.first().waitFor();
    const testoRiga = (await riga.first().innerText()).replace(/\s+/g, ' ');
    check('Browser: sconto creato, con offerta e usi in tabella', testoRiga.includes('25% off') && testoRiga.includes('0 / 40'), testoRiga.slice(0, 90));
    check('Browser: interruttore acceso', (await riga.first().getByRole('switch').getAttribute('aria-checked')) === 'true');
    check('Browser: colonne come nel pannello', (await p.getByRole('columnheader').allInnerTexts()).slice(0, 5).join() === 'Code,Offer,Used,Ends,Live', (await p.getByRole('columnheader').allInnerTexts()).join());
    check('Browser: il modulo si chiude e toglie ?nuovo=1', !p.url().includes('nuovo'));
    check('Browser: ricerca, filtri e tabella nello stesso blocco', (await p.locator('.sc-blocco').getByRole('table').count()) === 1 && (await p.locator('.sc-blocco').getByLabel('Search codes').count()) === 1);

    await riga.first().getByRole('switch').click();
    await riga.first().getByText('Paused', { exact: true }).waitFor();
    check('Browser: interruttore mette in pausa', true);
    await riga.first().getByRole('switch', { checked: false }).click();
    await riga.first().getByRole('switch', { checked: true }).waitFor();
    check('Browser: interruttore riattiva', true);

    await riga.first().getByRole('button', { name: `Duplicate ${codice}` }).click();
    const copiaRiga = p.getByRole('row').filter({ hasText: `${codice}-COPY` });
    await copiaRiga.first().waitFor();
    check('Browser: duplicazione, copia in pausa', (await copiaRiga.first().innerText()).includes('Paused'));

    await p.getByLabel('Search codes').fill(`${codice}-COPY`);
    await p.waitForFunction((testo) => document.querySelectorAll('tbody tr').length === 1 && document.querySelector('tbody tr').innerText.includes(testo), `${codice}-COPY`);
    check('Browser: ricerca', true);
    await p.getByRole('button', { name: `Delete ${codice}-COPY` }).click();
    await foto(p, 'conferma-scuro');
    await p.getByRole('dialog').getByRole('button', { name: 'Delete discount' }).click();
    await p.getByText('No discounts match these filters').waitFor();
    check('Browser: eliminazione con conferma', true);

    await p.getByLabel('Search codes').fill(codice);
    await riga.first().waitFor();
    await riga.first().getByRole('cell').nth(1).click();
    const modifica = p.getByRole('dialog', { name: `Edit ${codice}` });
    await modifica.waitFor();
    check('Browser: la modifica riporta i dati salvati', (await modifica.getByLabel('Percent').inputValue()) === '25' && (await modifica.getByLabel('Use limit').inputValue()) === '40' && (await modifica.getByLabel('Ends').inputValue()) === giorno(60));
    await modifica.getByLabel('Percent').fill('30');
    await modifica.getByRole('button', { name: 'Save changes' }).click();
    await modifica.waitFor({ state: 'hidden' });
    await riga.first().getByText('30% off').waitFor();
    check('Browser: modifica salvata', true);
    await p.getByLabel('Search codes').fill('');
    await p.locator('.sc-blocco .selettore').getByRole('button', { name: /^Live/ }).click();
    await p.waitForFunction(() => document.querySelector('.sc-blocco .selettore button.attivo')?.textContent.startsWith('Live'));
    await p.waitForLoadState('networkidle');
    check('Browser: la testata conta i codici in corso', /running right now/.test(await p.locator('.pagina__testa').innerText()));
    await foto(p, 'codici-scuro');
    check('Browser: Codes senza italiano', !italiano.test(await testoPagina(p)), (await testoPagina(p)).match(italiano)?.[0]);

    await p.goto(`${CONSOLE}/sconti/carte-regalo`);
    const avviso = await p.getByRole('note').innerText();
    check('Browser: la pagina dice che le carte non valgono ancora al checkout', /can't be redeemed at checkout yet/.test(avviso), avviso.slice(0, 80));
    await p.locator('.pagina__testa').getByRole('button', { name: 'Issue gift card' }).click();
    const emissione = p.getByRole('dialog', { name: 'Issue a gift card' });
    await emissione.getByLabel('Amount').fill('75');
    await emissione.getByLabel('Recipient (optional)').fill(`Prova Browser ${stamp}`);
    await emissione.getByRole('button', { name: 'Issue card' }).click();
    const scheda = p.getByRole('dialog', { name: 'Gift card' });
    await scheda.waitFor();
    const codiceCarta = await scheda.locator('.sc-codice--grande').innerText();
    check('Browser: carta emessa con il suo codice', /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/.test(codiceCarta));
    await scheda.getByLabel('Change in balance').fill('-10');
    await scheda.getByLabel('Reason').fill('Prova dal browser');
    await scheda.getByRole('button', { name: 'Record adjustment' }).click();
    await scheda.getByText(/Balance .65\.00/).first().waitFor();
    check('Browser: rettifica visibile nell\'attività', (await scheda.getByText('Adjustment', { exact: true }).count()) >= 1 && (await scheda.getByText('Issued', { exact: true }).count()) === 1);
    await foto(p, 'carta-scuro');
    await scheda.getByRole('button', { name: 'Close' }).click();

    const inGriglia = p.locator('.sc-carta').filter({ hasText: `Prova Browser ${stamp}` });
    await inGriglia.waitFor();
    const testoCarta = await inGriglia.innerText();
    check('Browser: griglia di carte con saldo e fine del codice', /65\.00/.test(testoCarta) && testoCarta.includes(codiceCarta.slice(-4)) && testoCarta.includes('Ishtar Lab') && !testoCarta.includes(codiceCarta), testoCarta.replace(/\s+/g, ' ').slice(0, 100));
    check('Browser: fascia con il saldo ancora da spendere', /unspent across/.test(await p.locator('.sc-fascia').innerText()));
    await p.waitForLoadState('networkidle');
    await foto(p, 'carte-griglia-scuro');
    await inGriglia.click();
    await scheda.getByRole('button', { name: 'Cancel gift card' }).click();
    const annullo = p.getByRole('dialog', { name: 'Cancel this gift card?' });
    await annullo.getByLabel('Reason').fill('Prova dal browser');
    await foto(p, 'annullo-scuro');
    await annullo.getByRole('button', { name: 'Confirm cancellation' }).click();
    await scheda.getByText('Cancelled', { exact: true }).first().waitFor();
    check('Browser: carta annullata dalla sua scheda', true);
    await scheda.getByRole('button', { name: 'Close' }).click();
    check('Browser: Gift cards senza italiano', !italiano.test(await testoPagina(p)), (await testoPagina(p)).match(italiano)?.[0]);
    const cartaBrowser = (await chiama(`/admin/carte-regalo?q=${encodeURIComponent(`Prova Browser ${stamp}`)}`, admin)).corpo.carte?.[0];
    if (cartaBrowser) daPulire.carte.push(cartaBrowser.id);

    const az = await nuovaPagina();
    await accediAziendaBrowser(az, 'seller@mercur.dev');
    await az.goto(`${CONSOLE}/sconti?nuovo=1`);
    const proponiBrowser = az.getByRole('dialog', { name: 'Propose a discount' });
    await proponiBrowser.waitFor();
    const titoloProposta = `Prova browser ${stamp}`;
    await proponiBrowser.getByLabel('Title').fill(titoloProposta);
    await proponiBrowser.getByLabel('Percent').fill('10');
    await proponiBrowser.getByLabel('From', { exact: true }).fill(giorno(5));
    await proponiBrowser.getByLabel('To', { exact: true }).fill(giorno(25));
    await proponiBrowser.getByLabel('Reason').fill('Prova di fine stagione');
    await proponiBrowser.getByRole('button', { name: 'Choose' }).click();
    await proponiBrowser.getByRole('checkbox').first().check();
    await foto(az, 'proposta-azienda-scuro');
    check("Browser: il modulo dell'azienda non mostra prezzi", !/[€£$]/.test(await proponiBrowser.innerText()));
    await proponiBrowser.getByRole('button', { name: 'Send proposal' }).click();
    const voceAz = az.getByRole('listitem').filter({ hasText: titoloProposta });
    await voceAz.waitFor();
    check("Browser: l'azienda vede la proposta in attesa", (await voceAz.innerText()).includes('Pending'));
    check("Browser: l'azienda non ha le schede dell'amministratore", (await az.getByRole('link', { name: 'Gift cards' }).count()) === 0 && (await az.getByRole('navigation', { name: 'Discount sections' }).count()) === 0);
    await az.goto(`${CONSOLE}/sconti/carte-regalo`);
    await az.getByRole('heading', { name: 'Discounts' }).waitFor();
    await voceAz.waitFor();
    check("Browser: l'indirizzo delle carte mostra all'azienda solo le sue proposte", (await az.getByRole('note').count()) === 0 && (await voceAz.count()) === 1);
    const idBrowser = (await chiama('/vendor/sconti/proposte', aziendaA)).corpo.proposte?.find((v) => v.titolo === titoloProposta)?.id;
    if (idBrowser) daPulire.proposte.push(idBrowser);

    await p.goto(`${CONSOLE}/sconti/proposte`);
    const voceAdmin = p.getByRole('listitem').filter({ hasText: titoloProposta });
    await voceAdmin.waitFor();
    check("Browser: l'amministratore vede azienda, motivo e prodotto", (await voceAdmin.innerText()).includes(aziendaA.nome) && (await voceAdmin.innerText()).includes('Prova di fine stagione'));
    check('Browser: la scheda Proposals conta quelle in attesa', /Proposals\s*\d+/.test(await p.getByRole('link', { name: /^Proposals/ }).innerText()));
    await foto(p, 'proposte-scuro');
    check('Browser: Proposals senza italiano', !italiano.test(await testoPagina(p)), (await testoPagina(p)).match(italiano)?.[0]);
    await voceAdmin.getByRole('button', { name: 'Approve' }).click();
    const decisione = p.getByRole('dialog', { name: 'Approve proposal' });
    const codiceBrowser = `PROVA-D-${stamp}`;
    await decisione.getByLabel('Code').fill(codiceBrowser);
    await decisione.getByLabel('Note for the company').fill('Prova: approvata dal browser');
    await decisione.getByRole('button', { name: 'Approve and create discount' }).click();
    await decisione.waitFor({ state: 'hidden' });
    await p.goto(`${CONSOLE}/sconti/codici`);
    await p.getByLabel('Search codes').fill(codiceBrowser);
    const nata = p.getByRole('row').filter({ hasText: codiceBrowser });
    await nata.first().waitFor();
    check("Browser: dopo l'approvazione lo sconto è fra i codici", (await nata.first().innerText()).includes(`Proposed by ${aziendaA.nome}`) && (await nata.first().innerText()).includes('Starts'));

    await az.goto(`${CONSOLE}/sconti`);
    await voceAz.waitFor();
    const esito = await voceAz.innerText();
    check("Browser: l'azienda vede approvazione, nota e codice", esito.includes('Approved') && esito.includes('Prova: approvata dal browser') && esito.includes(codiceBrowser));
    await foto(az, 'azienda-scuro');
    check('Browser: portale azienda senza italiano', !italiano.test(await testoPagina(az)), (await testoPagina(az)).match(italiano)?.[0]);

    const chiara = await nuovaPagina({ colorScheme: 'light' });
    await accediAdminBrowser(chiara);
    await chiara.goto(`${CONSOLE}/sconti/codici`);
    await chiara.getByRole('table').waitFor();
    check('Browser: tema chiaro attivo', (await chiara.evaluate(() => document.documentElement.dataset.tema)) === 'chiaro');
    await foto(chiara, 'codici-chiaro');
    await chiara.goto(`${CONSOLE}/sconti/carte-regalo`);
    await chiara.getByRole('note').waitFor();
    await chiara.waitForLoadState('networkidle');
    await foto(chiara, 'carte-chiaro');
    await chiara.goto(`${CONSOLE}/sconti/proposte`);
    await chiara.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: 'All' }).click();
    await chiara.getByRole('listitem').filter({ hasText: titoloProposta }).waitFor();
    await foto(chiara, 'proposte-chiaro');

    const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
    await accediAdminBrowser(telefono);
    for (const [indirizzo, nome] of [['/sconti/codici', 'codici'], ['/sconti/carte-regalo', 'carte'], ['/sconti/proposte', 'proposte']]) {
      await telefono.goto(`${CONSOLE}${indirizzo}`);
      await telefono.getByRole('link', { name: 'Gift cards' }).waitFor();
      await telefono.waitForLoadState('networkidle');
      check(`Browser: ${nome} a 390 px senza scorrimento laterale`, await senzaScorrimento(telefono));
      await foto(telefono, `${nome}-telefono`);
    }
    await telefono.goto(`${CONSOLE}/sconti/codici?nuovo=1`);
    await telefono.getByRole('dialog', { name: 'New discount code' }).waitFor();
    check('Browser: modulo a 390 px senza scorrimento laterale', await senzaScorrimento(telefono));
    await foto(telefono, 'nuovo-telefono');

    const telefonoAz = await nuovaPagina({ viewport: { width: 390, height: 844 } });
    await accediAziendaBrowser(telefonoAz, 'seller@mercur.dev');
    await telefonoAz.goto(`${CONSOLE}/sconti`);
    await telefonoAz.getByRole('listitem').filter({ hasText: titoloProposta }).waitFor();
    check('Browser: portale azienda a 390 px senza scorrimento laterale', await senzaScorrimento(telefonoAz));
    await foto(telefonoAz, 'azienda-telefono');

    const nate = (await chiama(`/admin/sconti/codici?q=${stamp}`, admin)).corpo.codici ?? [];
    for (const sconto of nate) daPulire.codici.push(sconto.id);
    check('Browser: nessun errore nella pagina', errori.length === 0, errori[0]?.slice(0, 160));
  } catch (errore) {
    check('Browser: passaggio completo', false, errore.message.split('\n')[0].slice(0, 200));
    const nate = (await chiama(`/admin/sconti/codici?q=${stamp}`, admin)).corpo.codici ?? [];
    for (const sconto of nate) daPulire.codici.push(sconto.id);
    const proposteRimaste = (await chiama('/vendor/sconti/proposte', aziendaA)).corpo.proposte ?? [];
    for (const voce of proposteRimaste) if (voce.titolo.includes(String(stamp))) daPulire.proposte.push(voce.id);
    const carteRimaste = (await chiama(`/admin/carte-regalo?q=${encodeURIComponent(`Prova Browser ${stamp}`)}`, admin)).corpo.carte ?? [];
    for (const voce of carteRimaste) daPulire.carte.push(voce.id);
  } finally {
    await browser.close();
  }
}

// PULIZIA
for (const id of daPulire.bozze) await chiama(`/admin/draft-orders/${id}`, admin, { metodo: 'DELETE' });
const clienti = (await chiama(`/admin/customers?q=prova-sconti-${stamp}&limit=10`, admin)).corpo.customers ?? [];
for (const cliente of clienti) await chiama(`/admin/customers/${cliente.id}`, admin, { metodo: 'DELETE' });
for (const id of daPulire.codici) await chiama(`/admin/sconti/codici/${id}`, admin, { metodo: 'DELETE' });
for (const id of daPulire.proposte) await chiama(`/admin/sconti/proposte/${id}`, admin, { metodo: 'DELETE' });
for (const id of daPulire.carte) {
  await chiama(`/admin/carte-regalo/${id}/annulla`, admin, { corpo: { motivo: 'Prova: pulizia' } });
  await chiama(`/admin/carte-regalo/${id}`, admin, { metodo: 'DELETE' });
}
const squadra = (await chiama('/admin/team', admin)).corpo;
for (const email of daPulire.persone) {
  const persona = squadra.collaboratori?.find((c) => c.email === email);
  if (persona) await chiama(`/admin/team/${persona.id}`, admin, { metodo: 'DELETE' });
}
const membri = (await chiama(`/vendor/sellers/${aziendaA.azienda}/members?limit=100`, aziendaA)).corpo.seller_members ?? [];
for (const m of membri) {
  if (daPulire.membri.includes(m.member?.email)) await chiama(`/vendor/sellers/${aziendaA.azienda}/members/${m.id}`, aziendaA, { metodo: 'DELETE' });
}
const restanti = (await chiama(`/admin/sconti/codici?q=${stamp}`, admin)).corpo.conteggio;
check('Pulizia: nessuno sconto di prova rimasto', restanti === 0, `${restanti}`);

chiudi('sconti funzionanti');
