import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { inBlocco } from "../lib/blocco"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await inBlocco(req, req.body))
}
