import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { elencoAzienda, ParametriAzienda } from "../../admin/ordini/lib/azienda"
import { aziendaDi, valida } from "../../utili"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await elencoAzienda(req.scope, aziendaDi(req), valida(ParametriAzienda, req.query)))
}
