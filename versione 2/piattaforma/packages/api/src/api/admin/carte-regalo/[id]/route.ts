import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invalido } from "../../../utili"
import { cartaConMovimenti, servizioCarte } from "../comune"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ carta: await cartaConMovimenti(req, req.params.id) })
}

/** Si elimina solo una carta annullata: una carta valida è denaro del cliente. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioCarte(req)
  const carta = await servizio.retrieveCarta(req.params.id)
  if (carta.stato !== "annullata") throw invalido("Cancel the card before deleting it")
  await servizio.softDeleteCartas(carta.id)
  res.json({ id: carta.id, eliminata: true })
}
