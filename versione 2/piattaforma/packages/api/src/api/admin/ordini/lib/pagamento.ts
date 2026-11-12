import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { cancelOrderWorkflow, capturePaymentWorkflow, createOrUpdateOrderPaymentCollectionWorkflow, markPaymentCollectionAsPaid } from "@medusajs/medusa/core-flows"
import { interroga } from "../../../utili"
import { inFilaOrdine, nonValido } from "./comune"
import { leggiUnico, type Unico } from "./unico"

const vivi = (u: Unico) => u.ordini.filter((o) => o.status !== "canceled")

const daIncassare = (u: Unico) => {
  const pagamenti = new Set<string>()
  for (const ordine of vivi(u)) {
    for (const incasso of ordine.payment_collections ?? []) {
      for (const p of incasso.payments ?? []) if (!p.captured_at && !p.canceled_at) pagamenti.add(p.id)
    }
  }
  return [...pagamenti]
}

export const puoIncassare = (u: Unico) =>
  !u.annullato && ["not_paid", "awaiting", "authorized", "partially_authorized", "partially_captured", "requires_action"].includes(u.pagamento)

/** Un'autorizzazione si incassa; un ordine nato da una bozza non ha pagamento e si segna come pagato. */
async function segnaPagato(req: AuthenticatedMedusaRequest, ordineId: string) {
  await createOrUpdateOrderPaymentCollectionWorkflow(req.scope).run({ input: { order_id: ordineId } })
  const { data } = await interroga(req).graph({ entity: "order", fields: ["payment_collections.id", "payment_collections.status"], filters: { id: ordineId } })
  const incassi = (data[0] as unknown as { payment_collections?: { id: string; status: string }[] } | undefined)?.payment_collections
  const incasso = incassi?.find((c) => c.status === "not_paid")
  if (!incasso) throw nonValido("There is nothing left to pay on this order")
  await markPaymentCollectionAsPaid(req.scope).run({ input: { order_id: ordineId, payment_collection_id: incasso.id, captured_by: req.auth_context.actor_id } })
}

export function incassa(req: AuthenticatedMedusaRequest, id: string) {
  return inFilaOrdine(req, id, async () => {
    const unico = await leggiUnico(req.scope, id)
    if (!puoIncassare(unico)) throw nonValido("This order is already paid")
    const pagamenti = daIncassare(unico)
    for (const payment_id of pagamenti) {
      await capturePaymentWorkflow(req.scope).run({ input: { payment_id, captured_by: req.auth_context.actor_id } })
    }
    if (pagamenti.length) return
    for (const ordine of vivi(unico)) if (ordine.payment_status === "not_paid") await segnaPagato(req, ordine.id)
  })
}

export const puoAnnullare = (u: Unico) => !u.annullato && !vivi(u).some((o) => (o.fulfillments ?? []).some((c) => !c.canceled_at))

export function annulla(req: AuthenticatedMedusaRequest, id: string) {
  return inFilaOrdine(req, id, async () => {
    const unico = await leggiUnico(req.scope, id)
    if (unico.annullato) throw nonValido("This order has already been cancelled")
    if (!puoAnnullare(unico)) throw nonValido("A company has already packed part of this order: undo the packing first")
    for (const ordine of vivi(unico)) {
      await cancelOrderWorkflow(req.scope).run({ input: { order_id: ordine.id, canceled_by: req.auth_context.actor_id } })
    }
  })
}
