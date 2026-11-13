import { z } from "@medusajs/framework/zod"
import { invalido } from "../../../utili"
import type { ConteggioPannello } from "../../../../workflows/catalogo/movimenti"
import { confrontaCampi } from "../../ishtar/catalogo/salvataggio"
import type { Offerta } from "./offerte"
import { ean } from "./scheda"

/*
 * Finestra varianti della console tradotta in ciò che va scritto, senza database (verificata in
 * __tests__/variante.unit.spec.ts). La finestra manda, per la variante e per ogni offerta, i valori nuovi e quelli con
 * cui si è aperta («prima»): si scrive un campo solo se il valore attuale è ancora quello di partenza, altrimenti è un
 * conflitto (412). Un campo uguale al suo valore di partenza non è stato toccato e non si scrive, anche se arriva.
 */

/** Finestra con il codice di prima: manda valori senza quelli di partenza. */
export const RICARICA_CONSOLE = "The console was updated: reload the page to save your changes"

const importo = z.number({ message: "Enter a valid amount" }).min(0, "The amount cannot be negative").nullable()
const PrezziOfferta = z.object({ prezzo: importo.optional(), prezzo_cessione: importo.optional(), prezzo_consigliato: importo.optional() })
/** Valori con cui la finestra si è aperta: letti dal server, quindi anche una giacenza negativa. */
const Letti = z.object({
  prezzo: z.number().nullable().optional(),
  prezzo_cessione: z.number().nullable().optional(),
  prezzo_consigliato: z.number().nullable().optional(),
  quantita: z.number().int().optional(),
})

/**
 * Corpo della finestra. La quantità di un'offerta esistente può arrivare negativa se non è stata toccata (giacenza sotto
 * zero dopo un'evasione oltre le scorte): una quantità scritta negativa la rifiuta pianoVariante. Quella di una nuova
 * offerta è sempre scritta.
 */
export const SchemaVariante = z.object({
  titolo: z.string().trim().min(1, "A variant needs a name").max(80, "This variant name is too long").optional(),
  sku: z.string().trim().min(1, "A variant needs a code").max(80, "This code is too long").optional(),
  ean: ean.nullish(),
  prima: z.object({ titolo: z.string().nullable().optional(), sku: z.string().nullable().optional(), ean: z.string().nullable().optional() }).optional(),
  offerte: z.array(PrezziOfferta.extend({
    id: z.string(),
    quantita: z.number({ message: "Enter a valid quantity" }).int("Quantity is a whole number").optional(),
    prima: Letti.optional(),
  })).optional(),
  nuova_offerta: PrezziOfferta.extend({
    azienda_id: z.string(),
    quantita: z.number({ message: "Enter a valid quantity" }).int("Quantity is a whole number").min(0, "Quantity cannot be negative").optional(),
  }).optional(),
})

type CampiOfferta = { prezzo?: number | null; prezzo_cessione?: number | null; prezzo_consigliato?: number | null; quantita?: number }

export type CorpoVariante = {
  titolo?: string
  sku?: string
  ean?: string | null
  prima?: { titolo?: string | null; sku?: string | null; ean?: string | null }
  offerte?: (CampiOfferta & { id: string; prima?: CampiOfferta })[]
}

export type ConflittoVariante = { campo: string; attuale: unknown; tuo: unknown; offerta?: string; azienda?: string }

type Variante = { id: string; title: string; sku: string | null; ean: string | null }

const normale = (v: unknown) => (v === undefined || v === null ? "" : v)
const uguale = (a: unknown, b: unknown) => JSON.stringify(normale(a)) === JSON.stringify(normale(b))
const CAMPI_VARIANTE = { titolo: "title", sku: "sku", ean: "ean" } as const
const PREZZI = ["prezzo", "prezzo_cessione", "prezzo_consigliato"] as const

export function pianoVariante(dati: CorpoVariante, variante: Variante, offerte: Offerta[], nuovoId: () => string) {
  const conflitti: ConflittoVariante[] = []

  // Variante: nome, SKU, EAN.
  const valore = (k: keyof typeof CAMPI_VARIANTE) => (k === "ean" ? dati.ean || null : dati[k])
  const inviati = (Object.keys(CAMPI_VARIANTE) as (keyof typeof CAMPI_VARIANTE)[]).filter((k) => dati[k] !== undefined)
  if (inviati.length && !dati.prima) throw invalido(RICARICA_CONSOLE)
  const toccati = inviati.filter((k) => !uguale(valore(k), dati.prima?.[k]))
  const confronto = confrontaCampi(
    { titolo: variante.title, sku: variante.sku, ean: variante.ean },
    Object.fromEntries(toccati.map((k) => [k, { prima: [dati.prima?.[k] ?? null], dopo: valore(k) }]))
  )
  conflitti.push(...confronto.conflitti)
  const campi = Object.fromEntries(Object.entries(confronto.scrivere).map(([k, v]) => [CAMPI_VARIANTE[k as keyof typeof CAMPI_VARIANTE], v]))

  // Offerte: prezzi e quantità.
  const daAggiornare: { id: string; prezzo?: number | null; metadata?: Record<string, unknown> }[] = []
  const scorte: { offerta: string; voce: string; deposito: string | null; azienda: string; conteggio: ConteggioPannello }[] = []
  for (const m of dati.offerte ?? []) {
    const offerta = offerte.find((o) => o.id === m.id)
    if (!offerta) throw invalido("This offer does not belong to the variant")
    const campiInviati = ([...PREZZI, "quantita"] as const).filter((k) => m[k] !== undefined)
    if (!campiInviati.length) continue
    if (!m.prima) throw invalido(RICARICA_CONSOLE)
    const toccatiOfferta = campiInviati.filter((k) => !uguale(m[k], m.prima?.[k]))
    const attuale = { prezzo: offerta.prezzo, prezzo_cessione: offerta.prezzo_cessione, prezzo_consigliato: offerta.prezzo_consigliato, quantita: offerta.scorte }
    const prezzi = confrontaCampi(attuale, Object.fromEntries(toccatiOfferta.filter((k) => k !== "quantita").map((k) => [k, { prima: [m.prima?.[k] ?? null], dopo: m[k] ?? null }])))
    const dell = { offerta: offerta.id, azienda: offerta.azienda.nome }
    conflitti.push(...prezzi.conflitti.map((c) => ({ ...c, ...dell })))
    const scrivere = prezzi.scrivere as Partial<Record<(typeof PREZZI)[number], number | null>>
    const metadata = Object.fromEntries((["prezzo_cessione", "prezzo_consigliato"] as const).filter((k) => k in scrivere).map((k) => [k, scrivere[k]]))
    if ("prezzo" in scrivere || Object.keys(metadata).length) {
      daAggiornare.push({ id: offerta.id, ...("prezzo" in scrivere ? { prezzo: scrivere.prezzo } : {}), ...(Object.keys(metadata).length ? { metadata } : {}) })
    }
    if (toccatiOfferta.includes("quantita") && m.quantita! < 0) throw invalido("Quantity cannot be negative")
    if (toccatiOfferta.includes("quantita") && !uguale(offerta.scorte, m.quantita)) {
      if (offerta.livelli.length > 1) throw invalido("Stock across several warehouses is changed from Inventory")
      if (offerta.scorte !== m.prima.quantita) {
        conflitti.push({ campo: "quantita", attuale: offerta.scorte, tuo: m.quantita, ...dell })
        continue
      }
      const voce = offerta.livelli[0]?.voce_id ?? offerta.voci_magazzino[0]
      if (!voce) throw invalido("This offer has no stock item: stock not saved")
      scorte.push({ offerta: offerta.id, voce, deposito: offerta.livelli[0]?.deposito_id ?? null, azienda: offerta.azienda.id,
        conteggio: { id: nuovoId(), prima: [m.prima.quantita!], dopo: m.quantita!, tipo: "conteggio", motivo: null, nota: null } })
    }
  }
  return { conflitti, campi, offerte: daAggiornare, scorte }
}

export type PianoVariante = ReturnType<typeof pianoVariante>

/**
 * SKU ed EAN della nuova offerta di una variante che non ne aveva: quelli appena scritti dalla finestra, altrimenti quelli
 * della variante letta sotto il lucchetto del prodotto (non quelli con cui la finestra si è aperta).
 */
export function codiciNuovaOfferta(campi: Record<string, unknown>, variante: Variante) {
  return {
    sku: (campi.sku as string | undefined) ?? variante.sku ?? variante.id,
    ean: "ean" in campi ? ((campi.ean as string | null) ?? null) : variante.ean,
  }
}

/**
 * Conflitto sulle scorte rilevato dentro il workflow (una vendita arrivata fra la lettura e il lucchetto della voce): la
 * voce dice quale offerta e quale azienda, per il messaggio e per la finestra che mostra il valore attuale.
 */
export function conflittoInScrittura(conflitto: { campo?: string; attuale?: unknown; articolo_id?: string; deposito_id?: string }, piano: PianoVariante, offerte: Offerta[]): ConflittoVariante {
  const scorta = piano.scorte.find((s) => s.voce === conflitto.articolo_id)
  const offerta = scorta && offerte.find((o) => o.id === scorta.offerta)
  if (!scorta || !offerta) return { campo: "quantita", attuale: conflitto.attuale, tuo: null }
  return { campo: "quantita", attuale: conflitto.attuale, tuo: scorta.conteggio.dopo, offerta: offerta.id, azienda: offerta.azienda.nome }
}

const SOGGETTI: Record<string, string> = {
  titolo: "the variant name", sku: "the SKU", ean: "the EAN", prezzo: "the selling price",
  prezzo_cessione: "the supply price", prezzo_consigliato: "the suggested price", quantita: "the stock",
}
const leggibile = (v: unknown) => (v === null || v === undefined || v === "" ? "empty" : String(v))

/** Messaggio per la console: il primo conflitto per esteso, con l'azienda e il valore attuale; gli altri contati. */
export function messaggioVariante(conflitti: ConflittoVariante[]) {
  const [primo, ...altri] = conflitti
  const dove = primo.azienda ? ` for ${primo.azienda}` : ""
  const resto = altri.length ? ` ${altri.length} other ${altri.length === 1 ? "value was" : "values were"} changed too.` : ""
  return `Not saved: ${SOGGETTI[primo.campo] ?? primo.campo}${dove} was changed elsewhere (now ${leggibile(primo.attuale)}).${resto}`
}

