// Fasi di base: residui delle prove, negozio, spedizioni, prodotti, collezioni, clienti e gruppi.
import { casuale, chiama, deve, giorniFa, racconta, sql } from './comune.mjs';
import { creaClienti, GRUPPI } from './dati-clienti.mjs';
import { NEGOZIO, SPEDIZIONI } from './dati-negozio.mjs';
import { COLLEZIONI, eanDi, PRODOTTI } from './dati-prodotti.mjs';

const VOLUTI = PRODOTTI.map((p) => p.handle);
const RICARICO_LISTINO = 1.08;

/** Solo clienti con email «prova…» e ordini aperti con la stessa email: si annullano, non si eliminano. */
export async function residui({ admin }) {
  const ordini = sql(`select id from "order" where deleted_at is null and status = 'pending' and email ilike 'prova%'`).map(([id]) => id);
  for (const id of ordini) {
    const esito = await chiama(`/admin/ordini/${id}/annulla`, admin, { corpo: {} });
    racconta(`ordine di prova ${id}: ${esito.stato === 200 ? 'annullato' : `non annullato (${esito.stato})`}`);
  }
  const proveClienti = sql(`select id from customer where deleted_at is null and email ilike 'prova%'`).map(([id]) => id);
  for (const id of proveClienti) await chiama(`/admin/clienti/${id}`, admin, { metodo: 'DELETE' });
  racconta(`residui: ${ordini.length} ordini annullati, ${proveClienti.length} clienti eliminati`);
}

export async function negozio({ r, admin, salva }) {
  const { negozio: attuale } = await deve('/admin/impostazioni', admin);
  const { stores } = await deve('/admin/stores?fields=id,name,metadata', admin);
  const [store] = stores;
  r.negozio ??= { id: store.id, nome: store.name, metadata: store.metadata ?? null, impostazioni: attuale };
  salva();
  await deve('/admin/impostazioni/negozio', admin, {
    corpo: { ...NEGOZIO, valuta: attuale.valuta, fuso: attuale.fuso, prezzi_con_iva: attuale.prezzi_con_iva },
  });
  racconta('negozio: nome e contatti scritti');
}

export async function spedizioni({ r, admin, salva }) {
  const { regole, opzioni } = await deve('/admin/impostazioni/spedizioni', admin);
  r.spedizioni ??= { giorni_max_evasione: regole.giorni_max_evasione ?? null, opzioni: Object.fromEntries(opzioni.map((o) => [o.id, { nome: o.nome, tariffa: o.tariffa, soglia_gratuita: o.soglia_gratuita, attiva: o.attiva }])) };
  salva();
  for (const o of opzioni) {
    const nome = SPEDIZIONI.nomi[o.tipo];
    if (!nome) continue;
    await deve(`/admin/impostazioni/spedizioni/opzioni/${o.id}`, admin, { corpo: { nome, tariffa: o.tariffa, soglia_gratuita: SPEDIZIONI.soglia_gratuita, attiva: o.attiva } });
  }
  await deve('/admin/impostazioni/spedizioni', admin, { corpo: { giorni_max_evasione: SPEDIZIONI.giorni_max_evasione } });
  racconta(`spedizioni: ${opzioni.length} opzioni`);
}

/** Riempie la scheda e i prezzi: gli originali restano nel registro per poterli rimettere. */
export async function prodotti({ r, admin, salva }) {
  const { product_categories: categorie } = await deve('/admin/product-categories?limit=100&fields=id,handle', admin);
  const idCategoria = new Map(categorie.map((c) => [c.handle, c.id]));
  const righe = sql(`select id, handle from product where deleted_at is null and handle in (${VOLUTI.map((h) => `'${h}'`).join(',')})`);
  const perHandle = new Map(righe.map(([id, handle]) => [handle, id]));

  for (const [indice, voce] of PRODOTTI.entries()) {
    const id = perHandle.get(voce.handle);
    if (!id) {
      racconta(`prodotto assente: ${voce.handle}`);
      continue;
    }
    if (r.prodotti[id]?.fatto) continue;
    const { prodotto: scheda } = await deve(`/admin/catalogo/prodotti/${id}`, admin);
    const { product } = await deve(`/admin/products/${id}?fields=id,metadata,material,weight,*categories`, admin);
    r.prodotti[id] ??= {
      handle: voce.handle,
      originale: { metadata: product.metadata ?? null, material: product.material ?? null, weight: product.weight ?? null, categorie: (product.categories ?? []).map((c) => c.id) },
      varianti: {},
    };
    salva();

    const categoria = idCategoria.get(voce.categoria);
    await deve(`/admin/products/${id}`, admin, {
      corpo: {
        material: voce.composizione,
        weight: voce.peso,
        ...(categoria ? { categories: [{ id: categoria }] } : {}),
        metadata: { ...(product.metadata ?? {}), brand: voce.brand, stagione: voce.stagione, genere: voce.genere, cura: voce.cura, seo_titolo: voce.seo_titolo, seo_descrizione: voce.seo_descrizione, demo: true },
      },
    });

    for (const [i, variante] of scheda.varianti.entries()) {
      const offerte = variante.offerte ?? [];
      r.prodotti[id].varianti[variante.id] ??= {
        ean: variante.ean ?? null,
        offerte: Object.fromEntries(offerte.map((o) => [o.id, { prezzo: o.prezzo, prezzo_cessione: o.prezzo_cessione ?? null, prezzo_consigliato: o.prezzo_consigliato ?? null, scorte: o.scorte, depositi: o.depositi }])),
      };
      salva();
      await deve(`/admin/catalogo/prodotti/${id}/varianti/${variante.id}`, admin, {
        corpo: {
          ean: eanDi(indice, i),
          offerte: offerte
            .filter((o) => o.prezzo !== null)
            .map((o) => ({ id: o.id, prezzo_cessione: Math.round(o.prezzo * voce.cessione * 100) / 100, prezzo_consigliato: Math.round(o.prezzo * RICARICO_LISTINO) })),
        },
      });
    }
    r.prodotti[id].fatto = true;
    salva();
    racconta(`prodotto ${voce.handle}: ${scheda.varianti.length} varianti`);
  }
}

/** Scorte verosimili al posto del milione del seed, con qualche taglia bassa o esaurita. Si fa dopo gli ordini. */
export async function scorte({ r, admin, salva }) {
  const rng = casuale(9031);
  for (const [id, voce] of Object.entries(r.prodotti)) {
    if (voce.scorte_fatte) continue;
    const varianti = Object.entries(voce.varianti);
    for (const [posizione, [varianteId, dati]] of varianti.entries()) {
      const offerte = Object.entries(dati.offerte).filter(([, o]) => o.depositi === 1);
      const ultima = posizione === varianti.length - 1;
      const quantita = (i) => {
        const tiro = rng.prossimo();
        if (ultima && i === 0 && tiro < 0.5) return 0;
        if (ultima || tiro < 0.14) return rng.intero(1, 6);
        return rng.intero(14, 96);
      };
      if (!offerte.length) continue;
      await deve(`/admin/catalogo/prodotti/${id}/varianti/${varianteId}`, admin, { corpo: { offerte: offerte.map(([offerta], i) => ({ id: offerta, quantita: quantita(i) })) } });
    }
    voce.scorte_fatte = true;
    salva();
    racconta(`scorte di ${voce.handle}`);
  }
}

export async function collezioni({ r, admin, salva }) {
  const presenti = (await deve('/admin/collections?limit=100&fields=id,handle,title,metadata', admin)).collections;
  const prodottiPerHandle = new Map(sql(`select handle, id from product where deleted_at is null`));
  for (const c of COLLEZIONI) {
    const adottata = presenti.find((p) => p.handle === c.chiave && p.metadata?.demo);
    let id = r.collezioni[c.chiave] ?? adottata?.id;
    if (!id) {
      const { collection } = await deve('/admin/collections', admin, {
        corpo: { title: c.titolo, handle: c.chiave, metadata: { descrizione: c.descrizione, visibile: c.visibile, demo: true } },
      });
      id = collection.id;
    }
    r.collezioni[c.chiave] = id;
    salva();
    const contenuti = PRODOTTI.filter((p) => p.collezione === c.chiave).map((p) => prodottiPerHandle.get(p.handle)).filter(Boolean);
    await deve(`/admin/collections/${id}/products`, admin, { corpo: { add: contenuti } });
  }
  racconta(`collezioni: ${Object.keys(r.collezioni).length}`);
}

export async function clienti({ r, admin, salva, ancora }) {
  const esistenti = new Map(sql(`select email, id from customer where deleted_at is null and email like '%example.test'`));
  for (const c of creaClienti()) {
    if (r.clienti[c.email]?.indirizzo) continue;
    let id = r.clienti[c.email]?.id ?? esistenti.get(c.email);
    if (!id) {
      const { customer } = await deve('/admin/customers', admin, {
        corpo: {
          email: c.email,
          first_name: c.nome,
          last_name: c.cognome,
          company_name: c.azienda ?? undefined,
          phone: c.telefono,
          metadata: {
            demo: true,
            newsletter: c.newsletter,
            newsletter_data: c.newsletter ? giorniFa(ancora, c.giorni_iscrizione).toISOString() : null,
            rivenditore: c.rivenditore,
            citta: c.citta,
            tag: c.etichette,
            note: c.nota,
          },
        },
      });
      id = customer.id;
    }
    r.clienti[c.email] = { id };
    salva();
    await deve(`/admin/clienti/${id}/indirizzi`, admin, {
      corpo: { etichetta: 'Home', nome: c.nome, cognome: c.cognome, azienda: c.azienda ?? undefined, indirizzo: c.via, citta: c.citta, cap: c.cap, paese: c.paese, telefono: c.telefono, predefinito_spedizione: true, predefinito_fatturazione: true },
    });
    r.clienti[c.email].indirizzo = true;
    salva();
  }
  racconta(`clienti: ${Object.keys(r.clienti).length}`);
}

export async function gruppi({ r, admin, salva }) {
  const lista = creaClienti();
  const { gruppi: presenti = [] } = await deve('/admin/clienti/gruppi', admin);
  for (const g of GRUPPI) {
    let id = r.gruppi[g.chiave]?.id ?? presenti.find((p) => p.nome === g.nome)?.id;
    if (!id) id = (await deve('/admin/clienti/gruppi', admin, { corpo: { nome: g.nome } })).id;
    r.gruppi[g.chiave] = { id, nome: g.nome };
    salva();
    const aggiungi = lista.filter(g.scelta).map((c) => r.clienti[c.email]?.id).filter(Boolean);
    if (aggiungi.length) await deve(`/admin/clienti/gruppi/${id}/clienti`, admin, { corpo: { aggiungi } });
  }
  racconta(`gruppi: ${Object.keys(r.gruppi).length}`);
}
