import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { annullaVendita } from "../../../lib/vendita"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ vendita: await annullaVendita(req, req.params.id) })
}
