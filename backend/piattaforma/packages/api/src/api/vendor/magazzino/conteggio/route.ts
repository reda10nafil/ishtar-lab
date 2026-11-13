import { randomUUID } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { aziendaDi, invalido, valida } from "../../../utili"
import { chiE } from "../../../admin/magazzino/lib/movimenti"
import { conflittoInConteggio, messaggioConteggio, pianoConteggio } from "../../../admin/magazzino/lib/operazioni"
import { leggiScorte } from "../../../admin/magazzino/lib/scorte"
import { ConflittoHttp, eseguiScorte, rispondiConflitto } from "../../../admin/magazzino/lib/scrittura"

const Conteggio = z.object({
  righe: z
    .array(
      z.object({
        articolo_id: z.string().min(1),
        deposito_id: z.string().min(1),
        contata: z.number({ message: "Enter the counted quantity" }).int("Counted quantities must be whole numbers").min(0, "A counted quantity cannot be negative"),
        // Giacenza mostrata quando si è iniziato a contare.
        prima: z.number().int().optional(),
      })
    )
    .min(1, "Count at least one item")
    .max(1000, "Record no more than 1,000 items at a time"),
  nota: z.string().trim().max(300).optional(),
})

/**
 * Tutto o niente: basta una riga altrui, doppia o con una giacenza cambiata da quando si è iniziato a contare (412 con le
 * righe e i valori attuali) e non si scrive nulla. Le righe si scrivono in un solo workflow, sotto il lucchetto di ogni voce.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const corpo = valida(Conteggio, req.body)
  const chiavi = corpo.righe.map((r) => `${r.articolo_id}@${r.deposito_id}`)
  if (new Set(chiavi).size !== chiavi.length) throw invalido("The same item appears twice in this count")
  const { righe } = await leggiScorte(req, aziendaDi(req))
  const piano = pianoConteggio(corpo, righe, randomUUID)
  if (piano.conflitti.length) return rispondiConflitto(res, new ConflittoHttp(messaggioConteggio(piano.conflitti), piano.conflitti))
  try {
    const esiti = await eseguiScorte(req, piano.operazioni, await chiE(req))
    const cambiati = esiti.filter((e) => e.dopo !== e.prima)
    res.json({ contati: esiti.length, cambiati: cambiati.length, differenza: cambiati.reduce((totale, e) => totale + e.dopo - e.prima, 0) })
  } catch (errore) {
    if (errore instanceof ConflittoHttp) {
      // Giacenza cambiata fra la lettura e il lucchetto della voce: come i conflitti del piano, con la riga, così la console
      // la segna da ricontare (la pagina non va ricaricata: si perderebbero i numeri contati).
      const riga = conflittoInConteggio(errore.conflitti[0] as { attuale?: unknown; articolo_id?: string; deposito_id?: string }, corpo, righe)
      return rispondiConflitto(res, riga
        ? new ConflittoHttp(messaggioConteggio([riga]), [riga])
        : new ConflittoHttp("Count not recorded: stock changed while saving. Check the items and record the count again.", errore.conflitti))
    }
    throw errore
  }
}
