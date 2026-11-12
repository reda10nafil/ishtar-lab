import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi, invalido, nonTrovato } from "../../../../utili"
import { servizioCarte } from "../../../../admin/carte-regalo/comune"

/** Una proposta altrui risponde «non trovato»: l'azienda non deve nemmeno saperne l'esistenza. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioCarte(req)
  const [proposta] = await servizio.listPropostas({ id: req.params.id, azienda_id: aziendaDi(req) })
  if (!proposta) throw nonTrovato("Item")
  if (proposta.stato !== "in_attesa") throw invalido("You can only withdraw a proposal that's still pending")
  await servizio.softDeletePropostas(proposta.id)
  res.json({ id: proposta.id, eliminata: true })
}
