import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { annulla } from "../../lib/pagamento"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await annulla(req, req.params.id)
  res.json({ ok: true })
}
