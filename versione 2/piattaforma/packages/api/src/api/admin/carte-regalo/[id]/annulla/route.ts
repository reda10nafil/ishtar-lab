import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../../utili"
import { cartaConMovimenti, chi, inFila, servizioCarte } from "../../comune"

const Annullamento = z.object({
  motivo: z.string({ error: "Give a reason for cancelling the card" }).trim().min(3, "Give a reason for cancelling the card").max(500, "That reason is too long"),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { motivo } = valida(Annullamento, req.body)
  const attore = await chi(req)
  await inFila(req, `carta-regalo:${req.params.id}`, () => servizioCarte(req).annulla(req.params.id, motivo, attore))
  res.json({ carta: await cartaConMovimenti(req, req.params.id) })
}
