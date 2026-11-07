import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../utili"
import { FaseValida, schedaTrattativa, servizioIngrosso } from "../comune"

const MASSIMO = 1000

const NuovaTrattativa = z.object({
  titolo: z.string({ error: "Give the deal a title" }).trim().min(2, "Give the deal a title").max(120, "That title is too long"),
  rivenditore_id: z.string({ error: "Choose a stockist" }).min(1, "Choose a stockist"),
  valore_stimato: z.number({ error: "The value must be a number" }).min(0, "The value can't be negative").nullable().optional(),
  fase: FaseValida.optional(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const trattative = await servizioIngrosso(req).listTrattativas({}, { relations: ["rivenditore"], order: { posizione: "ASC", created_at: "ASC" }, take: MASSIMO })
  res.json({ trattative: trattative.map((t) => schedaTrattativa(t as never)) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioIngrosso(req)
  const dati = valida(NuovaTrattativa, req.body)
  await servizio.retrieveRivenditore(dati.rivenditore_id)
  const fase = dati.fase ?? "richiesta"
  const [, inColonna] = await servizio.listAndCountTrattativas({ fase }, { take: 1 })
  const creata = await servizio.createTrattativas({ ...dati, fase, posizione: inColonna })
  const trattativa = await servizio.retrieveTrattativa(creata.id, { relations: ["rivenditore"] })
  res.status(201).json({ trattativa: schedaTrattativa(trattativa as never) })
}
