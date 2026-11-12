import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { contaTutto } from "./tabelle"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ conteggi: await contaTutto(req) })
}
