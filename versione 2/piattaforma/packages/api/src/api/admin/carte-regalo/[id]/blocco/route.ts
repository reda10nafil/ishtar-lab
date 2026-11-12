import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../../utili"
import { cartaConMovimenti, inFila, servizioCarte } from "../../comune"

const Blocco = z.object({ congelata: z.boolean({ error: "Say whether to freeze the card" }) })

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { congelata } = valida(Blocco, req.body)
  await inFila(req, `carta-regalo:${req.params.id}`, () => servizioCarte(req).congela(req.params.id, congelata))
  res.json({ carta: await cartaConMovimenti(req, req.params.id) })
}
