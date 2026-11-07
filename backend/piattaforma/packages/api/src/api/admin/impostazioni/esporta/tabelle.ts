import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { interroga } from "../../../utili"

export const TIPI = ["prodotti", "aziende", "clienti"] as const
export type TipoEsportazione = (typeof TIPI)[number]

type Cella = string | number | boolean | null
export type Tabella = { intestazioni: string[]; righe: Cella[][]; dati: Record<string, unknown>[] }

const PAGINA = 200

const STATI_PRODOTTO: Record<string, string> = { published: "Live", proposed: "In review", requires_action: "Changes requested", rejected: "Rejected", draft: "Draft" }
const STATI_AZIENDA: Record<string, string> = { open: "Active", pending_approval: "To approve", suspended: "Suspended", terminated: "Closed" }

type Query = ReturnType<typeof interroga>

/** Nel CSV date e importi seguono il formato inglese: il file si apre così in un foglio di calcolo. */
const FORMATO_IMPORTO = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
const data = (valore: unknown) => new Date(valore as string).toLocaleDateString("en-GB", { timeZone: "Europe/Rome" })

/** Legge tutte le righe a pagine: l'esportazione non deve fermarsi al limite di una pagina. */
async function tutte(query: Query, entity: string, fields: string[]) {
  const righe: Record<string, unknown>[] = []
  for (let skip = 0; ; skip += PAGINA) {
    const { data: pagina } = await query.graph({ entity, fields, pagination: { skip, take: PAGINA, order: { created_at: "ASC" } } })
    righe.push(...(pagina as Record<string, unknown>[]))
    if (pagina.length < PAGINA) return righe
  }
}

export async function contaTutto(req: AuthenticatedMedusaRequest) {
  const query = interroga(req)
  const conta = async (entity: string) => {
    // Medusa restituisce il totale solo se la paginazione indica anche `skip`.
    const { metadata } = await query.graph({ entity, fields: ["id"], pagination: { skip: 0, take: 1 } })
    return metadata?.count ?? 0
  }
  const [prodotti, aziende, clienti] = await Promise.all([conta("product"), conta("seller"), conta("customer")])
  return { prodotti, aziende, clienti }
}

const nomi = (elenco: unknown, campo: string) => ((elenco ?? []) as Record<string, string | null>[]).map((e) => e?.[campo]).filter(Boolean) as string[]

async function prodotti(query: Query): Promise<Tabella> {
  const [elenco, offerte] = await Promise.all([
    tutte(query, "product", ["id", "title", "handle", "status", "description", "created_at", "categories.name", "collection.title", "variants.title", "variants.sku", "sellers.name"]),
    tutte(query, "offer", ["id", "product_id", "sku", "seller.name", "prices.amount", "prices.currency_code"]),
  ])
  type Offerta = { product_id: string; sku: string | null; seller?: { name: string } | null; prices?: { amount: number; currency_code: string }[] }
  const perProdotto = new Map<string, Offerta[]>()
  for (const offerta of offerte as unknown as Offerta[]) perProdotto.set(offerta.product_id, [...(perProdotto.get(offerta.product_id) ?? []), offerta])
  const dati = elenco.map((p) => {
    const proprie = perProdotto.get(p.id as string) ?? []
    const prezzi = proprie.flatMap((o) => (o.prices ?? []).filter((x) => x.currency_code === "eur").map((x) => x.amount))
    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      status: STATI_PRODOTTO[p.status as string] ?? p.status,
      description: p.description ?? null,
      companies: [...new Set([...nomi(p.sellers, "name"), ...proprie.map((o) => o.seller?.name).filter(Boolean)])],
      categories: nomi(p.categories, "name"),
      collection: (p.collection as { title?: string } | null)?.title ?? null,
      variants: ((p.variants ?? []) as { title: string; sku: string | null }[]).map((v) => ({ title: v.title, sku: v.sku })),
      offers: proprie.map((o) => ({ sku: o.sku, company: o.seller?.name ?? null, prices: (o.prices ?? []).map((x) => ({ amount: x.amount, currency: x.currency_code })) })),
      lowest_price_eur: prezzi.length ? Math.min(...prezzi) : null,
      created_at: p.created_at,
    }
  })
  return {
    intestazioni: ["ID", "Title", "Status", "Companies", "Categories", "Collection", "Variants", "SKUs", "Lowest price (EUR)", "Created on"],
    righe: dati.map((d) => [
      d.id as string,
      d.title as string,
      d.status as string,
      d.companies.join(", "),
      d.categories.join(", "),
      d.collection,
      d.variants.length,
      d.variants.map((v) => v.sku).filter(Boolean).join(", "),
      d.lowest_price_eur === null ? null : FORMATO_IMPORTO.format(d.lowest_price_eur),
      data(d.created_at),
    ]),
    dati,
  }
}

async function aziende(query: Query): Promise<Tabella> {
  const elenco = await tutte(query, "seller", ["id", "name", "handle", "email", "phone", "description", "website_url", "status", "created_at"])
  const dati = elenco.map((a) => ({
    id: a.id,
    name: a.name,
    handle: a.handle,
    email: a.email,
    phone: a.phone ?? null,
    website: a.website_url ?? null,
    description: a.description ?? null,
    status: STATI_AZIENDA[a.status as string] ?? a.status,
    created_at: a.created_at,
  }))
  return {
    intestazioni: ["ID", "Name", "Email", "Phone", "Website", "Status", "Created on"],
    righe: dati.map((d) => [d.id as string, d.name as string, d.email as string, d.phone as string | null, d.website as string | null, d.status as string, data(d.created_at)]),
    dati,
  }
}

async function clienti(query: Query): Promise<Tabella> {
  const elenco = await tutte(query, "customer", ["id", "first_name", "last_name", "email", "phone", "company_name", "has_account", "created_at", "addresses.*"])
  const dati = elenco.map((c) => ({
    id: c.id,
    first_name: c.first_name ?? null,
    last_name: c.last_name ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    company: c.company_name ?? null,
    registered: Boolean(c.has_account),
    addresses: ((c.addresses ?? []) as Record<string, string | null>[]).map((i) => ({
      address_1: i.address_1,
      address_2: i.address_2,
      city: i.city,
      province: i.province,
      postcode: i.postal_code,
      country: i.country_code,
    })),
    created_at: c.created_at,
  }))
  return {
    intestazioni: ["ID", "First name", "Last name", "Email", "Phone", "Company", "Registered", "Addresses", "Created on"],
    righe: dati.map((d) => [d.id as string, d.first_name as string | null, d.last_name as string | null, d.email as string | null, d.phone as string | null, d.company as string | null, d.registered ? "Yes" : "No", d.addresses.length, data(d.created_at)]),
    dati,
  }
}

export function preparaTabella(req: AuthenticatedMedusaRequest, tipo: TipoEsportazione): Promise<Tabella> {
  const query = interroga(req)
  if (tipo === "prodotti") return prodotti(query)
  return tipo === "aziende" ? aziende(query) : clienti(query)
}
