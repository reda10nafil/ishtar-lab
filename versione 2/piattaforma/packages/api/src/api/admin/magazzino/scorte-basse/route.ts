import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../utili"
import { leggiScorte, scorteBasse, vedeMargini } from "../lib/scorte"

const Parametri = z.object({ azienda: z.string().optional() })

/** Articoli esauriti o sotto soglia, per il centro avvisi. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { azienda } = valida(Parametri, req.query)
  const { righe } = await leggiScorte(req, azienda)
  res.json(scorteBasse(righe, vedeMargini(req)))
}
