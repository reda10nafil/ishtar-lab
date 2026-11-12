import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../../../utili"
import { inFila } from "../../../../carte-regalo/comune"
import { FaseValida, schedaTrattativa, servizioIngrosso } from "../../../comune"

const Spostamento = z.object({
  fase: FaseValida,
  indice: z.number().int().min(0).optional(),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { fase, indice } = valida(Spostamento, req.body)
  const servizio = servizioIngrosso(req)
  await servizio.retrieveTrattativa(req.params.id)
  await inFila(req, "ingrosso:bacheca", () => servizio.sposta(req.params.id, fase, indice))
  const trattativa = await servizio.retrieveTrattativa(req.params.id, { relations: ["rivenditore"] })
  res.json({ trattativa: schedaTrattativa(trattativa as never) })
}
