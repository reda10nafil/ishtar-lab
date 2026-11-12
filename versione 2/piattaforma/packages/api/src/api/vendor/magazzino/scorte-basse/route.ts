import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi } from "../../../utili"
import { leggiScorte, scorteBasse } from "../../../admin/magazzino/lib/scorte"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { righe } = await leggiScorte(req, aziendaDi(req))
  res.json(scorteBasse(righe, false))
}
