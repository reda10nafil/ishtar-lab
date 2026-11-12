import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { elencoCoda, leggiCoda, ParametriCoda } from "../../admin/ordini/lib/coda"
import { aziendaDi, valida } from "../../utili"

/** L'azienda arriva dal contesto verificato: un parametro `azienda` nella richiesta non cambia nulla. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parametri = valida(ParametriCoda, req.query)
  res.json(elencoCoda(await leggiCoda(req.scope, aziendaDi(req)), { ...parametri, azienda: undefined }, false))
}
