import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invalido } from "../../../../utili"
import { servizioCarte } from "../../../carte-regalo/comune"
import { leggiPromozioni } from "../../promozioni"

/** Finché lo sconto esiste, la proposta approvata resta: è la traccia di dove nasce. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioCarte(req)
  const proposta = await servizio.retrieveProposta(req.params.id)
  const scontoVivo = proposta.promozione_id ? (await leggiPromozioni(req.scope, { id: proposta.promozione_id })).length > 0 : false
  if (scontoVivo) throw invalido("An approved proposal can't be deleted: manage its discount in Codes")
  await servizio.softDeletePropostas(proposta.id)
  res.json({ id: proposta.id, eliminata: true })
}
