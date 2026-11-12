import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AZIONI, eseguiAzione, type Azione } from "../../../../admin/ordini/lib/evasione"
import { ordineAssente, ordiniDiAzienda } from "../../../../admin/ordini/lib/lettura"
import { aziendaDi, invalido } from "../../../../utili"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const azione = req.params.azione as Azione
  if (!AZIONI.includes(azione)) throw invalido("Unknown action")
  const azienda = aziendaDi(req)
  if (!(await ordiniDiAzienda(req.scope, azienda)).includes(req.params.ordine)) throw ordineAssente()
  await eseguiAzione(req, req.params.ordine, azienda, azione, "azienda", req.body)
  res.json({ ok: true })
}
