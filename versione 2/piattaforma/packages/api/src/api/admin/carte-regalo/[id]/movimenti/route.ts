import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../../utili"
import { cartaConMovimenti, chi, inFila, servizioCarte } from "../../comune"

const Rettifica = z.object({
  importo: z
    .number({ error: "Enter how much the balance changes by" })
    .refine((valore) => valore !== 0, "The amount can't be zero")
    .refine((valore) => Math.abs(valore) <= 100000, "That amount is too high"),
  nota: z.string({ error: "Give a reason for the adjustment" }).trim().min(3, "Give a reason for the adjustment").max(500, "That note is too long"),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { importo, nota } = valida(Rettifica, req.body)
  const attore = await chi(req)
  await inFila(req, `carta-regalo:${req.params.id}`, () => servizioCarte(req).rettifica(req.params.id, importo, nota, attore))
  res.status(201).json({ carta: await cartaConMovimenti(req, req.params.id) })
}
