import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { scheda } from "../lib/scheda"
import { leggiUnico } from "../lib/unico"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ ordine: await scheda(req, await leggiUnico(req.scope, req.params.id)) })
}
