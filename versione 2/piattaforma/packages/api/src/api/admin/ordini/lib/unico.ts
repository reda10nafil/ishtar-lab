import type { MedusaContainer } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { giorniMassimi, leggiLegami, leggiOrdini, ordiniCollegati, ordineAssente, type Legami, type OrdineGrezzo } from "./lettura"
import { evasioneDi, richiesteDi, type Richiesta, type StatoEvasione } from "./richieste"

export type Canale = "online" | "cassa" | "ingrosso"
export type Evasione = StatoEvasione | "collected"

/** L'ordine come lo vede il cliente: uno solo, anche quando Mercur lo divide per azienda. */
export type Unico = {
  id: string
  gruppo_id: string | null
  ordini: OrdineGrezzo[]
  richieste: Richiesta[]
  numero: number
  creato_il: string
  annullato: boolean
  cliente: { id: string | null; nome: string; email: string | null }
  citta: string | null
  canale: Canale
  valuta: string
  totale: number
  pagamento: string
  evasione: Evasione
  ha_nota: boolean
  aziende: string[]
  articoli: number
  anteprime: { titolo: string; miniatura: string | null }[]
  testo: string
}

const NON_PAGATI = ["not_paid", "awaiting", "authorized", "partially_authorized", "requires_action", "partially_captured"]
const RIMBORSATI = ["refunded", "partially_refunded"]

export const FILTRI = ["tutti", "da_preparare", "preparati", "spediti", "consegnati", "non_pagati", "rimborsati"] as const
export type Filtro = (typeof FILTRI)[number]

export function appartiene(u: Pick<Unico, "annullato" | "evasione" | "pagamento">, filtro: Filtro): boolean {
  if (filtro === "tutti") return true
  if (filtro === "rimborsati") return RIMBORSATI.includes(u.pagamento)
  if (u.annullato) return false
  if (filtro === "da_preparare") return u.evasione === "not_fulfilled" || u.evasione === "partially_fulfilled"
  if (filtro === "preparati") return u.evasione === "fulfilled" || u.evasione === "partially_shipped"
  if (filtro === "spediti") return u.evasione === "shipped" || u.evasione === "partially_delivered"
  if (filtro === "consegnati") return u.evasione === "delivered" || u.evasione === "collected"
  return NON_PAGATI.includes(u.pagamento)
}

export const canaleDi = (ordine: OrdineGrezzo): Canale => {
  const m = ordine.metadata ?? {}
  if (m.canale === "cassa" || m.canale === "ingrosso") return m.canale
  return m.ingrosso_trattativa_id ? "ingrosso" : "online"
}

const nomeCliente = (o: OrdineGrezzo) =>
  [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") ||
  [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ") ||
  o.email ||
  "Guest"

/** Più ordini dello stesso cliente con pagamenti in stati diversi: conta il punto più indietro. */
function pagamentoDi(ordini: OrdineGrezzo[]): string {
  const vivi = ordini.filter((o) => o.status !== "canceled")
  const stati = (vivi.length ? vivi : ordini).map((o) => o.payment_status ?? "not_paid")
  const [primo] = stati
  if (stati.every((s) => s === primo)) return primo
  if (stati.some((s) => RIMBORSATI.includes(s))) return "partially_refunded"
  if (stati.some((s) => s === "captured" || s === "partially_captured")) return "partially_captured"
  if (stati.some((s) => s === "authorized")) return "partially_authorized"
  return primo
}

function compostoDa(id: string, gruppo: string | null, ordini: OrdineGrezzo[], legami: Legami, giorniMax: number | null): Unico {
  const ordinati = [...ordini].sort((a, b) => a.display_id - b.display_id)
  const [primo] = ordinati
  const richieste = ordinati.flatMap((o) => richiesteDi(o, legami, giorniMax))
  const annullato = ordinati.every((o) => o.status === "canceled")
  const righe = ordinati.flatMap((o) => o.items ?? [])
  const righeVive = ordinati
    .filter((o) => o.status !== "canceled")
    .flatMap((o) =>
      (o.items ?? []).map((r) => ({
        quantita: Number(r.quantity),
        preparate: Number(r.detail?.fulfilled_quantity ?? 0),
        spedite: Number(r.detail?.shipped_quantity ?? 0),
        consegnate: Number(r.detail?.delivered_quantity ?? 0),
      }))
    )
  const aziende = [...new Set(richieste.map((r) => r.azienda))]
  const canale = canaleDi(primo)
  const anonimo = canale === "cassa" && !primo.customer?.first_name && !primo.customer?.last_name
  const cliente = { id: primo.customer_id, nome: anonimo ? "Walk-in" : nomeCliente(primo), email: primo.email }
  return {
    id,
    gruppo_id: gruppo,
    ordini: ordinati,
    richieste,
    numero: primo.display_id,
    creato_il: primo.created_at,
    annullato,
    cliente,
    citta: primo.shipping_address?.city ?? null,
    canale,
    valuta: primo.currency_code,
    totale: ordinati.filter((o) => o.status !== "canceled" || annullato).reduce((s, o) => s + Number(o.total ?? 0), 0),
    pagamento: pagamentoDi(ordinati),
    evasione: annullato ? "canceled" : canale === "cassa" ? "collected" : evasioneDi(righeVive),
    ha_nota: ordinati.some((o) => Boolean(o.metadata?.nota) || (Array.isArray(o.metadata?.note) && o.metadata.note.length > 0)),
    aziende,
    articoli: righe.reduce((s, r) => s + Number(r.quantity), 0),
    anteprime: righe.slice(0, 3).map((r) => ({ titolo: r.product_title ?? r.title, miniatura: r.thumbnail })),
    testo: [...ordinati.map((o) => o.display_id), cliente.nome, cliente.email, ...aziende, ...righe.flatMap((r) => [r.product_title, r.variant_sku])].filter(Boolean).join(" ").toLowerCase(),
  }
}

export function componi(ordini: OrdineGrezzo[], legami: Legami, giorniMax: number | null): Unico[] {
  const gruppi = new Map<string, OrdineGrezzo[]>()
  for (const ordine of ordini) {
    const chiave = legami.gruppi.get(ordine.id) ?? ordine.id
    gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), ordine])
  }
  return [...gruppi].map(([id, parti]) => compostoDa(id, id.startsWith("og_") ? id : null, parti, legami, giorniMax))
}

/** Elenco, riepilogo e avvisi arrivano insieme: per pochi secondi leggono la stessa fotografia. */
const VALIDITA = 4000
let memoria: { quando: number; dati: Promise<Unico[]> } | null = null

export const scordaUnici = () => {
  memoria = null
}

async function calcolaUnici(scope: MedusaContainer): Promise<Unico[]> {
  const ordini = await leggiOrdini(scope)
  const [legami, giorni] = await Promise.all([leggiLegami(scope, ordini), giorniMassimi(scope)])
  return componi(ordini, legami, giorni)
}

export function leggiUnici(scope: MedusaContainer): Promise<Unico[]> {
  if (memoria && Date.now() - memoria.quando < VALIDITA) return memoria.dati
  const dati = calcolaUnici(scope).catch((errore) => {
    memoria = null
    throw errore
  })
  memoria = { quando: Date.now(), dati }
  return dati
}

export async function leggiUnico(scope: MedusaContainer, id: string): Promise<Unico> {
  const ids = await ordiniCollegati(scope, id)
  if (!ids.length) throw ordineAssente()
  const ordini = await leggiOrdini(scope, { id: ids })
  if (!ordini.length) throw ordineAssente()
  const [legami, giorni] = await Promise.all([leggiLegami(scope, ordini), giorniMassimi(scope)])
  const unico = componi(ordini, legami, giorni)[0]
  if (!unico) throw ordineAssente()
  return unico
}

export const ParametriElenco = z.object({
  q: z.string().trim().max(120).optional(),
  filtro: z.enum(FILTRI, { message: "Unknown filter" }).default("tutti"),
  canale: z.enum(["online", "cassa", "ingrosso"], { message: "Unknown channel" }).optional(),
  ordina: z.enum(["data", "cliente", "totale"], { message: "Unknown sort" }).default("data"),
  verso: z.enum(["asc", "desc"], { message: "Unknown sort" }).default("desc"),
  limit: z.coerce.number().int().min(1).max(500).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  tutte: z.enum(["0", "1"]).optional(),
})
export type Parametri = z.infer<typeof ParametriElenco>

const CONFRONTI: Record<Parametri["ordina"], (a: Unico, b: Unico) => number> = {
  data: (a, b) => a.creato_il.localeCompare(b.creato_il),
  cliente: (a, b) => a.cliente.nome.localeCompare(b.cliente.nome, "en"),
  totale: (a, b) => a.totale - b.totale,
}

export const riga = (u: Unico) => ({
  id: u.id,
  numero: u.numero,
  creato_il: u.creato_il,
  cliente: u.cliente,
  canale: u.canale,
  anteprime: u.anteprime,
  articoli: u.articoli,
  pagamento: u.pagamento,
  evasione: u.evasione,
  annullato: u.annullato,
  ha_nota: u.ha_nota,
  totale: u.totale,
  valuta: u.valuta,
  aziende: u.aziende,
})

export function elenco(unici: Unico[], p: Parametri, resiAperti: number) {
  const testo = p.q?.toLowerCase().replace(/^#/, "")
  const scelti = unici
    .filter((u) => appartiene(u, p.filtro))
    .filter((u) => !p.canale || u.canale === p.canale)
    .filter((u) => !testo || u.testo.includes(testo))
    .sort((a, b) => CONFRONTI[p.ordina](a, b) * (p.verso === "asc" ? 1 : -1))
  const conta = (f: Filtro) => unici.filter((u) => appartiene(u, f)).length
  const trenta = Date.now() - 30 * 86_400_000
  return {
    ordini: (p.tutte === "1" ? scelti : scelti.slice(p.offset, p.offset + p.limit)).map(riga),
    conteggio: scelti.length,
    valore: scelti.filter((u) => !u.annullato).reduce((s, u) => s + u.totale, 0),
    conteggi: Object.fromEntries(FILTRI.map((f) => [f, conta(f)])) as Record<Filtro, number>,
    canali: {
      online: unici.filter((u) => u.canale === "online").length,
      cassa: unici.filter((u) => u.canale === "cassa").length,
      ingrosso: unici.filter((u) => u.canale === "ingrosso").length,
    },
    riquadri: { da_preparare: conta("da_preparare"), da_spedire: conta("preparati"), non_pagati: conta("non_pagati"), resi_aperti: resiAperti },
    ultimi_trenta: unici.filter((u) => new Date(u.creato_il).getTime() >= trenta).length,
  }
}
