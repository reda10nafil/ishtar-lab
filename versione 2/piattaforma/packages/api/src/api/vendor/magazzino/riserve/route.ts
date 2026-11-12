import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi, valida } from "../../../utili"
import { ParametriRiserve, elencoRiserve, leggiRiserve } from "../../../admin/magazzino/lib/riserve"
import { leggiScorte } from "../../../admin/magazzino/lib/scorte"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parametri = valida(ParametriRiserve, req.query)
  const { righe } = await leggiScorte(req, aziendaDi(req))
  res.json(elencoRiserve(await leggiRiserve(req, righe), { ...parametri, azienda: undefined }))
}
