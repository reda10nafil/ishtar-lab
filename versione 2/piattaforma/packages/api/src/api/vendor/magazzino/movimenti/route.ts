import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi, valida } from "../../../utili"
import { ParametriMovimenti, elencoMovimenti } from "../../../admin/magazzino/lib/movimenti"
import { leggiScorte } from "../../../admin/magazzino/lib/scorte"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parametri = valida(ParametriMovimenti, req.query)
  const { righe } = await leggiScorte(req, aziendaDi(req))
  res.json(elencoMovimenti(righe, { ...parametri, azienda: undefined }))
}
