import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { interroga } from "../../../utili"
import { assente } from "../../magazzino/lib/assente"
import { SEGMENTI, CAMPO_SEGMENTO, appartenenze, statistiche, type OrdineCliente } from "./segmenti"

type Metadati = Record<string, unknown> | null | undefined

export type IndirizzoGrezzo = {
  id: string
  address_name?: string | null
  is_default_shipping?: boolean
  is_default_billing?: boolean
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

type ClienteGrezzo = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  phone: string | null
  has_account?: boolean
  metadata?: Metadati
  created_at: string
  addresses?: IndirizzoGrezzo[] | null
  groups?: { id: string; name: string | null }[] | null
}

const BLOCCO = 500

const CAMPI_CLIENTE = [
  "id",
  "email",
  "first_name",
  "last_name",
  "company_name",
  "phone",
  "has_account",
  "metadata",
  "created_at",
  "addresses.id",
  "addresses.address_name",
  "addresses.is_default_shipping",
  "addresses.is_default_billing",
  "addresses.first_name",
  "addresses.last_name",
  "addresses.company",
  "addresses.address_1",
  "addresses.address_2",
  "addresses.city",
  "addresses.province",
  "addresses.postal_code",
  "addresses.country_code",
  "addresses.phone",
  "groups.id",
  "groups.name",
]

export const indirizzoPubblico = (a: IndirizzoGrezzo) => ({
  id: a.id,
  etichetta: a.address_name ?? null,
  nome: a.first_name ?? null,
  cognome: a.last_name ?? null,
  azienda: a.company ?? null,
  indirizzo: a.address_1 ?? null,
  indirizzo_2: a.address_2 ?? null,
  citta: a.city ?? null,
  provincia: a.province ?? null,
  cap: a.postal_code ?? null,
  paese: a.country_code ?? null,
  telefono: a.phone ?? null,
  predefinito_spedizione: Boolean(a.is_default_shipping),
  predefinito_fatturazione: Boolean(a.is_default_billing),
})

function schedaDi(cliente: ClienteGrezzo, ordini: OrdineCliente[]) {
  const metadata = cliente.metadata ?? {}
  const indirizzi = cliente.addresses ?? []
  const principale = indirizzi.find((a) => a.is_default_shipping) ?? indirizzi[0]
  const dati = statistiche(ordini)
  return {
    id: cliente.id,
    email: cliente.email,
    nome: cliente.first_name,
    cognome: cliente.last_name,
    azienda: cliente.company_name,
    telefono: cliente.phone,
    registrato: Boolean(cliente.has_account),
    newsletter: metadata.newsletter === true,
    newsletter_data: typeof metadata.newsletter_data === "string" ? metadata.newsletter_data : null,
    rivenditore: metadata.rivenditore === true,
    note: typeof metadata.note === "string" ? metadata.note : null,
    creato_il: cliente.created_at,
    citta: principale?.city ?? null,
    gruppi: (cliente.groups ?? []).map((g) => ({ id: g.id, nome: g.name })),
    ...dati,
    ...appartenenze(cliente.created_at, dati),
  }
}

export type Scheda = ReturnType<typeof schedaDi>

async function leggiOrdini(req: AuthenticatedMedusaRequest, ids: string[]): Promise<OrdineCliente[]> {
  if (!ids.length) return []
  const { data } = await interroga(req).graph({
    entity: "order",
    fields: ["id", "display_id", "customer_id", "status", "is_draft_order", "total", "currency_code", "created_at"],
    filters: { customer_id: ids },
  })
  return data as unknown as OrdineCliente[]
}

async function leggiGrezzi(req: AuthenticatedMedusaRequest): Promise<ClienteGrezzo[]> {
  const query = interroga(req)
  const clienti: ClienteGrezzo[] = []
  for (let skip = 0; ; skip += BLOCCO) {
    const { data } = await query.graph({
      entity: "customer",
      fields: CAMPI_CLIENTE,
      pagination: { skip, take: BLOCCO, order: { created_at: "DESC" } },
    })
    clienti.push(...(data as unknown as ClienteGrezzo[]))
    if (data.length < BLOCCO) return clienti
  }
}

const perCliente = (ordini: OrdineCliente[]) => {
  const mappa = new Map<string, OrdineCliente[]>()
  for (const ordine of ordini) {
    if (ordine.customer_id) mappa.set(ordine.customer_id, [...(mappa.get(ordine.customer_id) ?? []), ordine])
  }
  return mappa
}

export async function leggiClienti(req: AuthenticatedMedusaRequest): Promise<Scheda[]> {
  const grezzi = await leggiGrezzi(req)
  const ordini = perCliente(await leggiOrdini(req, grezzi.map((c) => c.id)))
  return grezzi.map((c) => schedaDi(c, ordini.get(c.id) ?? []))
}

export async function leggiCliente(req: AuthenticatedMedusaRequest, id: string) {
  const { data } = await interroga(req).graph({ entity: "customer", fields: CAMPI_CLIENTE, filters: { id } })
  const cliente = data[0] as unknown as ClienteGrezzo | undefined
  if (!cliente) throw assente("Customer")
  const ordini = await leggiOrdini(req, [id])
  return {
    grezzo: cliente,
    scheda: schedaDi(cliente, ordini),
    indirizzi: (cliente.addresses ?? []).map(indirizzoPubblico),
    ordini: ordini
      .map((o) => ({
        id: o.id,
        numero: o.display_id ?? null,
        stato: o.status ?? null,
        bozza: Boolean(o.is_draft_order),
        totale: Number(o.total ?? 0),
        valuta: o.currency_code ?? null,
        creato_il: o.created_at,
      }))
      .sort((a, b) => String(b.creato_il).localeCompare(String(a.creato_il))),
  }
}

export const FILTRI = ["tutti", "abituali", "nuovi", "newsletter", "rivenditori"] as const
export const ORDINI = ["speso", "ordini", "ultimo", "nome"] as const

export const ParametriClienti = z.object({
  q: z.string().trim().max(120).optional(),
  filtro: z.enum(FILTRI, { message: "Unknown filter" }).default("tutti"),
  segmento: z.enum(SEGMENTI, { message: "Unknown segment" }).optional(),
  citta: z.string().trim().max(120).optional(),
  gruppo: z.string().optional(),
  ordina: z.enum(ORDINI, { message: "Unknown sort order" }).default("speso"),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  tutte: z.enum(["0", "1"]).optional(),
})

type Parametri = z.infer<typeof ParametriClienti>

const CONDIZIONI: Record<(typeof FILTRI)[number], (c: Scheda) => boolean> = {
  tutti: () => true,
  abituali: (c) => c.abituale,
  nuovi: (c) => c.nuovo,
  newsletter: (c) => c.newsletter,
  rivenditori: (c) => c.rivenditore,
}

const nomeDi = (c: Scheda) => `${c.nome ?? ""} ${c.cognome ?? ""}`.trim() || (c.email ?? "")

const CRITERI: Record<(typeof ORDINI)[number], (a: Scheda, b: Scheda) => number> = {
  speso: (a, b) => b.speso - a.speso,
  ordini: (a, b) => b.ordini - a.ordini,
  ultimo: (a, b) => (b.ultimo_ordine ?? "").localeCompare(a.ultimo_ordine ?? ""),
  nome: () => 0,
}

function cerca(cliente: Scheda, testo: string) {
  const cercato = testo.toLowerCase()
  return [`${cliente.nome ?? ""} ${cliente.cognome ?? ""}`, cliente.email, cliente.telefono, cliente.azienda, cliente.citta].some((v) =>
    v?.toLowerCase().includes(cercato)
  )
}

export function elencoClienti(clienti: Scheda[], p: Parametri) {
  const base = clienti.filter(
    (c) =>
      (!p.q || cerca(c, p.q)) &&
      (!p.segmento || c[CAMPO_SEGMENTO[p.segmento]]) &&
      (!p.citta || c.citta?.toLowerCase() === p.citta.toLowerCase()) &&
      (!p.gruppo || c.gruppi.some((g) => g.id === p.gruppo))
  )
  const confronta = CRITERI[p.ordina]
  const trovati = base
    .filter(CONDIZIONI[p.filtro])
    .sort((a, b) => confronta(a, b) || nomeDi(a).localeCompare(nomeDi(b), "en-GB"))
  return {
    clienti: p.tutte === "1" ? trovati : trovati.slice(p.offset, p.offset + p.limit),
    conteggio: trovati.length,
    conteggi: Object.fromEntries(FILTRI.map((f) => [f, base.filter(CONDIZIONI[f]).length])),
    limite: p.limit,
    posizione: p.offset,
  }
}
