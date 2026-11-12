import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { aziendaDi, invalido, valida } from "../../../utili"
import { applicaVariazioni } from "../../../admin/magazzino/lib/movimenti"
import { leggiScorte, trovaRiga } from "../../../admin/magazzino/lib/scorte"

const Conteggio = z.object({
  righe: z
    .array(
      z.object({
        articolo_id: z.string().min(1),
        deposito_id: z.string().min(1),
        contata: z.number({ message: "Enter the counted quantity" }).int("Counted quantities must be whole numbers").min(0, "A counted quantity cannot be negative"),
      })
    )
    .min(1, "Count at least one item")
    .max(1000, "Record no more than 1,000 items at a time"),
  nota: z.string().trim().max(300).optional(),
})

/** Tutto o niente: basta una riga altrui o doppia e non si scrive nulla. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const corpo = valida(Conteggio, req.body)
  const chiavi = corpo.righe.map((r) => `${r.articolo_id}@${r.deposito_id}`)
  if (new Set(chiavi).size !== chiavi.length) throw invalido("The same item appears twice in this count")
  const { righe } = await leggiScorte(req, aziendaDi(req))
  const variazioni = corpo.righe.map((r) => ({
    riga: trovaRiga(righe, r.articolo_id, r.deposito_id),
    nuova: r.contata,
    tipo: "conteggio" as const,
    motivo: "rettifica",
    nota: corpo.nota || null,
  }))
  await applicaVariazioni(req, variazioni)
  const cambiate = variazioni.filter((v) => v.nuova !== v.riga.giacenza)
  res.json({
    contati: variazioni.length,
    cambiati: cambiate.length,
    differenza: cambiate.reduce((totale, v) => totale + v.nuova - v.riga.giacenza, 0),
  })
}
