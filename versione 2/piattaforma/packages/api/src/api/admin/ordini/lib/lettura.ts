import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { normalizeOrderPaymentCollections, withCartPaymentCollectionFields } from "@mercurjs/core/api/utils/split-order-payment-status"
import { leggiImpostazioni } from "../../impostazioni/lettura"

export type Metadati = Record<string, unknown> | null | undefined

export type DettaglioRiga = {
  fulfilled_quantity?: number
  shipped_quantity?: number
  delivered_quantity?: number
  return_requested_quantity?: number
  return_received_quantity?: number
  return_dismissed_quantity?: number
}

export type Riga = {
  id: string
  title: string
  subtitle: string | null
  thumbnail: string | null
  product_id: string | null
  product_title: string | null
  variant_id: string | null
  variant_title: string | null
  variant_sku: string | null
  unit_price: number
  quantity: number
  total: number
  metadata: Metadati
  detail?: DettaglioRiga | null
  offer?: { id: string; seller_id: string; sku?: string | null; metadata?: Metadati } | null
}

export type Collo = {
  id: string
  location_id: string | null
  created_at: string
  packed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  canceled_at: string | null
  labels?: { tracking_number?: string | null; tracking_url?: string | null }[] | null
  items?: { line_item_id: string | null; quantity: number }[] | null
}

export type Pagamento = {
  id: string
  amount: number
  provider_id: string
  captured_at: string | null
  canceled_at: string | null
  created_at: string
  refunds?: { id: string; amount: number; created_at: string; note?: string | null }[] | null
}

export type Incasso = { id: string; status: string; amount: number; captured_amount?: number | null; refunded_amount?: number | null; payments?: Pagamento[] | null }

export type Indirizzo = {
  first_name: string | null
  last_name: string | null
  company: string | null
  address_1: string | null
  address_2: string | null
  city: string | null
  postal_code: string | null
  province: string | null
  country_code: string | null
  phone: string | null
}

export type OrdineGrezzo = {
  id: string
  display_id: number
  status: string
  email: string | null
  currency_code: string
  created_at: string
  canceled_at: string | null
  customer_id: string | null
  metadata: Metadati
  total: number
  subtotal: number
  item_total: number
  shipping_total: number
  tax_total: number
  discount_total: number
  customer?: { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null
  sales_channel?: { name: string } | null
  shipping_address?: Indirizzo | null
  billing_address?: Indirizzo | null
  shipping_methods?: { id: string; name: string; amount: number; shipping_option_id: string | null }[] | null
  items?: Riga[] | null
  fulfillments?: Collo[] | null
  payment_collections?: Incasso[] | null
  payment_status?: string
  summary?: { pending_difference?: number; paid_total?: number; refunded_total?: number } | null
}

const CAMPI = [
  "id",
  "display_id",
  "status",
  "email",
  "currency_code",
  "created_at",
  "canceled_at",
  "customer_id",
  "metadata",
  "total",
  "subtotal",
  "item_total",
  "shipping_total",
  "tax_total",
  "discount_total",
  "customer.id",
  "customer.first_name",
  "customer.last_name",
  "customer.email",
  "customer.phone",
  "sales_channel.name",
  "shipping_address.*",
  "billing_address.*",
  "shipping_methods.*",
  "items.*",
  "items.total",
  "items.offer.id",
  "items.offer.seller_id",
  "items.offer.sku",
  "items.offer.metadata",
  "fulfillments.*",
  "fulfillments.labels.*",
  "fulfillments.items.*",
  "summary.*",
]

const BLOCCO = 200
/** L'elenco si compone in memoria: oltre questo limite restano gli ordini più recenti. */
export const MASSIMO_ORDINI = 2000

const query = (scope: MedusaContainer) => scope.resolve(ContainerRegistrationKeys.QUERY)

/** Query restituisce oggetti Date: da qui in poi le date sono testi ISO, confrontabili e pronti per JSON. */
export const dati = <T>(valore: unknown) => JSON.parse(JSON.stringify(valore)) as T

export const ordineAssente = () => new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")

/** Il pagamento sta sul carrello finché non è incassato: Mercur lo riporta sull'ordine. */
export async function leggiOrdini(scope: MedusaContainer, filtri: Record<string, unknown> = {}): Promise<OrdineGrezzo[]> {
  const ordini: OrdineGrezzo[] = []
  for (let skip = 0; skip < MASSIMO_ORDINI; skip += BLOCCO) {
    const { data } = await query(scope).graph({
      entity: "order",
      fields: withCartPaymentCollectionFields(CAMPI),
      filters: { is_draft_order: false, ...filtri },
      pagination: { skip, take: BLOCCO, order: { created_at: "DESC" } },
    })
    const blocco = dati<OrdineGrezzo[]>(data)
    for (const ordine of blocco) normalizeOrderPaymentCollections(ordine as never)
    ordini.push(...blocco)
    if (blocco.length < BLOCCO) break
  }
  return ordini
}

export type Legami = {
  /** Ordine → gruppo d'ordine di Mercur. */
  gruppi: Map<string, string>
  /** Ordine → aziende collegate. */
  aziende: Map<string, string[]>
  /** Azienda → nome. */
  nomi: Map<string, string>
}

/** Mercur lega un ordine a una sola azienda: una bozza con più aziende le elenca nei metadati. */
const aziendeNeiMetadati = (o: { metadata: Metadati }) => (Array.isArray(o.metadata?.aziende) ? (o.metadata?.aziende as string[]) : [])

export async function leggiLegami(scope: MedusaContainer, ordini: Pick<OrdineGrezzo, "id" | "metadata">[]): Promise<Legami> {
  const legami: Legami = { gruppi: new Map(), aziende: new Map(), nomi: new Map() }
  if (!ordini.length) return legami
  const ids = ordini.map((o) => o.id)
  const [{ data: gruppi }, { data: venditori }] = await Promise.all([
    query(scope).graph({ entity: "order_group_order", fields: ["order_id", "order_group_id"], filters: { order_id: ids } }),
    query(scope).graph({ entity: "order_seller", fields: ["order_id", "seller_id"], filters: { order_id: ids } }),
  ])
  for (const g of gruppi as unknown as { order_id: string; order_group_id: string }[]) legami.gruppi.set(g.order_id, g.order_group_id)
  const coppie = [
    ...(venditori as unknown as { order_id: string; seller_id: string }[]),
    ...ordini.flatMap((o) => aziendeNeiMetadati(o).map((seller_id) => ({ order_id: o.id, seller_id }))),
  ]
  for (const v of coppie) {
    const elenco = legami.aziende.get(v.order_id) ?? []
    if (!elenco.includes(v.seller_id)) legami.aziende.set(v.order_id, [...elenco, v.seller_id])
  }
  const aziende = [...new Set(coppie.map((v) => v.seller_id))]
  if (aziende.length) {
    const { data } = await query(scope).graph({ entity: "seller", fields: ["id", "name"], filters: { id: aziende } })
    for (const a of data as unknown as { id: string; name: string }[]) legami.nomi.set(a.id, a.name)
  }
  return legami
}

/** Tutti gli ordini che un'azienda deve evadere: il legame è quello verificato da Mercur. */
export async function ordiniDiAzienda(scope: MedusaContainer, azienda: string): Promise<string[]> {
  const [{ data: legati }, { data: ordini }] = await Promise.all([
    query(scope).graph({ entity: "order_seller", fields: ["order_id"], filters: { seller_id: azienda } }),
    query(scope).graph({ entity: "order", fields: ["id", "metadata"], filters: { is_draft_order: false }, pagination: { take: MASSIMO_ORDINI, order: { created_at: "DESC" } } }),
  ])
  const nominati = (ordini as unknown as { id: string; metadata: Metadati }[]).filter((o) => aziendeNeiMetadati(o).includes(azienda)).map((o) => o.id)
  return [...new Set([...(legati as unknown as { order_id: string }[]).map((o) => o.order_id), ...nominati])]
}

/** Da un id di gruppo o di ordine agli ordini che compongono l'ordine unico del cliente. */
export async function ordiniCollegati(scope: MedusaContainer, id: string): Promise<string[]> {
  if (!id.startsWith("og_")) {
    const { data } = await query(scope).graph({ entity: "order_group_order", fields: ["order_group_id"], filters: { order_id: id } })
    const gruppo = (data as unknown as { order_group_id: string }[])[0]?.order_group_id
    return gruppo ? ordiniCollegati(scope, gruppo) : [id]
  }
  const { data } = await query(scope).graph({ entity: "order_group_order", fields: ["order_id"], filters: { order_group_id: id } })
  return (data as unknown as { order_id: string }[]).map((o) => o.order_id)
}

export const giorniMassimi = async (scope: MedusaContainer) => (await leggiImpostazioni(scope)).spedizioni.giorni_max_evasione
