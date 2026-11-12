// Fasi delle sezioni: vetrina, sconti, rivenditori, carte, proposte, outfit, assistenza, marketing e traffico.
import { accediAzienda, casuale, chiama, deve, giorniFa, racconta, sql, traGiorni } from './comune.mjs';
import { AUTOMAZIONI, CAMPAGNE, CAMPAGNE_DIMOSTRATIVE, CARTE, OUTFIT, PROPOSTE, PROPOSTE_PREZZI, RICHIESTE, RISULTATI_OUTFIT, RIVENDITORI, SCONTI, SPUNTO, TRATTATIVE } from './dati-sezioni.mjs';
import { FONTI_TRAFFICO, PAGINE, PAGINE_TRAFFICO, VETRINA, VISITATORI_PER_CITTA, VISTE_PAGINE } from './dati-negozio.mjs';

const MESE = 30;

export async function vetrina({ r, admin, salva }) {
  const { vetrina: attuale, pagine } = await deve('/admin/negozio-online', admin);
  r.vetrina ??= { testata: attuale.testata, annuncio: attuale.annuncio, accento: attuale.accento, messaggio: attuale.messaggio };
  salva();
  await deve('/admin/negozio-online', admin, { corpo: VETRINA });
  for (const p of PAGINE) {
    if (r.pagine[p.percorso]) continue;
    const presente = pagine.find((x) => x.percorso === p.percorso);
    r.pagine[p.percorso] = presente?.id ?? (await deve('/admin/negozio-online/pagine', admin, { corpo: p })).pagina?.id;
    salva();
  }
  racconta(`vetrina: ${Object.keys(r.pagine).length} pagine`);
}

export async function sconti({ r, admin, salva, ancora }) {
  const data = (giorni) => (giorni === undefined ? undefined : traGiorni(ancora, giorni).toISOString());
  for (const s of SCONTI) {
    if (r.sconti[s.codice]) continue;
    const corpo = { codice: s.codice, descrizione: s.descrizione, tipo: s.tipo, ...(s.valore ? { valore: s.valore } : {}), ...(s.limite_usi ? { limite_usi: s.limite_usi } : {}), ...(s.inizio !== undefined ? { inizio: data(s.inizio) } : {}), ...(s.fine !== undefined ? { fine: data(s.fine) } : {}), attivo: s.attivo ?? true };
    const risposta = await chiama('/admin/sconti/codici', admin, { corpo });
    if (risposta.stato === 400 && /already exists/.test(JSON.stringify(risposta.corpo))) {
      const { codici } = await deve(`/admin/sconti/codici?q=${s.codice}`, admin);
      r.sconti[s.codice] = codici.find((c) => c.codice === s.codice)?.id;
    } else if (risposta.stato >= 400) {
      throw new Error(`sconto ${s.codice}: ${JSON.stringify(risposta.corpo)}`);
    } else {
      r.sconti[s.codice] = risposta.corpo.codice.id;
    }
    salva();
  }
  racconta(`sconti: ${Object.keys(r.sconti).length}`);
}

export async function ingrosso({ r, admin, salva }) {
  const { rivenditori: presenti } = await deve('/admin/ingrosso/rivenditori', admin);
  for (const { chiave, ...dati } of RIVENDITORI) {
    r.rivenditori[chiave] ??= presenti.find((p) => p.nome === dati.nome)?.id ?? (await deve('/admin/ingrosso/rivenditori', admin, { corpo: dati })).rivenditore.id;
    salva();
  }
  const { trattative: giaLa } = await deve('/admin/ingrosso/trattative', admin);
  for (const t of TRATTATIVE) {
    if (r.trattative[t.chiave]?.note) continue;
    const id = r.trattative[t.chiave]?.id ?? giaLa.find((x) => x.titolo === t.titolo)?.id ?? (await deve('/admin/ingrosso/trattative', admin, { corpo: { titolo: t.titolo, rivenditore_id: r.rivenditori[t.rivenditore], unita: t.unita, valore_stimato: t.valore_stimato, fase: t.fase } })).trattativa.id;
    r.trattative[t.chiave] = { id };
    salva();
    for (const testo of t.note) await deve(`/admin/ingrosso/trattative/${id}/note`, admin, { corpo: { testo } });
    r.trattative[t.chiave].note = true;
    salva();
  }
  racconta(`ingrosso: ${Object.keys(r.rivenditori).length} rivenditori, ${Object.keys(r.trattative).length} trattative`);
}

export async function carte({ r, admin, salva, ancora }) {
  for (const c of CARTE) {
    if (r.carte[c.chiave]?.finita) continue;
    let id = r.carte[c.chiave]?.id;
    if (!id) {
      const { carta } = await deve('/admin/carte-regalo', admin, {
        corpo: { importo: c.importo, destinatario_nome: c.nome, destinatario_email: c.email, nota: c.nota, ...(c.scadenza ? { scadenza: traGiorni(ancora, c.scadenza).toISOString() } : {}) },
      });
      id = carta.id;
      r.carte[c.chiave] = { id };
      salva();
    }
    for (const [importo, nota] of c.spesa ?? []) await deve(`/admin/carte-regalo/${id}/movimenti`, admin, { corpo: { importo, nota } });
    if (c.gelata) await deve(`/admin/carte-regalo/${id}/blocco`, admin, { corpo: { congelata: true } });
    if (c.annullata) await deve(`/admin/carte-regalo/${id}/annulla`, admin, { corpo: { motivo: c.annullata } });
    r.carte[c.chiave].finita = true;
    salva();
  }
  racconta(`carte regalo: ${Object.keys(r.carte).length}`);
}

export async function proposte({ r, admin, salva, ancora }) {
  for (const p of PROPOSTE) {
    if (r.proposte[p.chiave]?.finita) continue;
    const azienda = await accediAzienda(p.azienda);
    let id = r.proposte[p.chiave]?.id;
    if (!id) {
      const { proposta } = await deve('/vendor/sconti/proposte', azienda, {
        corpo: { titolo: p.titolo, tipo: p.tipo, valore: p.valore, inizio: traGiorni(ancora, p.inizio).toISOString(), fine: traGiorni(ancora, p.fine).toISOString(), motivo: p.motivo },
      });
      id = proposta.id;
      r.proposte[p.chiave] = { id };
      salva();
    }
    if (p.esito === 'approva') {
      const { proposta } = await deve(`/admin/sconti/proposte/${id}/approva`, admin, { corpo: { codice: p.codice, nota: p.nota } });
      r.proposte[p.chiave].promozione = proposta.promozione_id ?? proposta.sconto?.id ?? null;
    }
    if (p.esito === 'rifiuta') await deve(`/admin/sconti/proposte/${id}/rifiuta`, admin, { corpo: { nota: p.nota } });
    r.proposte[p.chiave].finita = true;
    salva();
  }
  for (const p of PROPOSTE_PREZZI) {
    if (r.proposte_prezzi[p.azienda]) continue;
    const azienda = await accediAzienda(p.azienda);
    const { prodotti: propri } = await deve('/vendor/sconti/prodotti', azienda);
    const voluti = new Set(Object.keys(r.prodotti));
    const scelto = propri.find((x) => voluti.has(x.id) && !Object.values(r.proposte_prezzi).some((v) => v.prodotto === x.id));
    if (!scelto) continue;
    const { prodotto } = await deve(`/vendor/catalogo/prodotti/${scelto.id}`, azienda);
    await deve(`/vendor/catalogo/prodotti/${scelto.id}`, azienda, {
      corpo: { prezzo_cessione: Math.round((prodotto.prezzo_cessione ?? 40) * p.fattore * 100) / 100, prezzo_consigliato: Math.round((prodotto.prezzo_consigliato ?? 80) * p.fattore) },
    });
    r.proposte_prezzi[p.azienda] = { prodotto: scelto.id, azienda: azienda.azienda };
    salva();
  }
  racconta(`proposte: ${Object.keys(r.proposte).length} di sconto, ${Object.keys(r.proposte_prezzi).length} di prezzo`);
}

export async function outfit({ r, admin, salva }) {
  const coppie = new Map();
  for (const [handle, id, azienda] of sql(`select p.handle, p.id, o.seller_id from product p join offer o on o.product_id = p.id where p.deleted_at is null and o.deleted_at is null group by 1,2,3 order by 1,3`)) {
    if (!coppie.has(handle)) coppie.set(handle, { id, azienda });
  }
  for (const o of OUTFIT) {
    if (r.outfit[o.chiave]?.finito) continue;
    const id = r.outfit[o.chiave]?.id ?? (await deve('/admin/outfit', admin, { corpo: { nome: o.nome, descrizione: o.descrizione } })).outfit.id;
    r.outfit[o.chiave] = { id };
    salva();
    const capi = o.capi.map((handle, i) => ({ product_id: coppie.get(handle).id, azienda_id: coppie.get(handle).azienda, x: 8 + i * 42, y: 12 + i * 28, larghezza: 44, livello: i }));
    await deve(`/admin/outfit/${id}`, admin, { corpo: { capi } });
    if (o.modalita === 'fisso') {
      const { outfit: letto } = await deve(`/admin/outfit/${id}`, admin);
      const somma = letto.prezzo?.somma ?? null;
      if (somma) await deve(`/admin/outfit/${id}`, admin, { corpo: { modalita_prezzo: 'fisso', prezzo_fisso: Math.round(somma * o.sconto), sconto_a_carico: 'negozio', quota_negozio: 100 } });
    }
    if (o.stato !== 'bozza') {
      const esito = await chiama(`/admin/outfit/${id}/stato`, admin, { corpo: { stato: o.stato === 'archiviato' ? 'archiviato' : 'pubblicato' } });
      if (esito.stato >= 400) racconta(`outfit ${o.nome}: ${JSON.stringify(esito.corpo).slice(0, 200)}`);
    }
    r.outfit[o.chiave].finito = true;
    salva();
  }
  racconta(`outfit: ${Object.keys(r.outfit).length}`);
}

export async function assistenza({ r, admin, salva }) {
  for (const t of RICHIESTE) {
    if (r.richieste[t.chiave]?.finita) continue;
    const azienda = t.azienda ? await accediAzienda(t.azienda) : null;
    const percorso = azienda ? '/vendor/assistenza/richieste' : '/admin/assistenza/richieste';
    const id = r.richieste[t.chiave]?.id ?? (await deve(percorso, azienda ?? admin, { corpo: { oggetto: t.oggetto, categoria: t.categoria, testo: t.testo } })).richiesta.id;
    r.richieste[t.chiave] = { id };
    salva();
    for (const [i, testo] of t.risposte.entries()) {
      const dallAzienda = i % 2 === 1 && azienda;
      await deve(`${dallAzienda ? '/vendor' : '/admin'}/assistenza/richieste/${id}/messaggi`, dallAzienda ? azienda : admin, { corpo: { testo } });
    }
    await deve(`/admin/assistenza/richieste/${id}/stato`, admin, { corpo: { stato: t.stato } });
    r.richieste[t.chiave].finita = true;
    salva();
  }
  racconta(`assistenza: ${Object.keys(r.richieste).length}`);
}

export async function marketing({ r, admin, salva, ancora }) {
  const { automazioni: regole } = await deve('/admin/marketing/automazioni', admin);
  for (const [chiave, a] of Object.entries(AUTOMAZIONI)) {
    const attuale = regole.find((x) => x.chiave === chiave);
    if (!attuale) continue;
    r.automazioni[chiave] ??= { attiva: attuale.attiva, oggetto: attuale.oggetto, testo: attuale.testo };
    salva();
    await deve(`/admin/marketing/automazioni/${chiave}`, admin, { corpo: { oggetto: a.oggetto, testo: a.testo, ...(a.attiva && !attuale.bloccata ? { attiva: true } : {}) } });
  }
  for (const k of CAMPAGNE) {
    if (r.campagne[k.chiave]?.finita) continue;
    const id = r.campagne[k.chiave]?.id ?? (await deve('/admin/marketing/campagne', admin, { corpo: { nome: k.nome, oggetto: k.oggetto, testo: k.testo, pubblico: k.pubblico } })).campagna.id;
    r.campagne[k.chiave] = { id };
    salva();
    if (k.stato === 'programmata') await deve(`/admin/marketing/campagne/${id}/programma`, admin, { corpo: { quando: traGiorni(ancora, k.tra_giorni).toISOString() } });
    r.campagne[k.chiave].finita = true;
    salva();
  }
  racconta(`marketing: ${Object.keys(r.campagne).length} campagne vere`);
}

/** Visite giornaliere: crescono nell'anno, salgono nel fine settimana, con un po' di rumore. */
function serieVisite(ancora, rng) {
  const visite = [];
  for (let eta = 430; eta >= 0; eta -= 1) {
    const data = giorniFa(ancora, eta);
    const settimana = data.getUTCDay();
    const base = 180 + (430 - eta) * 0.42;
    const onda = 1 + 0.16 * Math.sin((eta / 365) * 2 * Math.PI);
    const fine = settimana === 0 || settimana === 6 ? 1.26 : 1;
    visite.push({ data: data.toISOString().slice(0, 10), visite: Math.round(base * onda * fine * (0.86 + rng.prossimo() * 0.28)) });
  }
  return visite.slice(MESE).map((g, i) => ({ ...g, precedenti: visite[i].visite }));
}

/** Sette righe da lunedì, otto colonne dalle 8 alle 22: mattina tranquilla, picco dopo cena, sabato pieno. */
function orarioVisite(rng) {
  const fasce = [0.45, 0.7, 0.85, 0.75, 0.8, 1, 1.25, 0.8];
  const giorni = [0.9, 0.86, 0.92, 0.95, 1.05, 1.34, 1.2];
  return giorni.map((g) => fasce.map((f) => Math.round(36 * g * f * (0.9 + rng.prossimo() * 0.2))));
}

function serieOutfit(rng, vendite) {
  const media = vendite / 30;
  return Array.from({ length: 14 }, () => Math.round(media * (0.4 + rng.prossimo() * 1.6)));
}

/** Blocchi senza fonte reale, nella forma di `.scratch/ishtar-lab/DEMO-METADATA.md`. */
export async function traffico({ admin, ancora }) {
  const rng = casuale(7741);
  const giorni = serieVisite(ancora, rng);
  const ultimi = giorni.slice(-MESE).reduce((s, g) => s + g.visite, 0);
  const conversioni = Array.from({ length: 14 }, () => Math.round((0.023 + rng.prossimo() * 0.007) * 10000) / 10000);
  const demo = {
    versione: 1,
    generato_il: ancora.toISOString(),
    adesso: { visitatori: 18, carrello: 6, cassa: 2, andamento: [11, 13, 12, 15, 14, 16, 18, 17, 19, 16, 17, 18] },
    conversione: { valore: conversioni.at(-1), precedente: conversioni[6], serie: conversioni },
    spunto: SPUNTO,
    traffico: {
      giorni,
      carrello: { valore: 0.094, precedente: 0.089 },
      ore: orarioVisite(rng),
      fonti: FONTI_TRAFFICO.map(([nome, quota]) => ({ nome, visite: Math.round(ultimi * quota) })),
      pagine: PAGINE_TRAFFICO.map(([titolo, percorso, quota]) => ({ titolo, percorso, visite: Math.round(ultimi * 0.74 * quota) })),
    },
    campagne: CAMPAGNE_DIMOSTRATIVE.map(({ giorni_fa, ...c }) => ({ ...c, quando: giorniFa(ancora, giorni_fa).toISOString() })),
    automazioni: { benvenuto: { inviate: AUTOMAZIONI.benvenuto.inviate, incasso: AUTOMAZIONI.benvenuto.incasso } },
    outfit: Object.fromEntries(Object.entries(RISULTATI_OUTFIT).map(([nome, dati]) => [nome, { ...dati, serie: serieOutfit(rng, dati.vendite) }])),
    visite: { citta: VISITATORI_PER_CITTA.map(([nome, visitatori]) => ({ nome, visitatori })), pagine: VISTE_PAGINE },
  };
  // Medusa sostituisce i metadati interi: si legge, si unisce e si riscrive.
  const { stores } = await deve('/admin/stores?fields=id,metadata', admin);
  const [store] = stores;
  await deve(`/admin/stores/${store.id}`, admin, { corpo: { metadata: { ...(store.metadata ?? {}), demo } } });
  racconta(`traffico: ${giorni.length} giorni, ${demo.campagne.length} campagne dimostrative`);
}
