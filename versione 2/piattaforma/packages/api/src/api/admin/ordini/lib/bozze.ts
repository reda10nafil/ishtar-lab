import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, OrderStatus } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  addDraftOrderItemsWorkflow,
  beginDraftOrderEditWorkflow,
  confirmDraftOrderEditWorkflow,
  convertDraftOrderWorkflow,
  createOrderWorkflow,
  updateDraftOrderItemWorkflow,
} from "@medusajs/medusa/core-flows"
import { MercurModules } from "@mercurjs/types"
import { interroga, valida } from "../../../utili"
import { leggiScorte } from "../../magazzino/lib/scorte"
import { autore, inFilaOrdine, nonValido, servizioOrdini } from "./comune"
import { dati as comeDati, ordineAssente, type Indirizzo, type Metadati } from "./lettura"

type RigaBozza = { id: string; title: string; product_title: string | null; variant_title: string | null; variant_id: string | null; thumbnail: string | null; unit_price: number; quantity: number; total: number; metadata: Metadati }

type BozzaGrezza = {
  id: string
  display_id: number
  email: string | null
  currency_code: string
  created_at: string
  total: number
  metadata: Metadati
  customer?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null
  shipping_address?: Indirizzo | null
  shipping_methods?: { name: string; amount: number }[] | null
  items?: RigaBozza[] | null
}

const CAMPI = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "created_at",
  "total",
  "metadata",
  "customer.id",
  "customer.first_name",
  "customer.last_name",
  "customer.email",
  "shipping_address.*",
  "shipping_methods.*",
  "items.*",
]

async function leggiBozze(req: AuthenticatedMedusaRequest, id?: string): Promise<BozzaGrezza[]> {
  const { data } = await interroga(req).graph({
    entity: "order",
    fields: CAMPI,
    filters: { is_draft_order: true, status: OrderStatus.DRAFT, ...(id ? { id } : {}) },
    pagination: { take: 200, order: { created_at: "DESC" } },
  })
  return comeDati<BozzaGrezza[]>(data)
}

const nomeDi = (b: BozzaGrezza) =>
  [b.customer?.first_name, b.customer?.last_name].filter(Boolean).join(" ") ||
  [b.shipping_address?.first_name, b.shipping_address?.last_name].filter(Boolean).join(" ") ||
  b.shipping_address?.company ||
  null

const schedaBozza = (b: BozzaGrezza) => ({
  id: b.id,
  numero: b.display_id,
  cliente_id: b.customer?.id ?? null,
  creata_il: b.created_at,
  creata_da: (b.metadata?.creata_da as string | undefined) ?? (b.metadata?.ingrosso_trattativa_id ? "Wholesale" : null),
  cliente: nomeDi(b),
  email: b.email ?? b.customer?.email ?? null,
  ha_indirizzo: Boolean(b.shipping_address?.address_1),
  nota: (b.metadata?.nota as string | undefined) ?? null,
  origine: b.metadata?.ingrosso_trattativa_id ? "ingrosso" : "manuale",
  consegna: (b.shipping_methods ?? [])[0]?.name ?? null,
  valuta: b.currency_code,
  totale: Number(b.total),
  righe: (b.items ?? []).map((r) => ({
    id: r.id,
    titolo: r.product_title ?? r.title,
    variante: r.variant_title,
    miniatura: r.thumbnail,
    prezzo: Number(r.unit_price),
    quantita: Number(r.quantity),
    totale: Number(r.total),
  })),
})

export const elencoBozze = async (req: AuthenticatedMedusaRequest) => {
  const bozze = await leggiBozze(req)
  return { bozze: bozze.map(schedaBozza), conteggio: bozze.length }
}

export const contaBozze = async (req: AuthenticatedMedusaRequest) => (await leggiBozze(req)).length

type OffertaGrezza = {
  id: string
  sku: string | null
  seller_id: string
  variant_id: string
  metadata?: Metadati
  seller?: { name: string } | null
  product?: { title: string | null; thumbnail: string | null } | null
  product_variant?: { title: string | null } | null
  prices?: { amount: number; currency_code: string }[] | null
  inventory_items?: { id: string }[] | null
}

/** Ciò che serve al modulo New order: offerte vendibili, clienti e consegne esistenti. */
export async function opzioniBozza(req: AuthenticatedMedusaRequest) {
  const query = interroga(req)
  const [{ data: offerte }, { data: clienti }, { data: opzioni }, { righe }] = await Promise.all([
    query.graph({
      entity: "offer",
      fields: ["id", "sku", "seller_id", "variant_id", "seller.name", "product.title", "product.thumbnail", "product_variant.title", "prices.amount", "prices.currency_code", "inventory_items.id"],
      pagination: { take: 500, order: { created_at: "DESC" } },
    }),
    query.graph({ entity: "customer", fields: ["id", "first_name", "last_name", "email", "addresses.*"], pagination: { take: 500, order: { created_at: "DESC" } } }),
    query.graph({ entity: "shipping_option", fields: ["id", "name", "prices.amount", "prices.currency_code"] }),
    leggiScorte(req),
  ])
  const disponibili = new Map(righe.map((r) => [r.articolo_id, r.disponibili]))
  type Opzione = { name: string; prices?: { amount: number; currency_code: string }[] | null }
  type Cliente = { id: string; first_name: string | null; last_name: string | null; email: string | null; addresses?: (Indirizzo & { is_default_shipping?: boolean })[] | null }
  const consegne = new Map<string, { nome: string; importo: number }>()
  for (const o of opzioni as unknown as Opzione[]) {
    const prezzo = o.prices?.find((p) => p.currency_code === "eur") ?? o.prices?.[0]
    if (prezzo && !consegne.has(o.name)) consegne.set(o.name, { nome: o.name, importo: Number(prezzo.amount) })
  }
  return {
    offerte: (offerte as unknown as OffertaGrezza[])
      .map((o) => {
        const prezzo = o.prices?.find((p) => p.currency_code === "eur") ?? o.prices?.[0]
        return {
          id: o.id,
          titolo: o.product?.title ?? o.sku ?? "Item",
          variante: o.product_variant?.title ?? null,
          sku: o.sku,
          azienda: o.seller?.name ?? null,
          miniatura: o.product?.thumbnail ?? null,
          prezzo: prezzo ? Number(prezzo.amount) : null,
          disponibili: disponibili.get(o.inventory_items?.[0]?.id ?? "") ?? null,
        }
      })
      .filter((o) => o.prezzo !== null)
      .sort((a, b) => a.titolo.localeCompare(b.titolo, "en") || (a.variante ?? "").localeCompare(b.variante ?? "", "en")),
    clienti: (clienti as unknown as Cliente[]).map((c) => {
      const a = c.addresses?.find((x) => x.is_default_shipping) ?? c.addresses?.[0]
      return {
        id: c.id,
        nome: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Customer",
        email: c.email,
        indirizzo: a?.address_1 ? { nome: [a.first_name, a.last_name].filter(Boolean).join(" "), via: a.address_1, citta: a.city ?? "", cap: a.postal_code ?? "", paese: a.country_code ?? "it", telefono: a.phone ?? "" } : null,
      }
    }),
    consegne: [...consegne.values()],
  }
}

const Spedire = z.object({
  nome: z.string({ error: "Enter the recipient's name" }).trim().min(2, "Enter the recipient's name").max(120, "The name is too long"),
  via: z.string({ error: "Enter the street and number" }).trim().min(3, "Enter the street and number").max(200, "The address is too long"),
  citta: z.string({ error: "Enter the city" }).trim().min(1, "Enter the city").max(120, "The city is too long"),
  cap: z.string({ error: "Enter the postcode" }).trim().min(2, "Enter the postcode").max(12, "The postcode is too long"),
  paese: z.string().trim().length(2, "Choose the country").toLowerCase(),
  telefono: z.string().trim().max(40, "The phone number is too long").optional(),
})

const NuovaBozza = z.object({
  cliente_id: z.string().min(1).optional(),
  email: z.string({ error: "Choose a customer or enter an email" }).trim().toLowerCase().email("Enter a valid email"),
  indirizzo: Spedire.optional(),
  nota: z.string().trim().max(500, "The note is too long").optional(),
  consegna: z.object({ nome: z.string().trim().min(1).max(120), importo: z.number().min(0) }).optional(),
  righe: z
    .array(z.object({ offerta_id: z.string().min(1), quantita: z.number({ error: "Enter a quantity" }).int("Enter a whole quantity").min(1, "Enter a quantity").max(9999, "This quantity is too high") }), {
      error: "Add at least one product",
    })
    .min(1, "Add at least one product")
    .max(100, "Too many lines in one order"),
  conferma: z.boolean().optional(),
})

const indirizzoMedusa = (i: z.infer<typeof Spedire>) => {
  const [nome, ...resto] = i.nome.split(/\s+/)
  return { first_name: nome, last_name: resto.join(" ") || undefined, address_1: i.via, city: i.citta, postal_code: i.cap, country_code: i.paese, phone: i.telefono || undefined }
}

export async function creaBozza(req: AuthenticatedMedusaRequest, corpo: unknown) {
  const dati = valida(NuovaBozza, corpo)
  const query = interroga(req)
  const [{ data: regioni }, { data: canali }, { data: offerte }] = await Promise.all([
    query.graph({ entity: "region", fields: ["id", "currency_code"], pagination: { take: 1 } }),
    query.graph({ entity: "sales_channel", fields: ["id"], filters: { is_disabled: false }, pagination: { take: 1 } }),
    query.graph({
      entity: "offer",
      fields: ["id", "variant_id", "prices.amount", "prices.currency_code", "product.title", "product.thumbnail", "product_variant.title"],
      filters: { id: dati.righe.map((r) => r.offerta_id) },
    }),
  ])
  const regione = (regioni as unknown as { id: string; currency_code: string }[])[0]
  const canale = (canali as unknown as { id: string }[])[0]
  if (!regione) throw nonValido("There is no sales region yet")
  if (!canale) throw nonValido("There is no active sales channel")
  const perOfferta = new Map((offerte as unknown as (OffertaGrezza & { id: string })[]).map((o) => [o.id, o]))
  const items = dati.righe.map((r) => {
    const offerta = perOfferta.get(r.offerta_id)
    if (!offerta) throw nonValido("A product in this order is no longer on sale")
    const prezzo = offerta.prices?.find((p) => p.currency_code === regione.currency_code) ?? offerta.prices?.[0]
    if (!prezzo) throw nonValido("A product in this order has no price")
    return {
      title: offerta.product?.title ?? "Item",
      quantity: r.quantita,
      unit_price: Number(prezzo.amount),
      variant_id: offerta.variant_id,
      metadata: { offer_id: offerta.id },
    }
  })
  const indirizzo = dati.indirizzo ? indirizzoMedusa(dati.indirizzo) : undefined
  const { result } = await createOrderWorkflow(req.scope).run({
    input: {
      status: OrderStatus.DRAFT,
      is_draft_order: true,
      no_notification: true,
      region_id: regione.id,
      currency_code: regione.currency_code,
      sales_channel_id: canale.id,
      email: dati.email,
      customer_id: dati.cliente_id,
      shipping_address: indirizzo,
      billing_address: indirizzo,
      items,
      shipping_methods: dati.consegna ? [{ name: dati.consegna.nome, amount: dati.consegna.importo }] : undefined,
      metadata: { creata_da: await autore(req), ...(dati.nota ? { nota: dati.nota } : {}) },
    } as never,
  })
  if (dati.conferma) await confermaBozza(req, result.id, {})
  return { id: result.id, numero: result.display_id }
}

const Conferma = z.object({
  indirizzo: Spedire.optional(),
  cliente_id: z.string().min(1).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional(),
  righe: z.array(z.object({ id: z.string().min(1), quantita: z.number().int().min(0).max(9999) })).optional(),
  aggiunte: z.array(z.object({ offerta_id: z.string().min(1), quantita: z.number().int().min(1).max(9999) })).optional(),
})

/** Righe cambiate nel modulo: passano dalla modifica di bozza di Medusa, così i totali restano giusti. */
async function modificaRighe(req: AuthenticatedMedusaRequest, bozza: BozzaGrezza, dati: z.infer<typeof Conferma>) {
  const cambiate = (dati.righe ?? []).filter((r) => Number(bozza.items?.find((i) => i.id === r.id)?.quantity) !== r.quantita)
  const aggiunte = dati.aggiunte ?? []
  if (!cambiate.length && !aggiunte.length) return
  const order_id = bozza.id
  await beginDraftOrderEditWorkflow(req.scope).run({ input: { order_id } })
  if (cambiate.length) await updateDraftOrderItemWorkflow(req.scope).run({ input: { order_id, items: cambiate.map((r) => ({ id: r.id, quantity: r.quantita })) } })
  if (aggiunte.length) {
    const { data } = await interroga(req).graph({ entity: "offer", fields: ["id", "variant_id", "prices.amount", "prices.currency_code"], filters: { id: aggiunte.map((a) => a.offerta_id) } })
    const offerte = data as unknown as OffertaGrezza[]
    const items = aggiunte.flatMap((a) => {
      const offerta = offerte.find((o) => o.id === a.offerta_id)
      const prezzo = offerta?.prices?.find((p) => p.currency_code === bozza.currency_code) ?? offerta?.prices?.[0]
      return offerta && prezzo ? [{ variant_id: offerta.variant_id, quantity: a.quantita, unit_price: Number(prezzo.amount), metadata: { offer_id: offerta.id } }] : []
    })
    if (items.length) await addDraftOrderItemsWorkflow(req.scope).run({ input: { order_id, items } })
  }
  await confirmDraftOrderEditWorkflow(req.scope).run({ input: { order_id, confirmed_by: req.auth_context.actor_id } })
}

async function offertaDiVariante(req: AuthenticatedMedusaRequest, varianti: string[]) {
  if (!varianti.length) return new Map<string, { id: string; seller_id: string }>()
  const { data } = await interroga(req).graph({ entity: "offer", fields: ["id", "seller_id", "variant_id"], filters: { variant_id: varianti } })
  const mappa = new Map<string, { id: string; seller_id: string }>()
  for (const o of data as unknown as { id: string; seller_id: string; variant_id: string }[]) if (!mappa.has(o.variant_id)) mappa.set(o.variant_id, o)
  return mappa
}

type Assegnata = { riga: RigaBozza; offerta: string; azienda: string }

async function assegnaRighe(req: AuthenticatedMedusaRequest, bozza: BozzaGrezza): Promise<Assegnata[]> {
  const righe = bozza.items ?? []
  const dirette = righe.map((r) => r.metadata?.offer_id).filter(Boolean) as string[]
  const { data } = dirette.length ? await interroga(req).graph({ entity: "offer", fields: ["id", "seller_id"], filters: { id: dirette } }) : { data: [] }
  const perId = new Map((data as unknown as { id: string; seller_id: string }[]).map((o) => [o.id, o]))
  const perVariante = await offertaDiVariante(req, righe.filter((r) => !r.metadata?.offer_id && r.variant_id).map((r) => r.variant_id as string))
  const assegnate: Assegnata[] = []
  for (const riga of righe) {
    const offerta = perId.get(riga.metadata?.offer_id as string) ?? perVariante.get(riga.variant_id ?? "")
    if (offerta) assegnate.push({ riga, offerta: offerta.id, azienda: offerta.seller_id })
  }
  return assegnate
}

/** Riserva le stesse scorte che riserverebbe il checkout: l'evasione poi le scala. */
async function riserva(req: AuthenticatedMedusaRequest, assegnate: Assegnata[]) {
  const { data } = await interroga(req).graph({
    entity: "offer",
    fields: ["id", "inventory_item_link.required_quantity", "inventory_item_link.inventory_item.id"],
    filters: { id: [...new Set(assegnate.map((a) => a.offerta))] },
  })
  type Offerta = { id: string; inventory_item_link?: { required_quantity?: number; inventory_item?: { id: string } | null }[] | null }
  const perOfferta = new Map((data as unknown as Offerta[]).map((o) => [o.id, o]))
  const { righe } = await leggiScorte(req)
  const voci = assegnate.flatMap((a) =>
    (perOfferta.get(a.offerta)?.inventory_item_link ?? []).flatMap((legame) => {
      const riga = righe.find((r) => r.articolo_id === legame.inventory_item?.id && r.azienda_id === a.azienda)
      if (!riga) return []
      const quantita = Number(a.riga.quantity) * (legame.required_quantity ?? 1)
      if (riga.disponibili < quantita) throw nonValido(`Not enough stock for ${a.riga.product_title ?? a.riga.title}: ${riga.disponibili} left`)
      return [{ line_item_id: a.riga.id, inventory_item_id: riga.articolo_id, location_id: riga.deposito_id, quantity: quantita }]
    })
  )
  if (!voci.length) return []
  return req.scope.resolve(Modules.INVENTORY).createReservationItems(voci)
}

/** Mercur accetta una sola azienda per ordine: con più aziende vale l'elenco nei metadati e il legame riga-offerta. */
async function collega(req: AuthenticatedMedusaRequest, bozza: BozzaGrezza, assegnate: Assegnata[]) {
  const link = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const aziende = [...new Set(assegnate.map((a) => a.azienda))]
  await link.create(assegnate.map((a) => ({ [Modules.ORDER]: { order_line_item_id: a.riga.id }, [MercurModules.OFFER]: { offer_id: a.offerta } })))
  if (aziende.length === 1) await link.create({ [Modules.ORDER]: { order_id: bozza.id }, [MercurModules.SELLER]: { seller_id: aziende[0] } })
  else await servizioOrdini(req).updateOrders([{ id: bozza.id, metadata: { ...bozza.metadata, aziende } }])
}

/** La bozza diventa un ordine vero: scorte riservate, aziende avvisate tramite le loro richieste. */
export function confermaBozza(req: AuthenticatedMedusaRequest, id: string, corpo: unknown) {
  const dati = valida(Conferma, corpo ?? {})
  const { indirizzo } = dati
  return inFilaOrdine(req, id, async () => {
    const [letta] = await leggiBozze(req, id)
    if (!letta) throw ordineAssente()
    await modificaRighe(req, letta, dati)
    if (dati.email || dati.cliente_id) await servizioOrdini(req).updateOrders([{ id, ...(dati.email ? { email: dati.email } : {}), ...(dati.cliente_id ? { customer_id: dati.cliente_id } : {}) }] as never)
    const [bozza] = await leggiBozze(req, id)
    if (!bozza) throw ordineAssente()
    if (!bozza.items?.length) throw nonValido("Add at least one product to this draft")
    if (!bozza.email && !bozza.customer?.email) throw nonValido("Add a customer to this draft first")
    if (!bozza.shipping_address?.address_1 && !indirizzo) throw nonValido("Add a delivery address first")
    if (indirizzo) {
      const nuovo = indirizzoMedusa(indirizzo)
      await servizioOrdini(req).updateOrders([{ id, shipping_address: nuovo, billing_address: nuovo }] as never)
    }
    const assegnate = await assegnaRighe(req, bozza)
    const riservate = assegnate.length ? await riserva(req, assegnate) : []
    try {
      await convertDraftOrderWorkflow(req.scope).run({ input: { id } })
    } catch (errore) {
      if (riservate.length) await req.scope.resolve(Modules.INVENTORY).deleteReservationItems(riservate.map((r: { id: string }) => r.id))
      req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER).warn(`Bozza ${id} non convertita: ${(errore as Error).message}`)
      throw nonValido("This draft could not become an order: check its items")
    }
    if (assegnate.length) await collega(req, bozza, assegnate)
    return id
  })
}

