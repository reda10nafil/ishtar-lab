// Prova di Ingrosso: rivenditori, bacheca delle trattative, note, bozza d'ordine reale, permessi e passaggio nel browser.
// Uso: node infra/prova-ingrosso.mjs [--solo-api]. I dati creati iniziano con «Prova» e si cancellano alla fine.
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

await attendiBackend();
const admin = await accediAdmin();
const azienda = await accediAzienda('seller@mercur.dev');
const daPulire = { rivenditori: [], trattative: [], bozze: [], persone: [] };

const collaboratore = async (ruolo) => {
  const email = `prova-ingrosso-${ruolo}-${stamp}@multioutfit.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  await chiama('/admin/team', admin, { corpo: { email, ruolo } });
  const token = tokenDaEmail(await emailPer(email))?.searchParams.get('token') ?? '';
  const iscritto = await chiama('/auth/user/emailpass/register', null, { corpo: { email, password } });
  await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: iscritto.corpo?.token }, { corpo: { first_name: 'Prova', last_name: 'Ingrosso' } });
  daPulire.persone.push(email);
  return accediAdmin(email, password);
};

const creaRivenditore = async (dati) => {
  const r = await chiama('/admin/ingrosso/rivenditori', admin, { corpo: dati });
  if (r.corpo?.rivenditore?.id) daPulire.rivenditori.push(r.corpo.rivenditore.id);
  return r;
};
const creaTrattativa = async (dati) => {
  const r = await chiama('/admin/ingrosso/trattative', admin, { corpo: dati });
  if (r.corpo?.trattativa?.id) daPulire.trattative.push(r.corpo.trattativa.id);
  return r;
};

// RIVENDITORI
const nomeRiv = `Prova Rivenditore ${stamp}`;
const riv = await creaRivenditore({ nome: nomeRiv, referente: 'Prova Referente', telefono: '+39 000 000', condizione: 'sconto', sconto_percentuale: 30, pagamento: '30 giorni', ordine_minimo: 500 });
check('Rivenditore creato con condizioni', riv.stato === 201 && riv.corpo.rivenditore?.sconto_percentuale === 30 && riv.corpo.rivenditore?.ordine_minimo === 500 && riv.corpo.rivenditore?.pagamento === '30 giorni', riv.corpo?.message);
for (const [nome, corpo] of [
  ['senza nome', { nome: '' }],
  ['con email errata', { nome: 'Prova errata', email: 'non-una-email' }],
  ['con sconto oltre 100', { nome: 'Prova errata', sconto_percentuale: 120 }],
  ['con ordine minimo negativo', { nome: 'Prova errata', ordine_minimo: -5 }],
]) {
  const r = await creaRivenditore(corpo);
  check(`Rivenditore rifiutato ${nome}`, r.stato === 400 && !/invalid|expected/i.test(r.corpo?.message ?? ''), r.corpo?.message);
}
const idRiv = riv.corpo.rivenditore?.id;
const conListino = await chiama(`/admin/ingrosso/rivenditori/${idRiv}`, admin, { corpo: { nome: nomeRiv, condizione: 'listino', listino: 'Prova listino A', sconto_percentuale: null, pagamento: '60 giorni', ordine_minimo: 500, referente: 'Prova Referente' } });
check('Modifica: condizione a listino', conListino.corpo.rivenditore?.condizione === 'listino' && conListino.corpo.rivenditore?.listino === 'Prova listino A' && conListino.corpo.rivenditore?.sconto_percentuale === null, conListino.corpo?.message);
const trovato = await chiama(`/admin/ingrosso/rivenditori?q=${encodeURIComponent(nomeRiv)}`, admin);
check('Ricerca del rivenditore', trovato.corpo.rivenditori?.length === 1 && trovato.corpo.rivenditori[0].id === idRiv, `${trovato.corpo.rivenditori?.length}`);

// BACHECA
const prima = await creaTrattativa({ titolo: `Prova trattativa A ${stamp}`, rivenditore_id: idRiv, valore_stimato: 1200 });
const seconda = await creaTrattativa({ titolo: `Prova trattativa B ${stamp}`, rivenditore_id: idRiv });
const terza = await creaTrattativa({ titolo: `Prova trattativa C ${stamp}`, rivenditore_id: idRiv, fase: 'campione', valore_stimato: 300 });
check('Trattativa creata in Richiesta, con il valore inserito', prima.stato === 201 && prima.corpo.trattativa?.fase === 'richiesta' && prima.corpo.trattativa?.valore_stimato === 1200 && prima.corpo.trattativa?.rivenditore?.nome === nomeRiv, prima.corpo?.message);
check('Senza valore resta vuoto, non inventato', seconda.corpo.trattativa?.valore_stimato === null);
check('Trattativa creata direttamente in una colonna', terza.corpo.trattativa?.fase === 'campione');
check('Trattativa senza titolo rifiutata', (await creaTrattativa({ rivenditore_id: idRiv })).stato === 400);
check('Trattativa senza rivenditore rifiutata', (await creaTrattativa({ titolo: 'Prova orfana' })).stato === 400);
check('Rivenditore inesistente rifiutato', [400, 404].includes((await creaTrattativa({ titolo: 'Prova orfana', rivenditore_id: 'riv_inesistente' })).stato));

const id1 = prima.corpo.trattativa?.id;
const id2 = seconda.corpo.trattativa?.id;
const id3 = terza.corpo.trattativa?.id;
const colonna = async (fase) => (await chiama('/admin/ingrosso/trattative', admin)).corpo.trattative?.filter((t) => t.fase === fase).map((t) => t.id) ?? [];
const sposta = (id, corpo) => chiama(`/admin/ingrosso/trattative/${id}/sposta`, admin, { corpo });

const sp1 = await sposta(id1, { fase: 'campione', indice: 0 });
check('Spostata in testa alla colonna Campione', sp1.corpo.trattativa?.fase === 'campione' && (await colonna('campione'))[0] === id1, sp1.corpo?.message);
await sposta(id2, { fase: 'campione', indice: 1 });
const ordine = await colonna('campione');
check("L'ordine nella colonna è quello scelto", ordine.indexOf(id1) === 0 && ordine.indexOf(id2) === 1 && ordine.indexOf(id3) > 1, ordine.length);
await sposta(id3, { fase: 'campione', indice: 0 });
check('Riordino nella stessa colonna', (await colonna('campione'))[0] === id3);
const fuori = await sposta(id1, { fase: 'inesistente' });
check('Colonna inesistente rifiutata', fuori.stato === 400, fuori.corpo?.message);
await Promise.all([sposta(id1, { fase: 'trattativa' }), sposta(id2, { fase: 'trattativa' }), sposta(id3, { fase: 'trattativa' })]);
const insieme = (await chiama('/admin/ingrosso/trattative', admin)).corpo.trattative?.filter((t) => [id1, id2, id3].includes(t.id));
check('Tre spostamenti simultanei: posizioni diverse', new Set(insieme?.map((t) => t.posizione)).size === 3 && insieme?.every((t) => t.fase === 'trattativa'), insieme?.map((t) => t.posizione).join());

const nota = await chiama(`/admin/ingrosso/trattative/${id1}/note`, admin, { corpo: { testo: 'Prova: chiede il campionario' } });
check('Nota salvata con autore', nota.stato === 201 && nota.corpo.trattativa?.note?.[0]?.testo === 'Prova: chiede il campionario' && Boolean(nota.corpo.trattativa?.note?.[0]?.autore), nota.corpo?.message);
check('Nota vuota rifiutata', (await chiama(`/admin/ingrosso/trattative/${id1}/note`, admin, { corpo: { testo: '  ' } })).stato === 400);
const ritoccata = await chiama(`/admin/ingrosso/trattative/${id1}`, admin, { corpo: { valore_stimato: 1500, titolo: `Prova trattativa A2 ${stamp}` } });
check('Valore e titolo modificabili', ritoccata.corpo.trattativa?.valore_stimato === 1500, ritoccata.corpo?.message);

// BOZZA D'ORDINE
const percorso = `/admin/ingrosso/trattative/${id1}/ordine`;
const riga = { titolo: 'Prova lotto', quantita: 2, prezzo_unitario: 100 };
const reqNonAccordo = await chiama(percorso, admin);
check('Prima dell\'accordo la pagina dice cosa manca', reqNonAccordo.corpo.mancanti?.some((m) => /Agreed stage/.test(m)) && reqNonAccordo.corpo.mancanti?.some((m) => /email/.test(m)), reqNonAccordo.corpo.mancanti?.length);
const regione = reqNonAccordo.corpo.regioni?.[0]?.id;
const canale = reqNonAccordo.corpo.canali?.[0]?.id;
const corpoOrdine = { regione_id: regione, canale_id: canale, righe: [riga] };
const nonAccordo = await chiama(percorso, admin, { corpo: corpoOrdine });
check('Non si crea la bozza fuori dalla colonna Accordo', nonAccordo.stato === 400 && /Agreed stage/.test(nonAccordo.corpo?.message ?? ''), nonAccordo.corpo?.message);
await sposta(id1, { fase: 'accordo' });
const senzaEmail = await chiama(percorso, admin, { corpo: corpoOrdine });
check("Senza email la bozza è rifiutata e il motivo è chiaro", senzaEmail.stato === 400 && /no email address/.test(senzaEmail.corpo?.message ?? ''), senzaEmail.corpo?.message);
const senzaBozze = (await chiama('/admin/draft-orders?limit=100&fields=id,metadata', admin)).corpo.draft_orders?.filter((d) => d.metadata?.ingrosso_trattativa_id === id1) ?? [];
check('Nessuna bozza creata dai tentativi falliti', senzaBozze.length === 0);

const emailRiv = `prova-ingrosso-${stamp}@multioutfit.test`;
await chiama(`/admin/ingrosso/rivenditori/${idRiv}`, admin, { corpo: { nome: nomeRiv, email: emailRiv, indirizzo: 'Via Prova 1', citta: 'Milano', cap: '20100', paese: 'it', condizione: 'listino', listino: 'Prova listino A', pagamento: '60 giorni', ordine_minimo: 500 } });
const pronta = await chiama(percorso, admin);
check('Dati completi: nulla manca', pronta.corpo.mancanti?.length === 0 && pronta.corpo.avvisi?.length === 0 && pronta.corpo.condizioni?.ordine_minimo === 500, JSON.stringify(pronta.corpo.mancanti));
check('Ordine senza righe rifiutato', (await chiama(percorso, admin, { corpo: { ...corpoOrdine, righe: [] } })).stato === 400);
check('Regione inesistente spiegata', /sales region/.test((await chiama(percorso, admin, { corpo: { ...corpoOrdine, regione_id: 'reg_inesistente' } })).corpo?.message ?? ''));

const varianti = await chiama('/admin/ingrosso/varianti?q=Cloudpeak', admin);
const variante = varianti.corpo.varianti?.find((v) => v.prezzo > 0);
check('Ricerca degli articoli del catalogo con prezzo in euro', varianti.stato === 200 && Boolean(variante) && /Cloudpeak/.test(variante?.titolo ?? ''), variante?.titolo);

const creato = await chiama(percorso, admin, { corpo: { ...corpoOrdine, righe: [riga, { variante_id: variante?.id, titolo: variante?.titolo, quantita: 1, prezzo_unitario: 50 }] } });
const idBozza = creato.corpo.ordine?.id;
if (idBozza) daPulire.bozze.push(idBozza);
check('Bozza creata', creato.stato === 201 && Boolean(idBozza), creato.corpo?.message ?? idBozza);
const elenco = (await chiama('/admin/draft-orders?limit=100&fields=id,email,total,status,metadata,customer_id,*items,*shipping_address', admin)).corpo.draft_orders ?? [];
const reale = elenco.find((d) => d.id === idBozza);
check('La bozza è vera: compare in /admin/draft-orders', reale?.status === 'draft' && reale?.email === emailRiv && reale?.metadata?.ingrosso_trattativa_id === id1);
check('Righe e totale corretti', reale?.items?.length === 2 && reale?.total === 250, `totale ${reale?.total}`);
check('Indirizzo del rivenditore nella bozza', reale?.shipping_address?.address_1 === 'Via Prova 1' && reale?.shipping_address?.city === 'Milano');
const dopo = await chiama(`/admin/ingrosso/trattative/${id1}`, admin);
check('La trattativa ricorda la bozza', dopo.corpo.trattativa?.ordine_id === idBozza);
const doppia = await chiama(percorso, admin, { corpo: corpoOrdine });
check('Niente seconda bozza dalla stessa trattativa', doppia.stato === 400 && /already has a draft order/.test(doppia.corpo?.message ?? ''), doppia.corpo?.message);
const giaFatta = await chiama(percorso, admin);
check('La pagina indica la bozza esistente', giaFatta.corpo.ordine?.id === idBozza && giaFatta.corpo.ordine?.stato === 'draft');

const elimRiv = await chiama(`/admin/ingrosso/rivenditori/${idRiv}`, admin, { metodo: 'DELETE' });
check('Un rivenditore con trattative non si elimina', elimRiv.stato === 400, elimRiv.corpo?.message);

// PERMESSI
const lettura = await collaboratore('lettura');
const ordini = await collaboratore('ordini');
const senza = await collaboratore('marketing');
check('Sola lettura: vede la bacheca', (await chiama('/admin/ingrosso/trattative', lettura)).stato === 200);
check('Sola lettura: non crea rivenditori', negato(await chiama('/admin/ingrosso/rivenditori', lettura, { corpo: { nome: 'Prova negata' } })));
check('Sola lettura: non sposta carte', negato(await sposta2(lettura)));
check('Sola lettura: non crea bozze', negato(await chiama(percorso, lettura, { corpo: corpoOrdine })));
check('Operatore ordini: sposta le carte', (await chiama(`/admin/ingrosso/trattative/${id2}/sposta`, ordini, { corpo: { fase: 'richiesta' } })).stato === 200);
check('Operatore ordini: non elimina', negato(await chiama(`/admin/ingrosso/trattative/${id2}`, ordini, { metodo: 'DELETE' })));
check('Ruolo senza permesso: niente bacheca', negato(await chiama('/admin/ingrosso/trattative', senza)));
check('Ruolo senza permesso: niente rivenditori', negato(await chiama('/admin/ingrosso/rivenditori', senza)));
check("Un'azienda non entra nell'ingrosso", negato(await chiama('/admin/ingrosso/trattative', azienda)));
check("Un'azienda non legge i rivenditori", negato(await chiama('/admin/ingrosso/rivenditori', azienda)));
check("Un'azienda non crea bozze", negato(await chiama(percorso, azienda, { corpo: corpoOrdine })));

const azioni = (await chiama('/admin/registro', admin)).corpo.voci?.map((v) => v.azione) ?? [];
for (const attesa of ['Stockist created', 'Deal created', 'Deal moved on the board', 'Note added to a deal', 'Draft order created from a deal']) {
  check(`Registro: ${attesa}`, azioni.includes(attesa));
}

function sposta2(sessione) {
  return chiama(`/admin/ingrosso/trattative/${id2}/sposta`, sessione, { corpo: { fase: 'richiesta' } });
}

// BROWSER
if (!process.argv.includes('--solo-api')) {
  const { apriBrowser, accediAdminBrowser, CARTELLA_SCREENSHOT } = await import('./lib-browser.mjs');
  const { CONSOLE } = await import('./lib.mjs');
  const path = (await import('node:path')).default;
  const { browser, nuovaPagina, errori } = await apriBrowser();
  const senzaScorrimento = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const foto = (p, nome) => p.screenshot({ path: path.join(CARTELLA_SCREENSHOT, `ingrosso-${nome}.png`), fullPage: true });
  const italiano = /\b(ingrosso|rivenditore|rivenditori|trattativa|trattative|bacheca|richiesta|campione|accordo|perso|nessun|nessuna|bozza|ordine|salva|elimina|caricamento|valore)\b/i;
  // I dati delle prove iniziano con «Prova»: non sono testi dell'interfaccia.
  const testoPagina = async (p) => (await p.locator('.contenuto').first().innerText()).split('\n').filter((riga) => !/prova/i.test(riga)).join('\n');
  const nomeBr = `Prova Browser ${stamp}`;
  const titoloA = `Prova ordine ${stamp}`;
  const titoloB = `Prova seconda ${stamp}`;
  const trattativaDi = async (titolo) => (await chiama('/admin/ingrosso/trattative', admin)).corpo.trattative?.find((t) => t.titolo === titolo);

  const raccogli = async () => {
    const elenco = (await chiama('/admin/ingrosso/trattative', admin)).corpo.trattative ?? [];
    for (const t of elenco) if (t.titolo.includes(String(stamp)) && !daPulire.trattative.includes(t.id)) daPulire.trattative.push(t.id);
    const riv = (await chiama('/admin/ingrosso/rivenditori', admin)).corpo.rivenditori ?? [];
    for (const r of riv) if (r.nome.includes(String(stamp)) && !daPulire.rivenditori.includes(r.id)) daPulire.rivenditori.push(r.id);
    const bozze = (await chiama('/admin/draft-orders?limit=100&fields=id,email', admin)).corpo.draft_orders ?? [];
    for (const b of bozze) if (b.email?.includes(String(stamp)) && !daPulire.bozze.includes(b.id)) daPulire.bozze.push(b.id);
  };

  try {
    const p = await nuovaPagina();
    await accediAdminBrowser(p);
    await p.goto(`${CONSOLE}/ingrosso`);
    await p.getByRole('heading', { name: 'Wholesale', exact: true }).waitFor();
    check('Browser: una sola pagina con la bacheca e i rivenditori', await p.getByRole('region', { name: 'Stockists' }).isVisible() && (await p.getByRole('navigation', { name: /Wholesale sections/ }).count()) === 0);
    await p.goto(`${CONSOLE}/ingrosso/rivenditori`);
    await p.waitForURL((u) => u.pathname === '/ingrosso');
    check('Browser: il vecchio indirizzo porta alla stessa pagina', true);

    await p.goto(`${CONSOLE}/ingrosso?nuovo=rivenditore`);
    const moduloRiv = p.getByRole('dialog', { name: 'New stockist' });
    await moduloRiv.waitFor();
    await moduloRiv.getByLabel('Business name').fill(nomeBr);
    await moduloRiv.getByLabel('Contact').fill('Prova Referente');
    await moduloRiv.getByLabel('Town or city').fill('Milano');
    await moduloRiv.getByLabel('Discount percent').fill('10');
    await moduloRiv.getByLabel('Payment terms').fill('Net 30');
    await moduloRiv.getByLabel('Minimum order').fill('500');
    await foto(p, 'rivenditore-scuro');
    await moduloRiv.getByRole('button', { name: 'Create stockist' }).click();
    const voceRiv = p.locator('.ing-rivenditore').filter({ hasText: nomeBr });
    await voceRiv.waitFor();
    const testoRiv = (await voceRiv.innerText()).replace(/\s+/g, ' ');
    check('Browser: rivenditore creato, con le condizioni nell\'elenco', /10% off/.test(testoRiv) && /Net 30/.test(testoRiv) && /Milano/.test(testoRiv), testoRiv.slice(0, 110));
    check("Browser: l'elenco segnala l'email mancante", /Email missing/.test(testoRiv));

    for (const [titolo, valore] of [[titoloA, '900'], [titoloB, '']]) {
      await p.goto(`${CONSOLE}/ingrosso?nuovo=1`);
      const moduloTr = p.getByRole('dialog', { name: 'New deal' });
      await moduloTr.waitFor();
      await moduloTr.getByLabel('Title').fill(titolo);
      await moduloTr.getByLabel('Stockist').selectOption({ label: nomeBr });
      await moduloTr.getByLabel('Estimated value').fill(valore);
      await moduloTr.getByRole('button', { name: 'Create deal' }).click();
      await moduloTr.waitFor({ state: 'hidden' });
    }
    const colonnaDi = (nome) => p.getByRole('region', { name: nome, exact: true });
    const carta = (titolo) => p.locator('.ing-carta').filter({ hasText: titolo });
    await carta(titoloA).waitFor();
    await carta(titoloB).waitFor();
    const richiesta = colonnaDi('Enquiry').locator('.ing-carta');
    check('Browser: le carte nascono in Enquiry', (await richiesta.filter({ hasText: titoloA }).count()) === 1 && (await richiesta.filter({ hasText: titoloB }).count()) === 1);
    check('Browser: valore assente detto chiaramente', /No estimate/.test(await carta(titoloB).innerText()));
    check('Browser: valore inserito, con il formattatore comune', /900\.00/.test(await carta(titoloA).innerText()));
    check('Browser: la carta mostra rivenditore e città', (await carta(titoloA).innerText()).includes(nomeBr) && (await carta(titoloA).innerText()).includes('Milano'));
    check('Browser: azione nella testata, come nel pannello', await p.locator('.pagina__testa').getByRole('button', { name: 'New deal' }).isVisible());
    check('Browser: un riquadro di totali per colonna', (await p.locator('.ing-riquadro').count()) === 5);
    check('Browser: colonne in ordine', (await p.locator('.ing-colonna h2').allInnerTexts()).join() === 'Enquiry,Negotiation,Samples sent,Agreed,Lost', (await p.locator('.ing-colonna h2').allInnerTexts()).join());

    await carta(titoloB).dragTo(carta(titoloA), { targetPosition: { x: 40, y: 4 } });
    await p.waitForFunction(([a, b]) => {
      const testi = [...document.querySelectorAll('section[aria-label="Enquiry"] .ing-carta')].map((c) => c.innerText);
      return testi.findIndex((t) => t.includes(b)) < testi.findIndex((t) => t.includes(a));
    }, [titoloA, titoloB]);
    // Una sola lettura per confronto: lo schermo cambia subito, il server un attimo dopo.
    const posizioni = async () => {
      const elenco = (await chiama('/admin/ingrosso/trattative', admin)).corpo.trattative ?? [];
      return [titoloB, titoloA].map((titolo) => elenco.find((t) => t.titolo === titolo)?.posizione);
    };
    let posti = await posizioni();
    for (let i = 0; i < 30 && !(posti[0] < posti[1]); i += 1) {
      await p.waitForTimeout(100);
      posti = await posizioni();
    }
    check('Browser: trascinata sopra un\'altra carta, cambia posto sul server', posti[0] < posti[1], `${posti[0]} prima di ${posti[1]}`);

    await carta(titoloA).dragTo(colonnaDi('Agreed'));
    await colonnaDi('Agreed').locator('.ing-carta').filter({ hasText: titoloA }).waitFor();
    await p.waitForTimeout(600);
    check('Browser: trascinata in Agreed, salvato sul server', (await trattativaDi(titoloA))?.fase === 'accordo', (await trattativaDi(titoloA))?.fase);
    await p.reload();
    await colonnaDi('Agreed').locator('.ing-carta').filter({ hasText: titoloA }).waitFor();
    check('Browser: la posizione resta dopo il ricaricamento', true);
    await p.waitForLoadState('networkidle');
    await foto(p, 'bacheca-scuro');
    check('Browser: Wholesale senza italiano', !italiano.test(await testoPagina(p)), (await testoPagina(p)).match(italiano)?.[0]);

    await carta(titoloB).getByRole('button', { name: `Move ${titoloB}` }).click();
    await carta(titoloB).getByRole('button', { name: 'Negotiation' }).click();
    await colonnaDi('Negotiation').locator('.ing-carta').filter({ hasText: titoloB }).waitFor();
    await p.waitForTimeout(600);
    check('Browser: il menu della carta la sposta di colonna', (await trattativaDi(titoloB))?.fase === 'trattativa', (await trattativaDi(titoloB))?.fase);

    await carta(titoloA).locator('.ing-carta__apri').click();
    const dettaglio = p.getByRole('dialog', { name: titoloA });
    await dettaglio.waitFor();
    await dettaglio.getByLabel('New note').fill('Prova: chiede consegna a gennaio');
    await dettaglio.getByRole('button', { name: 'Add note' }).click();
    await dettaglio.getByText('Prova: chiede consegna a gennaio').waitFor();
    check('Browser: nota aggiunta e visibile', true);
    await foto(p, 'trattativa-scuro');

    await dettaglio.getByRole('button', { name: 'Turn into a draft order' }).click();
    const ordine = p.getByRole('dialog', { name: 'Create draft order' });
    await ordine.waitFor();
    await ordine.getByRole('alert').waitFor();
    const spiegazione = await ordine.getByRole('alert').innerText();
    check('Browser: senza email spiega cosa manca e dove si aggiunge', /no email address/.test(spiegazione) && /Add it to their details/.test(spiegazione), spiegazione.replace(/\s+/g, ' ').slice(0, 110));
    await foto(p, 'dati-mancanti-scuro');
    await ordine.getByRole('link', { name: "Open the stockist's details" }).click();
    const schedaRiv = p.getByRole('dialog', { name: nomeBr });
    await schedaRiv.waitFor();
    check('Browser: il collegamento apre la scheda del rivenditore', (await p.getByRole('dialog').count()) === 1);
    const emailBr = `prova-ingrosso-browser-${stamp}@multioutfit.test`;
    await schedaRiv.getByLabel('Email').fill(emailBr);
    await schedaRiv.getByRole('button', { name: 'Save changes' }).click();
    await schedaRiv.waitFor({ state: 'hidden' });

    await carta(titoloA).locator('.ing-carta__apri').click();
    await dettaglio.getByRole('button', { name: 'Turn into a draft order' }).click();
    await ordine.getByRole('button', { name: 'Create draft order' }).waitFor();
    check('Browser: con i dati completi compare il modulo, con le condizioni', /10% off/.test(await ordine.innerText()) && /Net 30/.test(await ordine.innerText()));

    const articolo = ordine.getByLabel('Item').first();
    const risposta = p.waitForResponse((r) => r.url().includes('/admin/ingrosso/varianti') && r.url().includes('Cloudpeak') && r.ok());
    await articolo.fill('Cloudpeak');
    const varianteBr = (await (await risposta).json()).varianti.find((v) => v.prezzo > 0);
    await articolo.fill(varianteBr.titolo);
    await ordine.getByLabel('Quantity').first().fill('2');
    const atteso = Math.round(varianteBr.prezzo * 0.9 * 100) / 100;
    check('Browser: scelto dal catalogo, il prezzo parte dal listino meno lo sconto', Number(await ordine.getByLabel('Unit price').first().inputValue()) === atteso, `${await ordine.getByLabel('Unit price').first().inputValue()} su ${varianteBr.prezzo}`);
    await ordine.getByRole('button', { name: 'Add a line' }).click();
    await ordine.getByLabel('Item').nth(1).fill('Prova lotto libero');
    await ordine.getByLabel('Quantity').nth(1).fill('1');
    await ordine.getByLabel('Unit price').nth(1).fill('10');
    await ordine.getByText('below the agreed minimum order').waitFor();
    check("Browser: sotto l'ordine minimo avvisa senza bloccare", await ordine.getByRole('button', { name: 'Create draft order' }).isEnabled());
    await foto(p, 'ordine-scuro');
    await ordine.getByRole('button', { name: 'Create draft order' }).click();
    await ordine.waitFor({ state: 'hidden' });
    await carta(titoloA).getByText('Draft order').waitFor();
    const totaleAtteso = Math.round((atteso * 2 + 10) * 100) / 100;
    const bozzaBr = ((await chiama('/admin/draft-orders?limit=100&fields=id,email,total,metadata,*items', admin)).corpo.draft_orders ?? []).find((d) => d.email === emailBr);
    if (bozzaBr) daPulire.bozze.push(bozzaBr.id);
    check('Browser: la bozza è arrivata davvero in /admin/draft-orders', bozzaBr?.items?.length === 2 && bozzaBr?.total === totaleAtteso, `totale ${bozzaBr?.total}, atteso ${totaleAtteso}`);
    await dettaglio.getByRole('button', { name: 'Close' }).click();
    await foto(p, 'bacheca-bozza-scuro');

    await p.getByLabel('Search stockists').fill(nomeBr);
    await p.waitForFunction(() => document.querySelectorAll('.ing-rivenditore').length === 1);
    check('Browser: ricerca fra i rivenditori', true);

    const chiara = await nuovaPagina({ colorScheme: 'light' });
    await accediAdminBrowser(chiara);
    await chiara.goto(`${CONSOLE}/ingrosso`);
    await chiara.locator('.ing-carta').filter({ hasText: titoloA }).waitFor();
    await chiara.waitForLoadState('networkidle');
    check('Browser: tema chiaro attivo', (await chiara.evaluate(() => document.documentElement.dataset.tema)) === 'chiaro');
    await foto(chiara, 'bacheca-chiaro');

    const telefono = await nuovaPagina({ viewport: { width: 390, height: 844 } });
    await accediAdminBrowser(telefono);
    await telefono.goto(`${CONSOLE}/ingrosso`);
    const cartaTel = telefono.locator('.ing-carta').filter({ hasText: titoloB });
    await cartaTel.waitFor();
    await telefono.waitForLoadState('networkidle');
    check('Browser: Wholesale a 390 px senza scorrimento laterale', await senzaScorrimento(telefono));
    await cartaTel.getByRole('button', { name: `Move ${titoloB}` }).click();
    check('Browser: il menu della carta resta dentro lo schermo', await senzaScorrimento(telefono));
    await foto(telefono, 'menu-telefono');
    await cartaTel.getByRole('button', { name: 'Samples sent' }).click();
    await telefono.getByRole('region', { name: 'Samples sent', exact: true }).locator('.ing-carta').filter({ hasText: titoloB }).waitFor();
    await telefono.waitForTimeout(600);
    check('Browser: spostata dal telefono, salvato sul server', (await trattativaDi(titoloB))?.fase === 'campione', (await trattativaDi(titoloB))?.fase);
    await foto(telefono, 'bacheca-telefono');
    await telefono.locator('.ing-carta').filter({ hasText: titoloA }).locator('.ing-carta__apri').click();
    await telefono.getByRole('dialog', { name: titoloA }).waitFor();
    check('Browser: scheda della trattativa a 390 px senza scorrimento laterale', await senzaScorrimento(telefono));
    await foto(telefono, 'trattativa-telefono');

    check('Browser: nessun errore nella pagina', errori.length === 0, errori[0]?.slice(0, 160));
  } catch (errore) {
    check('Browser: passaggio completo', false, errore.message.split('\n')[0].slice(0, 200));
  } finally {
    await raccogli();
    await browser.close();
  }
}

// PULIZIA
for (const id of daPulire.bozze) await chiama(`/admin/draft-orders/${id}`, admin, { metodo: 'DELETE' });
const clienti = (await chiama(`/admin/customers?q=${stamp}&limit=10`, admin)).corpo.customers ?? [];
for (const cliente of clienti) await chiama(`/admin/customers/${cliente.id}`, admin, { metodo: 'DELETE' });
for (const id of daPulire.trattative) await chiama(`/admin/ingrosso/trattative/${id}`, admin, { metodo: 'DELETE' });
for (const id of daPulire.rivenditori) await chiama(`/admin/ingrosso/rivenditori/${id}`, admin, { metodo: 'DELETE' });
const squadra = (await chiama('/admin/team', admin)).corpo;
for (const email of daPulire.persone) {
  const persona = squadra.collaboratori?.find((c) => c.email === email);
  if (persona) await chiama(`/admin/team/${persona.id}`, admin, { metodo: 'DELETE' });
}
const restanti = (await chiama(`/admin/ingrosso/rivenditori?q=${stamp}`, admin)).corpo.conteggio;
check('Pulizia: nessun rivenditore di prova rimasto', restanti === 0, `${restanti}`);

chiudi('ingrosso funzionante');
