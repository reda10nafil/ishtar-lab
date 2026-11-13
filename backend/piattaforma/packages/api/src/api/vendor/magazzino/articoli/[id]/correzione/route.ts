import { randomUUID } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { aziendaDi, valida } from "../../../../../utili"
import { MOTIVI, chiE } from "../../../../../admin/magazzino/lib/movimenti"
import { pianoCorrezione } from "../../../../../admin/magazzino/lib/operazioni"
import { leggiScorte, trovaRiga } from "../../../../../admin/magazzino/lib/scorte"
import { ConflittoHttp, eseguiScorte, rispondiConflitto } from "../../../../../admin/magazzino/lib/scrittura"

const Correzione = z
  .object({
    deposito_id: z.string().min(1, "Choose a warehouse"),
    quantita: z.number({ message: "Quantity must be a number" }).int("Quantity must be a whole number").min(0, "Quantity cannot be negative").optional(),
    variazione: z.number({ message: "Change must be a number" }).int("Change must be a whole number").optional(),
    // Giacenza mostrata dalla finestra quando si è aperta: con «New quantity» si scrive solo se è ancora quella.
    prima: z.number().int().optional(),
    // Stesso id, stessa correzione: un nuovo invio dopo una risposta persa non conta due volte.
    id: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/).optional(),
    motivo: z.enum(MOTIVI, { message: "Choose a reason" }),
    nota: z.string().trim().max(300).optional(),
  })
  .refine((c) => (c.quantita === undefined) !== (c.variazione === undefined), { message: "Enter either a new quantity or a change" })

/**
 * La quantità cambia subito, senza revisione. La scrive solo chi possiede il deposito, sotto il lucchetto della voce di
 * magazzino (lo stesso di evasioni e resi): una variazione si somma alla giacenza del momento, una quantità nuova vale
 * solo se la giacenza è ancora quella mostrata (altrimenti 412 con il valore attuale).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const corpo = valida(Correzione, req.body)
  const { righe } = await leggiScorte(req, aziendaDi(req))
  const riga = trovaRiga(righe, req.params.id, corpo.deposito_id)
  const operazione = pianoCorrezione(corpo, riga, randomUUID)
  try {
    const [esito] = await eseguiScorte(req, [operazione], await chiE(req))
    res.json({ articolo_id: riga.articolo_id, deposito_id: riga.deposito_id, prima: esito.prima, dopo: esito.dopo })
  } catch (errore) {
    if (errore instanceof ConflittoHttp) return rispondiConflitto(res, errore)
    throw errore
  }
}
