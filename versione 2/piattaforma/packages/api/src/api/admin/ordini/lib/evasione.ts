import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createOrderShipmentWorkflow, markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows"
import { cancelOrderFulfillmentWorkflow, createOrderFulfillmentWorkflow } from "@mercurjs/core/workflows"
import { interroga, valida } from "../../../utili"
import { applicaVariazioni, type Variazione } from "../../magazzino/lib/movimenti"
import { leggiScorte, type RigaInterna } from "../../magazzino/lib/scorte"
import { autore, inFilaOrdine, nonValido, servizioOrdini } from "./comune"
import { giorniMassimi, leggiLegami, leggiOrdini, ordineAssente, type OrdineGrezzo } from "./lettura"
import { richiesteDi, type DatiEvasione, type Richiesta } from "./richieste"

export const AZIONI = ["conferma", "prepara", "spedisci", "consegna", "riapri"] as const
export type Azione = (typeof AZIONI)[number]

export const DatiSpedizione = z.object({
  corriere: z.string().trim().max(80, "The carrier name is too long").optional(),
  tracking: z.string().trim().max(120, "The tracking number is too long").optional(),
  tracking_url: z.string().trim().url("The tracking link is not valid").max(500, "The tracking link is too long").or(z.literal("")).optional(),
})

export type Profilo = "admin" | "azienda"

async function contesto(req: AuthenticatedMedusaRequest, ordineId: string, aziendaId: string) {
  const [ordine] = await leggiOrdini(req.scope, { id: ordineId })
  if (!ordine) throw ordineAssente()
  const [legami, giorni] = await Promise.all([leggiLegami(req.scope, [ordine]), giorniMassimi(req.scope)])
  const richiesta = richiesteDi(ordine, legami, giorni).find((r) => r.azienda_id === aziendaId)
  if (!richiesta) throw ordineAssente()
  if (ordine.status === "canceled") throw nonValido("This order has been cancelled")
  return { ordine, richiesta }
}

async function scriviDati(req: AuthenticatedMedusaRequest, ordine: OrdineGrezzo, azienda: string, parte: DatiEvasione) {
  const evasioni = { ...((ordine.metadata?.evasioni ?? {}) as Record<string, DatiEvasione>) }
  evasioni[azienda] = { ...evasioni[azienda], ...parte }
  await servizioOrdini(req).updateOrders([{ id: ordine.id, metadata: { ...ordine.metadata, evasioni } }])
}

/** Articoli di magazzino di ogni riga, tramite l'offerta dell'azienda. */
async function articoliDelleRighe(req: AuthenticatedMedusaRequest, righe: { id: string; quantita: number }[]) {
  const { data } = await interroga(req).graph({
    entity: "order_line_item",
    fields: ["id", "offer.inventory_item_link.required_quantity", "offer.inventory_item_link.inventory_item.id"],
    filters: { id: righe.map((r) => r.id) },
  })
  type Voce = { id: string; offer?: { inventory_item_link?: { required_quantity?: number; inventory_item?: { id: string } | null }[] | null } | null }
  const totali = new Map<string, number>()
  for (const voce of data as unknown as Voce[]) {
    const quantita = righe.find((r) => r.id === voce.id)?.quantita ?? 0
    for (const legame of voce.offer?.inventory_item_link ?? []) {
      const articolo = legame.inventory_item?.id
      if (articolo) totali.set(articolo, (totali.get(articolo) ?? 0) + quantita * (legame.required_quantity ?? 1))
    }
  }
  return totali
}

const trova = (righe: RigaInterna[], articolo: string, deposito?: string) =>
  righe.find((r) => r.articolo_id === articolo && (!deposito || r.deposito_id === deposito))

type DatiStorico = { azienda: string; deposito?: string; righe: { id: string; quantita: number }[]; segno: 1 | -1; motivo: string; nota: string }

/**
 * Medusa sposta la giacenza solo se la riga aveva una riserva: qui si scrive lo storico e,
 * se la giacenza non si è mossa, anche la quantità. Il lavoro vero è già riuscito:
 * un problema con lo storico finisce nel log.
 */
export async function conStorico(req: AuthenticatedMedusaRequest, dati: DatiStorico, lavoro: () => Promise<void>) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  let foto: { articoli: Map<string, number>; prima: RigaInterna[] } | null = null
  try {
    const articoli = await articoliDelleRighe(req, dati.righe)
    foto = { articoli, prima: articoli.size ? (await leggiScorte(req, dati.azienda)).righe : [] }
  } catch (errore) {
    logger.warn(`Storico scorte non letto: ${(errore as Error).message}`)
  }
  await lavoro()
  if (!foto?.articoli.size) return
  try {
    const dopo = (await leggiScorte(req, dati.azienda)).righe
    const variazioni: Variazione[] = []
    for (const [articolo, quantita] of foto.articoli) {
      const riga = trova(foto.prima, articolo, dati.deposito)
      if (!riga) continue
      const attuale = trova(dopo, articolo, riga.deposito_id)?.giacenza ?? riga.giacenza
      const nuova = attuale === riga.giacenza ? riga.giacenza + dati.segno * quantita : attuale
      variazioni.push({ riga, nuova, tipo: "correzione", motivo: dati.motivo, nota: dati.nota })
    }
    if (variazioni.length) await applicaVariazioni(req, variazioni)
  } catch (errore) {
    logger.warn(`Storico scorte non scritto: ${(errore as Error).message}`)
  }
}

async function depositoDi(req: AuthenticatedMedusaRequest, azienda: string): Promise<string> {
  const { data } = await interroga(req).graph({ entity: "stock_location", fields: ["id", "seller.id"] })
  const deposito = (data as unknown as { id: string; seller?: { id: string } | null }[]).find((l) => l.seller?.id === azienda)
  if (!deposito) throw nonValido("This company has no warehouse yet")
  return deposito.id
}

/** L'opzione scelta al checkout se è di questa azienda, altrimenti una delle sue. */
async function opzioneDi(req: AuthenticatedMedusaRequest, ordine: OrdineGrezzo, deposito: string): Promise<string> {
  const { data } = await interroga(req).graph({ entity: "shipping_option", fields: ["id", "service_zone.fulfillment_set.location.id"] })
  type Opzione = { id: string; service_zone?: { fulfillment_set?: { location?: { id: string } | null } | null } | null }
  const proprie = (data as unknown as Opzione[]).filter((o) => o.service_zone?.fulfillment_set?.location?.id === deposito)
  const scelta = ordine.shipping_methods?.find((m) => proprie.some((o) => o.id === m.shipping_option_id))?.shipping_option_id
  const opzione = scelta ?? proprie[0]?.id ?? ordine.shipping_methods?.[0]?.shipping_option_id
  if (!opzione) throw nonValido("This company has no shipping option yet")
  return opzione
}

async function conferma(req: AuthenticatedMedusaRequest, ordine: OrdineGrezzo, r: Richiesta) {
  if (r.stato !== "da_confermare") throw nonValido("This request has already been confirmed")
  await scriviDati(req, ordine, r.azienda_id, { confermata_il: new Date().toISOString(), confermata_da: await autore(req) })
}

async function prepara(req: AuthenticatedMedusaRequest, ordine: OrdineGrezzo, r: Richiesta) {
  const daFare = r.righe.map((x) => ({ id: x.id, quantita: x.quantita - x.preparate })).filter((x) => x.quantita > 0)
  if (!daFare.length) throw nonValido("Everything in this request is already packed")
  const deposito = await depositoDi(req, r.azienda_id)
  const opzione = await opzioneDi(req, ordine, deposito)
  await conStorico(req, { azienda: r.azienda_id, deposito, righe: daFare, segno: -1, motivo: "altro", nota: `Order #${ordine.display_id} packed` }, async () => {
    await createOrderFulfillmentWorkflow(req.scope).run({
      input: {
        order_id: ordine.id,
        created_by: req.auth_context.actor_id,
        location_id: deposito,
        shipping_option_id: opzione,
        items: daFare.map((x) => ({ id: x.id, quantity: x.quantita })),
        metadata: { azienda_id: r.azienda_id },
      } as never,
    })
  })
  const chi = await autore(req)
  await scriviDati(req, ordine, r.azienda_id, { preparata_da: chi, ...(r.confermata_il ? {} : { confermata_il: new Date().toISOString(), confermata_da: chi }) })
}

async function spedisci(req: AuthenticatedMedusaRequest, ordine: OrdineGrezzo, r: Richiesta, corpo: unknown, profilo: Profilo) {
  const dati = valida(DatiSpedizione, corpo ?? {})
  if (profilo === "azienda" && !dati.tracking) throw nonValido("Enter the tracking number")
  const colli = r.colli.filter((c) => c.preparato_il && !c.spedito_il)
  if (!colli.length) throw nonValido("Pack this request before shipping it")
  const etichette = dati.tracking ? [{ tracking_number: dati.tracking, tracking_url: dati.tracking_url || "", label_url: "" }] : []
  const pacchi = new Map((ordine.fulfillments ?? []).map((c) => [c.id, c]))
  for (const collo of colli) {
    const voci = [...new Set((pacchi.get(collo.id)?.items ?? []).map((i) => i.line_item_id).filter(Boolean))] as string[]
    const items = voci
      .map((id) => {
        const riga = r.righe.find((x) => x.id === id)
        return { id, quantity: riga ? riga.preparate - riga.spedite : 0 }
      })
      .filter((i) => i.quantity > 0)
    await createOrderShipmentWorkflow(req.scope).run({
      input: { order_id: ordine.id, fulfillment_id: collo.id, created_by: req.auth_context.actor_id, items, labels: etichette },
    })
  }
  if (dati.corriere) await scriviDati(req, ordine, r.azienda_id, { corriere: dati.corriere })
}

async function consegna(req: AuthenticatedMedusaRequest, ordine: OrdineGrezzo, r: Richiesta) {
  const colli = r.colli.filter((c) => c.spedito_il && !c.consegnato_il)
  if (!colli.length) throw nonValido("Ship this request before marking it delivered")
  for (const collo of colli) {
    await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({ input: { orderId: ordine.id, fulfillmentId: collo.id } })
  }
}

async function riapri(req: AuthenticatedMedusaRequest, ordine: OrdineGrezzo, r: Richiesta) {
  const colli = r.colli.filter((c) => c.preparato_il && !c.spedito_il)
  if (!colli.length) throw nonValido("Only packed parcels that have not left can be unpacked")
  const deposito = await depositoDi(req, r.azienda_id)
  const righe = r.righe.map((x) => ({ id: x.id, quantita: x.preparate - x.spedite })).filter((x) => x.quantita > 0)
  await conStorico(req, { azienda: r.azienda_id, deposito, righe, segno: 1, motivo: "altro", nota: `Order #${ordine.display_id} unpacked` }, async () => {
    for (const collo of colli) {
      await cancelOrderFulfillmentWorkflow(req.scope).run({ input: { order_id: ordine.id, fulfillment_id: collo.id, canceled_by: req.auth_context.actor_id } as never })
    }
  })
}

/** Stessa logica per amministratore e azienda: cambia solo chi può chiamarla. */
export function eseguiAzione(req: AuthenticatedMedusaRequest, ordineId: string, aziendaId: string, azione: Azione, profilo: Profilo, corpo?: unknown) {
  return inFilaOrdine(req, ordineId, async () => {
    const { ordine, richiesta } = await contesto(req, ordineId, aziendaId)
    if (azione === "conferma") return conferma(req, ordine, richiesta)
    if (azione === "prepara") return prepara(req, ordine, richiesta)
    if (azione === "spedisci") return spedisci(req, ordine, richiesta, corpo, profilo)
    if (azione === "consegna") return consegna(req, ordine, richiesta)
    return riapri(req, ordine, richiesta)
  })
}

/** Il prossimo passo di una richiesta, come «Move on» nell'elenco. */
export const prossimoPasso = (r: Pick<Richiesta, "stato">): Azione | null => {
  if (r.stato === "da_confermare" || r.stato === "confermata") return "prepara"
  if (r.stato === "preparata") return "spedisci"
  return r.stato === "spedita" ? "consegna" : null
}
