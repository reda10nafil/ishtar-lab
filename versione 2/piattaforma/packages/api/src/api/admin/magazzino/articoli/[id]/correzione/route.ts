import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { correggi } from "../../../lib/azioni"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await correggi(req, res)
}
