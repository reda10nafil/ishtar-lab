import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invalido } from "../../../../../utili"
import { AZIONI, eseguiAzione, type Azione } from "../../../../ordini/lib/evasione"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const azione = req.params.azione as Azione
  if (!AZIONI.includes(azione)) throw invalido("Unknown action")
  await eseguiAzione(req, req.params.ordine, req.params.azienda, azione, "admin", req.body)
  res.json({ ok: true })
}
