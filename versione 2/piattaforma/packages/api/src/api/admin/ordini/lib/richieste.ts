import type { Collo, Legami, Metadati, OrdineGrezzo, Riga } from "./lettura"

export type StatoRichiesta = "da_confermare" | "confermata" | "preparata" | "spedita" | "consegnata" | "annullata"

/** Quanto l'ordine ha già fatto di ciò che deve fare, nei termini degli stati di Medusa. */
export type StatoEvasione =
  | "not_fulfilled"
  | "partially_fulfilled"
  | "fulfilled"
  | "partially_shipped"
  | "shipped"
  | "partially_delivered"
  | "delivered"
  | "canceled"

export type DatiEvasione = { confermata_il?: string; confermata_da?: string; preparata_da?: string; corriere?: string | null }

export type RigaRichiesta = {
  id: string
  titolo: string
  variante: string | null
  sku: string | null
  miniatura: string | null
  quantita: number
  preparate: number
  spedite: number
  consegnate: number
  in_reso: number
  rese: number
  prezzo: number
  totale: number
  cessione: number | null
}

export type ColloRichiesta = {
  id: string
  preparato_il: string | null
  spedito_il: string | null
  consegnato_il: string | null
  tracking: string | null
  tracking_url: string | null
  corriere: string | null
}

export type Richiesta = {
  id: string
  ordine_id: string
  numero: number
  azienda_id: string
  azienda: string
  creata_il: string
  scadenza: string | null
  in_ritardo: boolean
  stato: StatoRichiesta
  evasione: StatoEvasione
  confermata_il: string | null
  confermata_da: string | null
  preparata_da: string | null
  righe: RigaRichiesta[]
  colli: ColloRichiesta[]
}

const GIORNO = 86_400_000

const numero = (valore: unknown) => Number(valore ?? 0)

/** Il prezzo di cessione sta nell'offerta dell'azienda: se manca, niente stime. */
const cessioneDi = (metadata: Metadati): number | null => {
  const grezzo = metadata?.prezzo_cessione
  if (grezzo === null || grezzo === undefined || grezzo === "") return null
  const valore = Number(grezzo)
  return Number.isFinite(valore) && valore >= 0 ? valore : null
}

export const rigaDiRichiesta = (r: Riga): RigaRichiesta => ({
  id: r.id,
  titolo: r.product_title ?? r.title,
  variante: r.variant_title ?? r.subtitle,
  sku: r.variant_sku ?? r.offer?.sku ?? null,
  miniatura: r.thumbnail,
  quantita: numero(r.quantity),
  preparate: numero(r.detail?.fulfilled_quantity),
  spedite: numero(r.detail?.shipped_quantity),
  consegnate: numero(r.detail?.delivered_quantity),
  in_reso: numero(r.detail?.return_requested_quantity),
  rese: numero(r.detail?.return_received_quantity),
  prezzo: numero(r.unit_price),
  totale: numero(r.total) > 0 ? numero(r.total) : numero(r.unit_price) * numero(r.quantity),
  cessione: cessioneDi(r.offer?.metadata),
})

type Avanzamento = Pick<RigaRichiesta, "quantita" | "preparate" | "spedite" | "consegnate">

export function evasioneDi(righe: Avanzamento[]): StatoEvasione {
  const somma = (campo: keyof Avanzamento) => righe.reduce((totale, r) => totale + r[campo], 0)
  const totale = somma("quantita")
  if (!totale) return "not_fulfilled"
  if (somma("consegnate") >= totale) return "delivered"
  if (somma("consegnate") > 0) return "partially_delivered"
  if (somma("spedite") >= totale) return "shipped"
  if (somma("spedite") > 0) return "partially_shipped"
  if (somma("preparate") >= totale) return "fulfilled"
  return somma("preparate") > 0 ? "partially_fulfilled" : "not_fulfilled"
}

const statoDi = (annullato: boolean, evasione: StatoEvasione, confermata: boolean): StatoRichiesta => {
  if (annullato) return "annullata"
  if (evasione === "delivered") return "consegnata"
  if (evasione === "shipped" || evasione === "partially_delivered") return "spedita"
  if (evasione === "fulfilled" || evasione === "partially_shipped") return "preparata"
  return confermata || evasione === "partially_fulfilled" ? "confermata" : "da_confermare"
}

const datiEvasione = (ordine: OrdineGrezzo, azienda: string): DatiEvasione =>
  ((ordine.metadata?.evasioni ?? {}) as Record<string, DatiEvasione>)[azienda] ?? {}

function colloDi(collo: Collo, corriere: string | null): ColloRichiesta {
  const etichetta = collo.labels?.[0]
  return {
    id: collo.id,
    preparato_il: collo.packed_at,
    spedito_il: collo.shipped_at,
    consegnato_il: collo.delivered_at,
    tracking: etichetta?.tracking_number || null,
    tracking_url: etichetta?.tracking_url || null,
    corriere,
  }
}

/**
 * Azienda di ogni riga: col checkout c'è un ordine per azienda; le bozze convertite
 * possono avere più aziende sullo stesso ordine e la riga è legata alla sua offerta.
 */
export function aziendaDellaRiga(riga: Riga, aziende: string[]): string | null {
  if (aziende.length === 1) return aziende[0]
  return riga.offer?.seller_id ?? null
}

/** Una richiesta per ogni azienda coinvolta: da qui escono stati, tempi e righe che può vedere. */
export function richiesteDi(ordine: OrdineGrezzo, legami: Legami, giorniMax: number | null, adesso = Date.now()): Richiesta[] {
  // Alla cassa la merce esce subito: non c'è niente da chiedere alle aziende.
  if (ordine.metadata?.canale === "cassa") return []
  const aziende = legami.aziende.get(ordine.id) ?? []
  const perAzienda = new Map<string, Riga[]>()
  for (const riga of ordine.items ?? []) {
    const azienda = aziendaDellaRiga(riga, aziende)
    if (azienda) perAzienda.set(azienda, [...(perAzienda.get(azienda) ?? []), riga])
  }
  const annullato = ordine.status === "canceled"
  const scadenza = giorniMax ? new Date(new Date(ordine.created_at).getTime() + giorniMax * GIORNO) : null
  return [...perAzienda].map(([azienda, righeGrezze]) => {
    const righe = righeGrezze.map(rigaDiRichiesta)
    const dati = datiEvasione(ordine, azienda)
    const idRighe = new Set(righeGrezze.map((r) => r.id))
    const colli = (ordine.fulfillments ?? [])
      .filter((c) => !c.canceled_at && (c.items ?? []).some((i) => i.line_item_id && idRighe.has(i.line_item_id)))
      .map((c) => colloDi(c, dati.corriere ?? null))
    const evasione: StatoEvasione = annullato ? "canceled" : evasioneDi(righe)
    const stato = statoDi(annullato, evasione, Boolean(dati.confermata_il))
    const aperta = stato === "da_confermare" || stato === "confermata" || stato === "preparata"
    return {
      id: `${ordine.id}:${azienda}`,
      ordine_id: ordine.id,
      numero: ordine.display_id,
      azienda_id: azienda,
      azienda: legami.nomi.get(azienda) ?? "Company",
      creata_il: ordine.created_at,
      scadenza: scadenza?.toISOString() ?? null,
      in_ritardo: Boolean(scadenza && aperta && adesso > scadenza.getTime()),
      stato,
      evasione,
      confermata_il: dati.confermata_il ?? null,
      confermata_da: dati.confermata_da ?? null,
      preparata_da: dati.preparata_da ?? null,
      righe,
      colli,
    }
  })
}

export const nomeDestinatario = (ordine: OrdineGrezzo) =>
  [ordine.shipping_address?.first_name, ordine.shipping_address?.last_name].filter(Boolean).join(" ") || ordine.shipping_address?.company || "No name"

/** Ciò che un'azienda può sapere del destinatario. Niente email, niente storico, niente pagamenti. */
export function destinatarioDi(ordine: OrdineGrezzo) {
  const a = ordine.shipping_address
  return {
    nome: nomeDestinatario(ordine),
    azienda: a?.company ?? null,
    indirizzo: a?.address_1 ?? null,
    indirizzo_2: a?.address_2 ?? null,
    citta: a?.city ?? null,
    cap: a?.postal_code ?? null,
    provincia: a?.province ?? null,
    paese: a?.country_code ?? null,
    telefono: a?.phone ?? null,
  }
}

export const STATI_APERTI: StatoRichiesta[] = ["da_confermare", "confermata", "preparata"]
