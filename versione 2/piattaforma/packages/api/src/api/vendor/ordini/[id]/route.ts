import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { schedaAzienda } from "../../../admin/ordini/lib/azienda"
import { aziendaDi } from "../../../utili"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ ordine: await schedaAzienda(req.scope, aziendaDi(req), req.params.id) })
}
