import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { opzioniBozza } from "../../lib/bozze"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await opzioniBozza(req))
}
