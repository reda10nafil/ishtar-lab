import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valida } from "../../../utili"
import { ParametriMovimenti, elencoMovimenti } from "../lib/movimenti"
import { leggiScorte } from "../lib/scorte"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parametri = valida(ParametriMovimenti, req.query)
  const { righe } = await leggiScorte(req)
  res.json(elencoMovimenti(righe, parametri))
}
