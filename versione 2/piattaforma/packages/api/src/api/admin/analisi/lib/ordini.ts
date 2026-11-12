import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ordineValido } from "../../clienti/lib/segmenti"
import { leggiLegami } from "../../ordini/lib/lettura"
import { canaleDi, type Canale } from "../../ordini/lib/unico"

export type Riga = {
  prodotto_id: string | null
  titolo: string
  variante: string | null
  miniatura: string | null
  quantita: number
  importo: number
  netto: number
  offerta_id: string | null
  outfit_id: string | null
}

export type Ordine = {
  id: string
  numero: number | null
  creato_il: Date
  cliente_id: string | null
  cliente: string | null
  gruppo_id: string | null
  canale: Canale
  azienda_id: string | null
  azienda: string | null
  totale: number
  valuta: string | null
  stato: string
  stato_evasione: string | null
  valido: boolean
  righe: Riga[]
}

type Metadati = Record<string, unknown> | null | undefined

type RigaGrezza = {
  product_id?: string | null
  product_title?: string | null
  title?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  quantity?: unknown
  total?: unknown
  tax_total?: unknown
  metadata?: Metadati
  detail?: { fulfilled_quantity?: unknown; shipped_quantity?: unknown } | null
}

export type OrdineGrezzo = {
  id: string
  display_id?: number | null
  status?: string | null
  is_draft_order?: boolean | null
  created_at: string | Date
  currency_code?: string | null
  customer_id?: string | null
  email?: string | null
  total?: unknown
  metadata?: Metadati
  seller?: { id?: string | null; name?: string | null } | null
  customer?: { first_name?: string | null; last_name?: string | null } | null
  shipping_address?: { first_name?: string | null; last_name?: string | null } | null
  items?: (RigaGrezza | null)[] | null
}

const CAMPI = [
  "id",
  "display_id",
  "status",
  "is_draft_order",
  "created_at",
  "currency_code",
  "customer_id",
  "email",
  "total",
  "metadata",
  "seller.id",
  "seller.name",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "items.product_id",
  "items.product_title",
  "items.title",
  "items.variant_title",
  "items.thumbnail",
  "items.quantity",
  "items.total",
  "items.tax_total",
  "items.metadata",
  "items.detail.fulfilled_quantity",
  "items.detail.shipped_quantity",
]

const BLOCCO = 500

const nomeDi = (o: OrdineGrezzo) => {
  const dalCliente = [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ")
  const dallIndirizzo = [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ")
  return dalCliente || dallIndirizzo || o.email || null
}

const testo = (valore: unknown) => (typeof valore === "string" && valore ? valore : null)

function rigaDi(r: RigaGrezza): Riga {
  const importo = Number(r.total ?? 0)
  return {
    prodotto_id: r.product_id ?? null,
    titolo: r.product_title ?? r.title ?? "Product",
    variante: r.variant_title ?? null,
    miniatura: r.thumbnail ?? null,
    quantita: Number(r.quantity ?? 0),
    importo,
    netto: importo - Number(r.tax_total ?? 0),
    offerta_id: testo(r.metadata?.offer_id),
    outfit_id: testo(r.metadata?.outfit_id),
  }
}

/** Stessa lettura di Orders: conta i pezzi preparati e spediti, riga per riga. */
function evasioneDi(righe: RigaGrezza[]) {
  const quanti = righe.reduce((n, r) => n + Number(r.quantity ?? 0), 0)
  const preparati = righe.reduce((n, r) => n + Number(r.detail?.fulfilled_quantity ?? 0), 0)
  const spediti = righe.reduce((n, r) => n + Number(r.detail?.shipped_quantity ?? 0), 0)
  if (quanti && spediti >= quanti) return "shipped"
  if (quanti && preparati >= quanti) return "fulfilled"
  return preparati ? "partially_fulfilled" : "not_fulfilled"
}

export function normalizza(o: OrdineGrezzo, gruppo: string | null = null): Ordine {
  return {
    id: o.id,
    numero: o.display_id ?? null,
    creato_il: new Date(o.created_at),
    cliente_id: o.customer_id ?? null,
    cliente: nomeDi(o),
    gruppo_id: gruppo,
    canale: canaleDi(o as never),
    azienda_id: o.seller?.id ?? null,
    azienda: o.seller?.name ?? null,
    totale: Number(o.total ?? 0),
    valuta: o.currency_code ?? null,
    stato: o.status ?? "pending",
    stato_evasione: evasioneDi((o.items ?? []).filter((r): r is RigaGrezza => Boolean(r))),
    valido: ordineValido(o as unknown as Parameters<typeof ordineValido>[0]),
    righe: (o.items ?? []).filter((r): r is RigaGrezza => Boolean(r)).map(rigaDi),
  }
}

/**
 * Mercur divide un acquisto in un ordine per azienda: `gruppo_id` li riunisce, come fa la sezione Orders.
 * Con `azienda` il filtro passa dal legame ordine-azienda di Mercur, dentro la query.
 * Lettura diretta: il flusso di lavoro di `/admin/orders` costa secondi anche con pochi ordini.
 */
export async function leggiOrdini(scope: MedusaContainer, { da, azienda }: { da: Date; azienda?: string }): Promise<Ordine[]> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const grezzi: OrdineGrezzo[] = []
  const filtri: Record<string, unknown> = { is_draft_order: false, created_at: { $gte: da.toISOString() } }
  if (azienda) filtri.seller = { id: azienda }
  for (let skip = 0; ; skip += BLOCCO) {
    const { data } = await query.graph({ entity: "order", fields: CAMPI, filters: filtri, pagination: { skip, take: BLOCCO, order: { created_at: "DESC" } } })
    const righe = data as unknown as OrdineGrezzo[]
    grezzi.push(...righe)
    if (righe.length < BLOCCO) break
  }
  const { gruppi } = await leggiLegami(scope, grezzi as never)
  return grezzi.map((o) => normalizza(o, gruppi.get(o.id) ?? null))
}
