import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi } from "../../../../../utili"
import { ricevi } from "../../../../../admin/magazzino/lib/azioni"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await ricevi(req, res, aziendaDi(req))
}
