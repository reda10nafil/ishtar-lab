import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { campagnaDi, servizioMarketing } from "../../../lib/campagne"

/** La copia nasce sempre come bozza: niente conteggi né date dell'originale. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { nome, canale, oggetto, testo, pubblico } = await campagnaDi(req)
  const campagna = await servizioMarketing(req).createCampagnas({ nome: `${nome} (copy)`, canale, oggetto, testo, pubblico })
  res.status(201).json({ campagna })
}
