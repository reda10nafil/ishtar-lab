import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { aziendaDi, invalido, valida } from "../../../../../utili"
import { MOTIVI, applicaVariazioni } from "../../../../../admin/magazzino/lib/movimenti"
import { leggiScorte, trovaRiga } from "../../../../../admin/magazzino/lib/scorte"

const Correzione = z
  .object({
    deposito_id: z.string().min(1, "Choose a warehouse"),
    quantita: z.number({ message: "Quantity must be a number" }).int("Quantity must be a whole number").min(0, "Quantity cannot be negative").optional(),
    variazione: z.number({ message: "Change must be a number" }).int("Change must be a whole number").optional(),
    motivo: z.enum(MOTIVI, { message: "Choose a reason" }),
    nota: z.string().trim().max(300).optional(),
  })
  .refine((c) => (c.quantita === undefined) !== (c.variazione === undefined), { message: "Enter either a new quantity or a change" })

/** La quantità cambia subito, senza revisione. La scrive solo chi possiede il deposito. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const corpo = valida(Correzione, req.body)
  const { righe } = await leggiScorte(req, aziendaDi(req))
  const riga = trovaRiga(righe, req.params.id, corpo.deposito_id)
  const nuova = corpo.quantita ?? riga.giacenza + (corpo.variazione ?? 0)
  if (nuova < 0) throw invalido("Stock cannot go below zero")
  if (nuova === riga.giacenza) throw invalido("Stock is already at this quantity")
  await applicaVariazioni(req, [{ riga, nuova, tipo: "correzione", motivo: corpo.motivo, nota: corpo.nota || null }])
  res.json({ articolo_id: riga.articolo_id, deposito_id: riga.deposito_id, prima: riga.giacenza, dopo: nuova })
}
