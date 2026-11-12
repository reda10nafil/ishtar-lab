import type { MedusaContainer } from "@medusajs/framework/types"
import { appartiene, leggiUnici } from "../../ordini/lib/unico"
import { CANALI, clientiDiRitorno, contabili, nelPeriodo, perProdotto, perSecchio, totali, unitaDi, variazione } from "./calcoli"
import { leggiAttivita } from "./attivita"
import { inizioStorico, negozio } from "./contesto"
import { conversioneDi, leggiDemo } from "./demo"
import { finestra, PERIODI_PANORAMICA, type Finestra } from "./periodi"
import { leggiOrdini, type Ordine } from "./ordini"

const DA_PREPARARE = new Set(["not_fulfilled", "partially_fulfilled"])
const QUANTI_IN_CODA = 6
const QUANTI_MIGLIORI = 5

const assi = (f: Finestra) => f.secchi.map((s) => ({ chiave: s.chiave, etichetta: s.etichetta, dettaglio: s.dettaglio, futuro: s.futuro }))

function venditePer(ordini: Ordine[], f: Finestra) {
  const attuali = nelPeriodo(ordini, f)
  const prima = nelPeriodo(ordini, f.precedente)
  const totale = totali(attuali).vendite
  const precedente = totali(prima).vendite
  return {
    totale,
    precedente,
    variazione: variazione(totale, precedente),
    assi: assi(f),
    canali: CANALI.map((c) => {
      const propri = attuali.filter((o) => o.canale === c.id)
      return {
        ...c,
        totale: totali(propri).vendite,
        precedente: totali(prima.filter((o) => o.canale === c.id)).vendite,
        valori: perSecchio(propri, f.secchi, (g) => totali(g).vendite),
      }
    }),
  }
}

function unitaPer(ordini: Ordine[], f: Finestra) {
  const attuali = nelPeriodo(ordini, f)
  const totale = totali(attuali).unita
  const precedente = totali(nelPeriodo(ordini, f.precedente)).unita
  return { totale, precedente, variazione: variazione(totale, precedente), assi: assi(f), valori: perSecchio(attuali, f.secchi, (g) => totali(g).unita) }
}

const indicatore = (valore: number | null, precedente: number | null, serie: (number | null)[]) => ({
  valore,
  precedente,
  variazione: valore === null ? null : variazione(valore, precedente),
  serie: serie.map((v) => v ?? 0),
})

/** Per l'azienda: solo gli ordini propri, senza nomi né importi. */
function codaAzienda(ordini: Ordine[]) {
  const aperti = ordini.filter((o) => o.stato === "pending" || o.stato === "requires_action")
  const daPreparare = aperti.filter((o) => DA_PREPARARE.has(o.stato_evasione ?? ""))
  return {
    da_preparare: daPreparare.length,
    pronti: aperti.filter((o) => o.stato_evasione === "fulfilled").length,
    voci: aperti.filter((o) => DA_PREPARARE.has(o.stato_evasione ?? "") || o.stato_evasione === "fulfilled").slice(0, QUANTI_IN_CODA).map((o) => ({
      id: o.id,
      numero: o.numero,
      cliente: null,
      quando: o.creato_il.toISOString(),
      pagato: true,
      preparato: o.stato_evasione === "fulfilled",
      richieste: [{ ordine: o.id, azienda: o.azienda_id ?? "" }],
      totale: null,
      unita: unitaDi(o),
      righe: o.righe.slice(0, 3).map((r) => ({ titolo: r.titolo, miniatura: r.miniatura })),
    })),
  }
}

type Vede = { vendite: boolean; clienti: boolean; coda: boolean; registro: boolean }

/** Solo le parti che il ruolo può leggere: il resto non esce dal server. */
export async function panoramicaAdmin(scope: MedusaContainer, vede: Vede) {
  const adesso = new Date()
  const { fuso, obiettivo, valuta, nome } = await negozio(scope)
  const [ordini, unici, demo, attivita] = await Promise.all([
    leggiOrdini(scope, { da: inizioStorico(adesso, fuso) }),
    leggiUnici(scope),
    leggiDemo(scope),
    vede.registro ? leggiAttivita(scope) : null,
  ])
  const validi = contabili(ordini, valuta)
  const recentiPrima = unici.filter((u) => !u.annullato).sort((a, b) => new Date(b.creato_il).getTime() - new Date(a.creato_il).getTime())
  const inCoda = recentiPrima.filter((u) => appartiene(u, "da_preparare"))
  const pronti = recentiPrima.filter((u) => appartiene(u, "preparati"))
  const aperti = recentiPrima.filter((u) => appartiene(u, "da_preparare") || appartiene(u, "preparati"))
  const settimana = finestra("7g", adesso, fuso)
  const oggi = finestra("oggi", adesso, fuso)
  const quindici = finestra("14g", adesso, fuso)
  const correnti = totali(nelPeriodo(validi, settimana))
  const prima = totali(nelPeriodo(validi, settimana.precedente))
  const ritorno = clientiDiRitorno(validi, settimana)
  const ritornoPrima = clientiDiRitorno(validi, settimana.precedente)
  const diOggi = totali(nelPeriodo(validi, oggi))
  const recenti = nelPeriodo(validi, quindici)

  return {
    adesso: adesso.toISOString(),
    fuso,
    negozio: nome,
    giorno: settimana.secchi[settimana.secchi.length - 1].dettaglio,
    tipo: "admin" as const,
    vendite: vede.vendite ? Object.fromEntries(PERIODI_PANORAMICA.map((p) => [p, venditePer(validi, finestra(p, adesso, fuso))])) : null,
    indicatori: vede.vendite
      ? {
          ordini: indicatore(correnti.ordini, prima.ordini, perSecchio(recenti, quindici.secchi, (g) => g.length)),
          ordine_medio: indicatore(correnti.ordine_medio, prima.ordine_medio, perSecchio(recenti, quindici.secchi, (g) => totali(g).ordine_medio)),
          ritorno: { ...indicatore(ritorno.quota, ritornoPrima.quota, quindici.secchi.map((s) => clientiDiRitorno(validi, s).quota)), clienti: ritorno.clienti },
        }
      : null,
    ultime: vede.vendite
      ? recentiPrima.slice(0, 3).map((u) => ({
          id: u.id,
          numero: u.numero,
          cliente: vede.clienti ? u.cliente.nome : null,
          canale: u.canale,
          quando: u.creato_il,
          totale: u.totale,
        }))
      : null,
    obiettivo: vede.vendite ? { meta: obiettivo, incasso: diOggi.vendite, ordini: diOggi.ordini } : null,
    coda: vede.coda
      ? {
          da_preparare: inCoda.length,
          pronti: pronti.length,
          voci: aperti.slice(0, QUANTI_IN_CODA).map((u) => ({
            id: u.id,
            numero: u.numero,
            cliente: vede.clienti ? u.cliente.nome : null,
            quando: u.creato_il,
            pagato: !appartiene(u, "non_pagati"),
            preparato: appartiene(u, "preparati"),
            richieste: u.richieste.map((r) => ({ ordine: r.ordine_id, azienda: r.azienda_id })),
            totale: u.totale,
            unita: u.articoli,
            righe: u.anteprime,
          })),
        }
      : null,
    migliori: vede.vendite ? perProdotto(nelPeriodo(validi, settimana)).slice(0, QUANTI_MIGLIORI) : null,
    in_diretta: demo?.adesso ?? null,
    conversione: conversioneDi(demo),
    spunto: demo?.spunto ?? null,
    attivita,
    altre_valute: ordini.filter((o) => o.valido).length - validi.length,
  }
}

/** Per l'azienda solo quantità: prezzi di vendita e nomi dei clienti restano al negozio. */
export async function panoramicaAzienda(scope: MedusaContainer, azienda: string) {
  const adesso = new Date()
  const { fuso } = await negozio(scope)
  const ordini = (await leggiOrdini(scope, { da: inizioStorico(adesso, fuso), azienda })).filter((o) => o.valido)
  const settimana = finestra("7g", adesso, fuso)
  const quindici = finestra("14g", adesso, fuso)
  const correnti = totali(nelPeriodo(ordini, settimana))
  const prima = totali(nelPeriodo(ordini, settimana.precedente))
  const recenti = nelPeriodo(ordini, quindici)
  const perOrdine = (t: typeof correnti) => (t.ordini ? t.unita / t.ordini : null)

  return {
    adesso: adesso.toISOString(),
    fuso,
    giorno: settimana.secchi[settimana.secchi.length - 1].dettaglio,
    tipo: "azienda" as const,
    unita: Object.fromEntries(PERIODI_PANORAMICA.map((p) => [p, unitaPer(ordini, finestra(p, adesso, fuso))])),
    indicatori: {
      ordini: indicatore(correnti.ordini, prima.ordini, perSecchio(recenti, quindici.secchi, (g) => g.length)),
      unita: indicatore(correnti.unita, prima.unita, perSecchio(recenti, quindici.secchi, (g) => totali(g).unita)),
      unita_per_ordine: indicatore(perOrdine(correnti), perOrdine(prima), perSecchio(recenti, quindici.secchi, (g) => perOrdine(totali(g)))),
    },
    ultime: ordini.slice(0, 3).map((o) => ({ id: o.id, numero: o.numero, quando: o.creato_il.toISOString(), unita: unitaDi(o) })),
    coda: codaAzienda(ordini),
    migliori: perProdotto(nelPeriodo(ordini, settimana)).slice(0, QUANTI_MIGLIORI).map(({ id, nome, miniatura, unita }) => ({ id, nome, miniatura, unita })),
  }
}
