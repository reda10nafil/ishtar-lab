import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules, OrderStatus } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  cancelOrderFulfillmentWorkflow,
  cancelOrderWorkflow,
  convertDraftOrderWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderPaymentCollectionWorkflow,
  createOrderWorkflow,
  createReservationsWorkflow,
  deleteDraftOrdersWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
  markPaymentCollectionAsPaid,
} from "@medusajs/medusa/core-flows"
import { MercurModules } from "@mercurjs/types"
import { interroga, invalido, rifiutato } from "../../../utili"
import { chi, inFila } from "../../carte-regalo/comune"
import { leggiImpostazioni } from "../../impostazioni/lettura"
import { calcolaConto, type Conto } from "./conto"
import { contestoCassa, type ContestoCassa } from "./contesto"

/** Così gli ordini della cassa si riconoscono fra tutti gli altri. */
export const CANALE_CASSA = "cassa"

const NOME_NEGOZIO = "Ishtar Lab"

export const NuovaVendita = z.object({
  righe: z
    .array(
      z.object({
        offerta_id: z.string({ error: "A basket line has no product" }).min(1, "A basket line has no product"),
        quantita: z.number({ error: "Enter a quantity" }).int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(9999, "That quantity is too high"),
      }),
      { error: "The basket is empty" }
    )
    .min(1, "The basket is empty")
    .max(100, "Too many lines in one sale"),
  codice: z.string().trim().toUpperCase().max(40).nullish(),
  cliente_id: z.string().nullish(),
  metodo: z.enum(["contanti", "carta"], { error: "Choose how the customer is paying" }),
  ricevuto: z.number({ error: "Enter the cash handed over" }).min(0, "The cash handed over can't be negative").max(1000000, "That amount is too high").nullish(),
  totale_atteso: z.number({ error: "The basket total is missing" }),
})

type DatiVendita = z.infer<typeof NuovaVendita>
type Cliente = { id: string; email: string; nome: string } | null

const arrotonda = (valore: number) => Math.round(valore * 100) / 100

type OrdineCreato = {
  id: string
  display_id: number
  total: unknown
  created_at: string
  items: { id: string; metadata: Record<string, unknown> | null; quantity: number }[]
}

async function leggiOrdine(req: AuthenticatedMedusaRequest, id: string) {
  const { data } = await interroga(req).graph({ entity: "order", fields: ["id", "display_id", "total", "created_at", "items.id", "items.metadata", "items.quantity"], filters: { id } })
  const ordine = data[0] as unknown as OrdineCreato | undefined
  if (!ordine) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sale not found")
  return ordine
}

async function clienteDi(req: AuthenticatedMedusaRequest, id: string | null | undefined): Promise<Cliente> {
  if (!id) return null
  const { data } = await interroga(req).graph({ entity: "customer", fields: ["id", "email", "first_name", "last_name"], filters: { id } })
  const cliente = data[0] as { id: string; email: string; first_name: string | null; last_name: string | null } | undefined
  if (!cliente) throw invalido("That customer no longer exists")
  return { id: cliente.id, email: cliente.email, nome: [cliente.first_name, cliente.last_name].filter(Boolean).join(" ") || cliente.email }
}

function controllaScorte({ righe }: Conto) {
  for (const riga of righe) {
    if (!riga.offerta.deposito_id) throw invalido(`${riga.prodotto} has no stock in any warehouse: add it under Products, in Inventory`)
    if (riga.quantita > riga.offerta.disponibili) throw invalido(`Only ${riga.offerta.disponibili} of ${riga.prodotto} (${riga.taglia}) left`)
  }
}

function controllaPagamento({ metodo, ricevuto }: DatiVendita, totale: number) {
  if (metodo !== "contanti") return { ricevuto: totale, resto: 0 }
  const contanti = ricevuto ?? 0
  if (contanti < totale) throw invalido("The cash handed over doesn't cover the total")
  return { ricevuto: contanti, resto: arrotonda(contanti - totale) }
}

async function creaBozza(req: AuthenticatedMedusaRequest, conto: Conto, contesto: ContestoCassa, cliente: Cliente, metadata: Record<string, unknown>) {
  const { result } = await createOrderWorkflow(req.scope).run({
    input: {
      status: OrderStatus.DRAFT,
      is_draft_order: true,
      no_notification: true,
      region_id: contesto.regione?.id,
      currency_code: contesto.valuta,
      sales_channel_id: contesto.canaleId,
      customer_id: cliente?.id,
      email: cliente?.email,
      shipping_address: { country_code: contesto.paese },
      promo_codes: conto.codice ? [conto.codice] : [],
      items: conto.righe.map((r) => ({
        title: r.prodotto,
        variant_id: r.offerta.variante_id,
        quantity: r.quantita,
        unit_price: r.offerta.prezzo,
        is_tax_inclusive: true,
        requires_shipping: false,
        metadata: { offerta: r.offerta.id, azienda_id: r.offerta.azienda_id, azienda: r.offerta.azienda, deposito_id: r.offerta.deposito_id, taglia: r.taglia },
      })),
      metadata,
    } as never,
  })
  return (result as { id: string }).id
}

const offertaDi = (riga: OrdineCreato["items"][number], conto: Conto) => {
  const trovata = conto.righe.find((r) => r.offerta.id === riga.metadata?.offerta)
  if (!trovata) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Sale line without an offer")
  return trovata.offerta
}

/** Le offerte non sono legate alla variante: le riserve si scrivono qui, l'evasione poi scala le scorte. */
async function riserva(req: AuthenticatedMedusaRequest, ordine: OrdineCreato, conto: Conto) {
  const reservations = ordine.items.flatMap((riga) => {
    const offerta = offertaDi(riga, conto)
    return offerta.voci.map((voce) => ({
      line_item_id: riga.id,
      inventory_item_id: voce.voce_id,
      location_id: offerta.deposito_id as string,
      quantity: voce.per_unita * riga.quantity,
    }))
  })
  await createReservationsWorkflow(req.scope).run({ input: { reservations } })
}

async function incassa(req: AuthenticatedMedusaRequest, ordineId: string, importo: number) {
  if (importo <= 0) return
  const { result } = await createOrderPaymentCollectionWorkflow(req.scope).run({ input: { order_id: ordineId, amount: importo } })
  await markPaymentCollectionAsPaid(req.scope).run({
    input: { order_id: ordineId, payment_collection_id: result[0].id, captured_by: req.auth_context.actor_id },
  })
}

/** Chi compra in negozio porta via la merce: l'evasione nasce già consegnata, un deposito alla volta. */
async function consegna(req: AuthenticatedMedusaRequest, ordine: OrdineCreato, conto: Conto, contesto: ContestoCassa) {
  const perDeposito = new Map<string, { id: string; quantity: number }[]>()
  for (const riga of ordine.items) {
    const deposito = offertaDi(riga, conto).deposito_id as string
    perDeposito.set(deposito, [...(perDeposito.get(deposito) ?? []), { id: riga.id, quantity: riga.quantity }])
  }
  for (const [location_id, items] of perDeposito) {
    const { result } = await createOrderFulfillmentWorkflow(req.scope).run({
      input: { order_id: ordine.id, items, location_id, shipping_option_id: contesto.opzioneId, created_by: req.auth_context.actor_id, no_notification: true } as never,
    })
    await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({ input: { orderId: ordine.id, fulfillmentId: result.id } })
  }
}

/** Le righe restano legate alle offerte; un ordine di una sola azienda è visibile a quell'azienda. */
async function collega(req: AuthenticatedMedusaRequest, ordine: OrdineCreato, conto: Conto) {
  const aziende = [...new Set(conto.righe.map((r) => r.offerta.azienda_id))]
  await req.scope.resolve(ContainerRegistrationKeys.LINK).create([
    ...ordine.items.map((riga) => ({
      [Modules.ORDER]: { order_line_item_id: riga.id },
      [MercurModules.OFFER]: { offer_id: offertaDi(riga, conto).id },
    })),
    ...(aziende.length === 1 ? [{ [Modules.ORDER]: { order_id: ordine.id }, [MercurModules.SELLER]: { seller_id: aziende[0] } }] : []),
  ])
}

type Pagamento = { metodo: string; ricevuto: number; resto: number }

function scontrino(ordine: OrdineCreato, conto: Conto, cliente: Cliente, pagamento: Pagamento, indirizzo: string) {
  return {
    id: ordine.id,
    numero: ordine.display_id,
    data: ordine.created_at,
    negozio: NOME_NEGOZIO,
    indirizzo,
    cliente: cliente ? { nome: cliente.nome, email: cliente.email } : null,
    righe: conto.righe.map((r) => ({ prodotto: r.prodotto, taglia: r.taglia, quantita: r.quantita, totale: r.totale })),
    subtotale: conto.subtotale,
    sconto: conto.sconto,
    codice: conto.codice,
    iva: conto.iva,
    totale: Number(ordine.total),
    ...pagamento,
  }
}

async function vendi(req: AuthenticatedMedusaRequest, dati: DatiVendita) {
  const contesto = await contestoCassa(req.scope)
  const [ostacolo] = contesto.mancanti
  if (ostacolo) throw invalido(ostacolo)

  const conto = await calcolaConto(req.scope, contesto, dati.righe, dati.codice || null)
  controllaScorte(conto)
  if (conto.totale !== arrotonda(dati.totale_atteso)) throw invalido("The total has changed: check the basket and charge again")
  const contanti = controllaPagamento(dati, conto.totale)
  const cliente = await clienteDi(req, dati.cliente_id)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const id = await creaBozza(req, conto, contesto, cliente, {
    canale: CANALE_CASSA,
    pagamento: dati.metodo,
    contanti_ricevuti: dati.metodo === "contanti" ? contanti.ricevuto : null,
    resto: dati.metodo === "contanti" ? contanti.resto : null,
    operatore: await chi(req),
  })

  let convertita = false
  try {
    const bozza = await leggiOrdine(req, id)
    if (arrotonda(Number(bozza.total)) !== conto.totale) throw invalido("The total has changed: check the basket and charge again")
    await riserva(req, bozza, conto)
    await convertDraftOrderWorkflow(req.scope).run({ input: { id } })
    convertita = true
    await collega(req, bozza, conto)
    await incassa(req, id, conto.totale)
    await consegna(req, bozza, conto, contesto)
    if (conto.codice) {
      await req.scope.resolve(Modules.PROMOTION).registerUsage([{ amount: conto.sconto, code: conto.codice }], { customer_id: cliente?.id ?? null, customer_email: cliente?.email ?? null })
    }
  } catch (errore) {
    logger.warn(`Vendita in cassa non riuscita su ${id}: ${(errore as Error).message}`)
    await ritira(req, id, convertita).catch((e: Error) => logger.error(`Ordine ${id} da controllare: ${e.message}`))
    if (errore instanceof MedusaError && errore.type === MedusaError.Types.INVALID_DATA) throw errore
    throw invalido("The sale didn't go through and nothing was charged: try again")
  }

  const { indirizzo } = (await leggiImpostazioni(req.scope)).negozio
  return scontrino(await leggiOrdine(req, id), conto, cliente, { metodo: dati.metodo, ...contanti }, indirizzo)
}

export const registraVendita = (req: AuthenticatedMedusaRequest, dati: DatiVendita) => inFila(req, "cassa-vendita", () => vendi(req, dati))

type OrdineDaAnnullare = {
  id: string
  status: string
  metadata: Record<string, unknown> | null
  customer_id: string | null
  email: string | null
  discount_total: unknown
  promotions?: ({ code: string } | null)[]
  fulfillments?: ({ id: string; canceled_at: string | null; location_id: string; items?: ({ inventory_item_id: string | null; quantity: number } | null)[] } | null)[]
}

const CAMPI_ANNULLO = [
  "id",
  "status",
  "metadata",
  "customer_id",
  "email",
  "discount_total",
  "promotions.code",
  "fulfillments.id",
  "fulfillments.canceled_at",
  "fulfillments.location_id",
  "fulfillments.items.inventory_item_id",
  "fulfillments.items.quantity",
]

async function leggiPerAnnullo(req: AuthenticatedMedusaRequest, id: string) {
  const { data } = await interroga(req).graph({ entity: "order", fields: CAMPI_ANNULLO, filters: { id } })
  return data[0] as unknown as OrdineDaAnnullare | undefined
}

/**
 * Annulla le evasioni e rimette in magazzino ciò che era uscito: per le offerte Medusa non lo fa.
 * Medusa rifiuta di annullare un'evasione consegnata: alla cassa la consegna è solo la merce sul banco.
 */
async function rimettiScorte(req: AuthenticatedMedusaRequest, ordine: OrdineDaAnnullare) {
  const inventario = req.scope.resolve(Modules.INVENTORY)
  const evasioni = req.scope.resolve(Modules.FULFILLMENT)
  for (const evasione of ordine.fulfillments ?? []) {
    if (!evasione || evasione.canceled_at) continue
    await evasioni.updateFulfillment(evasione.id, { delivered_at: null } as never)
    await cancelOrderFulfillmentWorkflow(req.scope).run({ input: { order_id: ordine.id, fulfillment_id: evasione.id, no_notification: true, canceled_by: req.auth_context.actor_id } as never })
    for (const voce of evasione.items ?? []) {
      if (voce?.inventory_item_id) await inventario.adjustInventory(voce.inventory_item_id, evasione.location_id, Number(voce.quantity))
    }
  }
}

/** Disfa una vendita a metà: la bozza si elimina, l'ordine già convertito si annulla. */
async function ritira(req: AuthenticatedMedusaRequest, id: string, convertita: boolean) {
  if (!convertita) {
    const { items } = await leggiOrdine(req, id)
    await req.scope.resolve(Modules.INVENTORY).deleteReservationItemsByLineItem(items.map((i) => i.id))
    await deleteDraftOrdersWorkflow(req.scope).run({ input: { order_ids: [id] } })
    return
  }
  const ordine = await leggiPerAnnullo(req, id)
  if (!ordine) return
  await rimettiScorte(req, ordine)
  await cancelOrderWorkflow(req.scope).run({ input: { order_id: id, canceled_by: req.auth_context.actor_id } })
}

async function annulla(req: AuthenticatedMedusaRequest, id: string) {
  const ordine = await leggiPerAnnullo(req, id)
  if (!ordine || ordine.metadata?.canale !== CANALE_CASSA) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sale not found")
  if (ordine.status === "canceled") throw rifiutato("This sale has already been voided")
  await rimettiScorte(req, ordine)
  await cancelOrderWorkflow(req.scope).run({ input: { order_id: id, canceled_by: req.auth_context.actor_id } })
  const codici = (ordine.promotions ?? []).flatMap((p) => (p ? [p.code] : []))
  if (codici.length) {
    await req.scope.resolve(Modules.PROMOTION).revertUsage(codici.map((code) => ({ amount: Number(ordine.discount_total), code })), { customer_id: ordine.customer_id, customer_email: ordine.email })
  }
  return { id, annullata: true }
}

export const annullaVendita = (req: AuthenticatedMedusaRequest, id: string) => inFila(req, "cassa-vendita", () => annulla(req, id))
