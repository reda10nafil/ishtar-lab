import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { schedaArticolo } from "../../lib/scheda"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await schedaArticolo(req, res)
}
