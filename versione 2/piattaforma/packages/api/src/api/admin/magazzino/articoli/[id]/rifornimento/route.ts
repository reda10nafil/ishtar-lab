import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rifornisci } from "../../../lib/azioni"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await rifornisci(req, res)
}
