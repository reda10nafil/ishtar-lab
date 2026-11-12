import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { puo } from "../lib/contesto"
import { analisiVendite } from "../lib/vendite"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await analisiVendite(req.scope, puo(req, "margini")))
}
