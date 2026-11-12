import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi } from "../../../../../utili"
import { correggi } from "../../../../../admin/magazzino/lib/azioni"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await correggi(req, res, aziendaDi(req))
}
