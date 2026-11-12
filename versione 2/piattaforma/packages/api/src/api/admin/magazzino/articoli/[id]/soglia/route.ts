import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../../../utili"
import { leggiScorte, righeDiArticolo } from "../../../lib/scorte"
import { salvaSogliaArticolo, valoreSoglia } from "../../../lib/soglie"

const SogliaArticolo = z.object({ soglia: valoreSoglia })

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { soglia } = valida(SogliaArticolo, req.body)
  const { righe } = await leggiScorte(req)
  await salvaSogliaArticolo(req, righeDiArticolo(righe, req.params.id)[0], soglia)
  res.json({ articolo_id: req.params.id, soglia })
}
