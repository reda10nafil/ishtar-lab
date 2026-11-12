import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createReservationsWorkflow } from "@medusajs/medusa/core-flows"
import { invalido, valida } from "../../../utili"
import { ParametriRiserve, elencoRiserve, leggiRiserve } from "../lib/riserve"
import { leggiScorte, trovaRiga } from "../lib/scorte"

const NuovaRiserva = z.object({
  articolo_id: z.string().min(1, "Choose an item"),
  deposito_id: z.string().min(1, "Choose a warehouse"),
  quantita: z.number({ message: "Enter a quantity" }).int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  descrizione: z.string().trim().max(200).optional(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parametri = valida(ParametriRiserve, req.query)
  const { righe } = await leggiScorte(req)
  res.json(elencoRiserve(await leggiRiserve(req, righe), parametri))
}

/** Mette da parte unità disponibili, per esempio per una vendita concordata a voce. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const corpo = valida(NuovaRiserva, req.body)
  const { righe } = await leggiScorte(req)
  const riga = trovaRiga(righe, corpo.articolo_id, corpo.deposito_id)
  if (corpo.quantita > riga.disponibili) throw invalido(`Only ${riga.disponibili} units of this item are available`)
  const { result } = await createReservationsWorkflow(req.scope).run({
    input: {
      reservations: [
        {
          inventory_item_id: corpo.articolo_id,
          location_id: corpo.deposito_id,
          quantity: corpo.quantita,
          description: corpo.descrizione || "Manual reservation",
          created_by: req.auth_context.actor_id,
        },
      ],
    },
  })
  res.status(201).json({ id: result[0]?.id })
}
