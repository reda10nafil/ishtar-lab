import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../../utili"
import { schedaConNote, schedaTrattativa, servizioIngrosso } from "../../comune"

const ModificaTrattativa = z.object({
  titolo: z.string().trim().min(2, "Give the deal a title").max(120, "That title is too long").optional(),
  rivenditore_id: z.string().min(1, "Choose a stockist").optional(),
  unita: z.number({ error: "Units must be a number" }).int("Units must be a whole number").min(1, "Units must be at least 1").nullable().optional(),
  valore_stimato: z.number({ error: "The value must be a number" }).min(0, "The value can't be negative").nullable().optional(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const trattativa = await servizioIngrosso(req).retrieveTrattativa(req.params.id, { relations: ["rivenditore", "note"] })
  res.json({ trattativa: schedaConNote(trattativa as never) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioIngrosso(req)
  await servizio.retrieveTrattativa(req.params.id)
  const dati = valida(ModificaTrattativa, req.body)
  if (dati.rivenditore_id) await servizio.retrieveRivenditore(dati.rivenditore_id)
  await servizio.updateTrattativas({ id: req.params.id, ...dati })
  const trattativa = await servizio.retrieveTrattativa(req.params.id, { relations: ["rivenditore"] })
  res.json({ trattativa: schedaTrattativa(trattativa as never) })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioIngrosso(req)
  await servizio.retrieveTrattativa(req.params.id)
  await servizio.softDeleteTrattativas(req.params.id)
  res.json({ id: req.params.id, eliminata: true })
}
