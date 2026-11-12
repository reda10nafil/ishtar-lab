import type { CaricoSconto, ModalitaPrezzo } from "./service"

/** Calcoli dell'outfit: funzioni pure, senza accesso ai dati. Gli importi sono in euro. */

export type Variante = {
  id: string
  titolo: string
  sku: string | null
  prezzo: number | null
  /** Prezzo di cessione. `null` quando l'azienda non l'ha indicato: non si stima. */
  costo: number | null
  /** `null` quando le scorte di questa offerta non sono gestite. */
  quantita: number | null
  disponibile: boolean
}

export type Scheda = {
  product_id: string
  azienda_id: string
  titolo: string
  foto: string | null
  azienda_nome: string
  in_vendita: boolean
  azienda_attiva: boolean
  con_offerta: boolean
  varianti: Variante[]
}

export type Valutazione = {
  acquistabile: boolean
  problema: string | null
  prezzo: number | null
  costo: number | null
  prezzo_varia: boolean
}

export type Riga = { titolo: string; principale: Valutazione; alternativa: Valutazione | null; titolo_alternativa?: string | null }

export type Impostazioni = {
  modalita_prezzo: ModalitaPrezzo
  prezzo_fisso: number | null
  sconto_a_carico: CaricoSconto
  quota_negozio: number
}

export const arrotonda = (valore: number) => Math.round(valore * 100) / 100

const somma = (valori: number[]) => valori.reduce((totale, valore) => totale + valore, 0)

/** Il riferimento è la variante disponibile meno cara: è il prezzo «a partire da» del capo. */
export function valutaScheda(scheda: Scheda | undefined): Valutazione {
  if (!scheda) return { acquistabile: false, problema: "Product no longer in the catalogue", prezzo: null, costo: null, prezzo_varia: false }
  const conPrezzo = scheda.varianti.filter((v) => v.prezzo !== null)
  const disponibili = conPrezzo.filter((v) => v.disponibile)
  const base = disponibili.length ? disponibili : conPrezzo
  const riferimento = [...base].sort((a, b) => (a.prezzo as number) - (b.prezzo as number))[0]
  const problema = !scheda.in_vendita
    ? "Product is not on sale"
    : !scheda.azienda_attiva
      ? "Company is not active"
      : !scheda.con_offerta
        ? "The company has no offer for this product"
        : !disponibili.length
          ? "Sold out"
          : null
  return {
    acquistabile: problema === null,
    problema,
    prezzo: riferimento?.prezzo ?? null,
    costo: riferimento?.costo ?? null,
    prezzo_varia: new Set(base.map((v) => v.prezzo)).size > 1,
  }
}

/** Il capo esaurito lascia il posto all'alternativa, se quella si può comprare. */
const inSostituzione = (riga: Riga) => !riga.principale.acquistabile && Boolean(riga.alternativa?.acquistabile)

export function calcolaOutfit(impostazioni: Impostazioni, righe: Riga[]) {
  const attive = righe.map((riga) => {
    const sostituito = inSostituzione(riga)
    return {
      titolo: sostituito ? (riga.titolo_alternativa ?? riga.titolo) : riga.titolo,
      sostituito,
      attiva: sostituito ? (riga.alternativa as Valutazione) : riga.principale,
    }
  })

  const motivi = attive.filter((r) => !r.attiva.acquistabile).map((r) => `${r.titolo}: ${r.attiva.problema}`)
  if (!righe.length) motivi.push("The outfit has no pieces")

  const prezzi = attive.map((r) => r.attiva.prezzo)
  const sommaCapi = prezzi.length && prezzi.every((p) => p !== null) ? arrotonda(somma(prezzi as number[])) : null
  const fisso = impostazioni.modalita_prezzo === "fisso"
  if (fisso && impostazioni.prezzo_fisso === null) motivi.push("Outfit price is missing")
  const finale = fisso ? impostazioni.prezzo_fisso : sommaCapi

  const sconto = fisso && sommaCapi !== null && finale !== null ? arrotonda(Math.max(0, sommaCapi - finale)) : 0
  const quotaNegozio = { negozio: 100, aziende: 0, ripartito: impostazioni.quota_negozio }[impostazioni.sconto_a_carico]
  const scontoNegozio = arrotonda((sconto * quotaNegozio) / 100)
  const scontoAziende = arrotonda(sconto - scontoNegozio)

  /** La parte di sconto delle aziende si divide in proporzione al prezzo di ogni capo. */
  const scontiCapo = attive.map((r) => (sommaCapi ? arrotonda((scontoAziende * (r.attiva.prezzo ?? 0)) / sommaCapi) : 0))

  const mancanti = attive.filter((r) => r.attiva.costo === null).map((r) => r.titolo)
  const costoCapi = righe.length && !mancanti.length ? arrotonda(somma(attive.map((r) => r.attiva.costo as number))) : null
  const costoNetto = costoCapi === null ? null : arrotonda(costoCapi - scontoAziende)
  const margine = costoNetto === null || finale === null ? null : arrotonda(finale - costoNetto)

  return {
    sostituzioni: attive.map((r) => r.sostituito),
    scontiCapo,
    disponibilita: {
      acquistabile: motivi.length === 0,
      motivi,
      capi_sostituiti: attive.filter((r) => r.sostituito).length,
    },
    prezzo: {
      somma: sommaCapi,
      finale,
      sconto,
      sconto_negozio: scontoNegozio,
      sconto_aziende: scontoAziende,
      varia_con_taglia: attive.some((r) => r.attiva.prezzo_varia),
      sopra_somma: fisso && sommaCapi !== null && finale !== null && finale > sommaCapi,
    },
    economia: {
      costo_capi: costoCapi,
      sconto_aziende: scontoAziende,
      costo_netto: costoNetto,
      margine,
      margine_percentuale: margine === null || !finale ? null : margine / finale,
      mancanti,
    },
  }
}

/** Una sola regola per pubblicare: la stessa che il cliente troverebbe in negozio. */
export function motivoBloccoPubblicazione(numeroCapi: number, motivi: string[]): string | null {
  if (numeroCapi < 2) return "An outfit needs at least two pieces to be published"
  return motivi.length ? `Cannot publish: ${motivi.join("; ")}` : null
}
