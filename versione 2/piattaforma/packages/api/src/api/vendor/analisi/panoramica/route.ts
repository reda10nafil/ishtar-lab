import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { panoramicaAzienda } from "../../../admin/analisi/lib/panoramica"
import { aziendaDi } from "../../../utili"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await panoramicaAzienda(req.scope, aziendaDi(req)))
}
