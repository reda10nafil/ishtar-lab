import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi } from "../../../../../utili"
import { rifornisci } from "../../../../../admin/magazzino/lib/azioni"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await rifornisci(req, res, aziendaDi(req))
}
