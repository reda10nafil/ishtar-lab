import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { avanza } from "../../lib/blocco"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await avanza(req, req.params.id)
  res.json({ ok: true })
}
