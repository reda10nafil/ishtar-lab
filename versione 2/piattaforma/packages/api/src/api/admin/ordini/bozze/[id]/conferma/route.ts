import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { confermaBozza } from "../../../lib/bozze"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ id: await confermaBozza(req, req.params.id, req.body) })
}
