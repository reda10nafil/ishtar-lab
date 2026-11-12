import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteReservationsWorkflow } from "@medusajs/medusa/core-flows"
import { interroga, rifiutato } from "../../../../utili"
import { assente } from "../../lib/assente"

/** Le riserve degli ordini seguono l'ordine: da qui si tolgono solo quelle manuali. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const { data } = await interroga(req).graph({ entity: "reservation", fields: ["id", "line_item_id"], filters: { id } })
  const riserva = data[0] as { id: string; line_item_id: string | null } | undefined
  if (!riserva) throw assente("Reservation")
  if (riserva.line_item_id) throw rifiutato("This reservation belongs to an order: release it from the order")
  await deleteReservationsWorkflow(req.scope).run({ input: { ids: [id] } })
  res.json({ id, eliminata: true })
}
