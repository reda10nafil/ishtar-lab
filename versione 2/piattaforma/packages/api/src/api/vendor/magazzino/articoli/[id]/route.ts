import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi } from "../../../../utili"
import { schedaArticolo } from "../../../../admin/magazzino/lib/scheda"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await schedaArticolo(req, res, aziendaDi(req))
}
