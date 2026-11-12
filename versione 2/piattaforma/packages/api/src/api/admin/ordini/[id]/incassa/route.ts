import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { incassa } from "../../lib/pagamento"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await incassa(req, req.params.id)
  res.json({ ok: true })
}
