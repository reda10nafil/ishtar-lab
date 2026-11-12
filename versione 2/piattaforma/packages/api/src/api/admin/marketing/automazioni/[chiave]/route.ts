import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { nonTrovato, rifiutato, valida } from "../../../../utili"
import { descriviAutomazione } from "../../lib/automazioni"
import { servizioMarketing } from "../../lib/campagne"

const Modifica = z.object({
  attiva: z.boolean().optional(),
  oggetto: z.string().trim().min(1, "Write a subject line").max(180, "That text is too long").optional(),
  testo: z.string().trim().min(1, "Write the message").max(20_000, "That text is too long").optional(),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioMarketing(req)
  const regola = (await servizio.assicuraAutomazioni()).find((r) => r.chiave === req.params.chiave)
  if (!regola) throw nonTrovato("Automation")
  const dati = valida(Modifica, req.body)
  const { bloccata } = descriviAutomazione(regola.chiave)
  if (bloccata && dati.attiva) throw rifiutato(bloccata)
  res.json({ automazione: await servizio.updateAutomaziones({ id: regola.id, ...dati }) })
}
