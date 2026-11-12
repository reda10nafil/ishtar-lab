import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invalido } from "../../../../../utili"
import { AZIONI_RESO, eseguiReso, type AzioneReso } from "../../../lib/resi"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const azione = req.params.azione as AzioneReso
  if (!AZIONI_RESO.includes(azione)) throw invalido("Unknown action")
  await eseguiReso(req, req.params.id, azione, req.body)
  res.json({ ok: true })
}
