import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { duplicaPromozione, leggiPromozione, scheda } from "../../../promozioni"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const originale = await leggiPromozione(req.scope, req.params.id)
  const id = await duplicaPromozione(req.scope, originale)
  res.status(201).json({ codice: scheda(await leggiPromozione(req.scope, id)) })
}
