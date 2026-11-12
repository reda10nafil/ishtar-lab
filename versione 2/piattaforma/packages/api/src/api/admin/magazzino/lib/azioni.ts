import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { invalido, valida } from "../../../utili"
import { MOTIVI, applicaVariazioni } from "./movimenti"
import { leggiScorte, trovaRiga } from "./scorte"

const Correzione = z
  .object({
    deposito_id: z.string().min(1, "Choose a warehouse"),
    quantita: z.number({ message: "Quantity must be a number" }).int("Quantity must be a whole number").min(0, "Quantity cannot be negative").optional(),
    variazione: z.number({ message: "Change must be a number" }).int("Change must be a whole number").optional(),
    motivo: z.enum(MOTIVI, { message: "Choose a reason" }),
    nota: z.string().trim().max(300).optional(),
  })
  .refine((c) => (c.quantita === undefined) !== (c.variazione === undefined), { message: "Enter either a new quantity or a change" })

const Rifornimento = z.object({
  deposito_id: z.string().min(1, "Choose a warehouse"),
  /** Se manca si chiede il doppio del punto di riordino; un numero negativo annulla una richiesta. */
  quantita: z.number({ message: "Quantity must be a number" }).int("Quantity must be a whole number").optional(),
})

const Ricezione = z.object({ deposito_id: z.string().min(1, "Choose a warehouse") })

/** La quantità cambia subito, senza revisione. Con `aziendaId` si vedono e si scrivono solo le sue scorte. */
export async function correggi(req: AuthenticatedMedusaRequest, res: MedusaResponse, aziendaId?: string) {
  const corpo = valida(Correzione, req.body)
  const { righe } = await leggiScorte(req, aziendaId)
  const riga = trovaRiga(righe, req.params.id, corpo.deposito_id)
  const nuova = corpo.quantita ?? riga.giacenza + (corpo.variazione ?? 0)
  if (nuova < 0) throw invalido("Stock cannot go below zero")
  if (nuova === riga.giacenza) throw invalido("Stock is already at this quantity")
  await applicaVariazioni(req, [{ riga, nuova, tipo: "correzione", motivo: corpo.motivo, nota: corpo.nota || null }])
  res.json({ articolo_id: riga.articolo_id, deposito_id: riga.deposito_id, prima: riga.giacenza, dopo: nuova })
}

/** Merce chiesta all'azienda: resta fra le unità in arrivo finché non entra in deposito. */
export async function rifornisci(req: AuthenticatedMedusaRequest, res: MedusaResponse, aziendaId?: string) {
  const corpo = valida(Rifornimento, req.body)
  const { righe } = await leggiScorte(req, aziendaId)
  const riga = trovaRiga(righe, req.params.id, corpo.deposito_id)
  const quantita = corpo.quantita ?? Math.max(riga.soglia * 2, 1)
  const in_arrivo = riga.in_arrivo + quantita
  if (in_arrivo < 0) throw invalido("There are not that many units on the way")
  await applicaVariazioni(req, [{ riga, nuova: riga.giacenza, tipo: "correzione", motivo: null, nota: null, in_arrivo }])
  res.json({ quantita, in_arrivo })
}

/** Le unità in arrivo entrano in deposito tutte insieme e lasciano un movimento nello storico. */
export async function ricevi(req: AuthenticatedMedusaRequest, res: MedusaResponse, aziendaId?: string) {
  const corpo = valida(Ricezione, req.body)
  const { righe } = await leggiScorte(req, aziendaId)
  const riga = trovaRiga(righe, req.params.id, corpo.deposito_id)
  if (!riga.in_arrivo) throw invalido("Nothing is on the way for this item")
  const dopo = riga.giacenza + riga.in_arrivo
  await applicaVariazioni(req, [{ riga, nuova: dopo, tipo: "correzione", motivo: "rifornimento", nota: null, in_arrivo: 0 }])
  res.json({ ricevute: riga.in_arrivo, dopo })
}
