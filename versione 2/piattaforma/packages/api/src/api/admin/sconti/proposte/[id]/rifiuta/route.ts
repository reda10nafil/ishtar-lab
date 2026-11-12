import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { invalido, valida } from "../../../../../utili"
import { chi, inFila, servizioCarte } from "../../../../carte-regalo/comune"
import { perVista, type Proposta } from "../../comune"

const Rifiuto = z.object({
  nota: z.string({ error: "Write a note for the company" }).trim().min(3, "Write a note for the company").max(500, "That note is too long"),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { nota } = valida(Rifiuto, req.body)
  const servizio = servizioCarte(req)
  const attore = await chi(req)
  const decisa = await inFila(req, `proposta-sconto:${req.params.id}`, async () => {
    const proposta = await servizio.retrieveProposta(req.params.id)
    if (proposta.stato !== "in_attesa") throw invalido("This proposal has already been decided")
    return servizio.updatePropostas({ id: proposta.id, stato: "rifiutata", nota, deciso_da: attore, deciso_il: new Date() })
  })
  const [vista] = await perVista(req.scope, [decisa as unknown as Proposta])
  res.json({ proposta: vista })
}
