import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../../../utili"
import { chi } from "../../../../carte-regalo/comune"
import { schedaConNote, servizioIngrosso } from "../../../comune"

const NuovaNota = z.object({
  testo: z.string({ error: "Write the note" }).trim().min(1, "Write the note").max(1000, "That note is too long"),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { testo } = valida(NuovaNota, req.body)
  const servizio = servizioIngrosso(req)
  await servizio.retrieveTrattativa(req.params.id)
  await servizio.createNotaTrattativas({ trattativa_id: req.params.id, testo, autore: await chi(req) })
  const trattativa = await servizio.retrieveTrattativa(req.params.id, { relations: ["rivenditore", "note"] })
  res.status(201).json({ trattativa: schedaConNote(trattativa as never) })
}
