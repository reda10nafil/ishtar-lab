import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ricevi } from "../../../lib/azioni"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await ricevi(req, res)
}
