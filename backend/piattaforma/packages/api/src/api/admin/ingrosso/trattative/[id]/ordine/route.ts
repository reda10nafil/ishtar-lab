import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, OrderStatus } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createOrderWorkflow } from "@medusajs/medusa/core-flows"
import { interroga, invalido, valida } from "../../../../../utili"
import { inFila } from "../../../../carte-regalo/comune"
import { servizioIngrosso } from "../../../comune"

const Riga = z.object({
  variante_id: z.string().nullable().optional(),
  titolo: z.string({ error: "Each line needs a description" }).trim().min(1, "Each line needs a description").max(200, "That description is too long"),
  quantita: z.number({ error: "Enter a quantity on each line" }).int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  prezzo_unitario: z.number({ error: "Enter a unit price on each line" }).min(0, "The price can't be negative"),
})

const NuovoOrdine = z.object({
  regione_id: z.string({ error: "Choose a sales region" }).min(1, "Choose a sales region"),
  canale_id: z.string({ error: "Choose a sales channel" }).min(1, "Choose a sales channel"),
  righe: z.array(Riga, { error: "Add at least one line to the order" }).min(1, "Add at least one line to the order").max(100, "Too many lines in one order"),
})

async function contesto(req: AuthenticatedMedusaRequest) {
  const servizio = servizioIngrosso(req)
  const trattativa = await servizio.retrieveTrattativa(req.params.id, { relations: ["rivenditore"] })
  const query = interroga(req)
  const [{ data: regioni }, { data: canali }, { data: ordini }] = await Promise.all([
    query.graph({ entity: "region", fields: ["id", "name", "currency_code"] }),
    query.graph({ entity: "sales_channel", fields: ["id", "name"], filters: { is_disabled: false } }),
    trattativa.ordine_id
      ? query.graph({ entity: "order", fields: ["id", "display_id", "status"], filters: { id: trattativa.ordine_id } })
      : Promise.resolve({ data: [] as { id: string; display_id: number; status: string }[] }),
  ])
  return { trattativa, rivenditore: trattativa.rivenditore, regioni, canali, ordine: ordini[0] ?? null }
}

/** Ciò che impedisce di creare la bozza, detto con parole dell'utente. L'indirizzo non blocca: si completa nella bozza. */
function mancanti({ trattativa, rivenditore, regioni, canali, ordine }: Awaited<ReturnType<typeof contesto>>): string[] {
  const elenco: string[] = []
  if (ordine) elenco.push("This deal already has a draft order: you'll find it under Orders, in Drafts.")
  if (trattativa.fase !== "accordo") elenco.push("The deal needs to be in the Agreed stage.")
  if (!rivenditore.email) elenco.push("The stockist has no email address: without one the draft can't be assigned to a customer or turned into an order. Add it to their details.")
  if (!regioni.length) elenco.push("There's no sales region: the order needs one to set its currency and tax.")
  if (!canali.length) elenco.push("There's no active sales channel to attach the order to.")
  return elenco
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = await contesto(req)
  const { rivenditore, regioni, canali, ordine } = dati
  res.json({
    mancanti: mancanti(dati),
    avvisi: rivenditore.indirizzo ? [] : ["The stockist has no address: the draft will still be created, but you'll need to add one before shipping."],
    regioni: regioni.map((r) => ({ id: r.id, nome: r.name, valuta: r.currency_code })),
    canali: canali.map((c) => ({ id: c.id, nome: c.name })),
    condizioni: {
      condizione: rivenditore.condizione,
      listino: rivenditore.listino,
      sconto_percentuale: rivenditore.sconto_percentuale === null ? null : Number(rivenditore.sconto_percentuale),
      pagamento: rivenditore.pagamento,
      ordine_minimo: rivenditore.ordine_minimo === null ? null : Number(rivenditore.ordine_minimo),
    },
    ordine: ordine ? { id: ordine.id, numero: ordine.display_id, stato: ordine.status } : null,
  })
}

/** Stesso flusso di `POST /admin/draft-orders`: la bozza compare nell'elenco delle bozze di Medusa. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const corpo = valida(NuovoOrdine, req.body)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const ordine = await inFila(req, `trattativa-ordine:${req.params.id}`, async () => {
    const dati = await contesto(req)
    const [ostacolo] = mancanti(dati)
    if (ostacolo) throw invalido(ostacolo)
    const { trattativa, rivenditore, regioni, canali } = dati
    const regione = regioni.find((r) => r.id === corpo.regione_id)
    if (!regione) throw invalido("The chosen sales region no longer exists")
    if (!canali.some((c) => c.id === corpo.canale_id)) throw invalido("The chosen sales channel no longer exists")

    const indirizzo = rivenditore.indirizzo
      ? {
          company: rivenditore.nome,
          first_name: rivenditore.referente ?? undefined,
          address_1: rivenditore.indirizzo,
          city: rivenditore.citta ?? undefined,
          postal_code: rivenditore.cap ?? undefined,
          country_code: rivenditore.paese,
          phone: rivenditore.telefono ?? undefined,
        }
      : undefined

    try {
      const { result } = await createOrderWorkflow(req.scope).run({
        input: {
          status: OrderStatus.DRAFT,
          is_draft_order: true,
          no_notification: true,
          region_id: regione.id,
          currency_code: regione.currency_code,
          sales_channel_id: corpo.canale_id,
          email: rivenditore.email as string,
          shipping_address: indirizzo,
          billing_address: indirizzo,
          items: corpo.righe.map((riga) => ({
            title: riga.titolo,
            quantity: riga.quantita,
            unit_price: riga.prezzo_unitario,
            ...(riga.variante_id ? { variant_id: riga.variante_id } : {}),
          })),
          metadata: {
            ingrosso_trattativa_id: trattativa.id,
            ingrosso_rivenditore_id: rivenditore.id,
            ingrosso_pagamento: rivenditore.pagamento,
          },
        } as never,
      })
      await servizioIngrosso(req).updateTrattativas({ id: trattativa.id, ordine_id: result.id })
      return result
    } catch (errore) {
      const testo = (errore as Error).message ?? ""
      logger.warn(`Bozza d'ordine non creata per ${trattativa.id}: ${testo}`)
      if (/inventory|stock/i.test(testo)) throw invalido("An item doesn't have enough stock: lower the quantity or remove it")
      if (/price/i.test(testo)) throw invalido("An item has no price: enter one on its line")
      throw invalido("The draft wasn't created: check the items")
    }
  })
  res.status(201).json({ ordine: { id: ordine.id, numero: ordine.display_id, stato: ordine.status } })
}
