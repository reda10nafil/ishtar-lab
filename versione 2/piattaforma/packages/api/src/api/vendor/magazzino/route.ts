import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi, valida } from "../../utili"
import { ParametriElenco, elenco, leggiScorte } from "../../admin/magazzino/lib/scorte"

/** Solo le scorte dell'azienda collegata; il valore a costo non esce mai da qui. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parametri = valida(ParametriElenco, req.query)
  const { righe, depositi } = await leggiScorte(req, aziendaDi(req))
  res.json({ ...elenco(righe, { ...parametri, azienda: undefined }, false), depositi })
}
