import { randomUUID } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../../utili"
import { autore, inFilaOrdine, servizioOrdini } from "../../lib/comune"
import { noteDi } from "../../lib/scheda"
import { leggiUnico } from "../../lib/unico"

const NuovaNota = z.object({ testo: z.string({ error: "Write the note" }).trim().min(1, "Write the note").max(1000, "The note is too long") })

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { testo } = valida(NuovaNota, req.body)
  const nota = await inFilaOrdine(req, req.params.id, async () => {
    const [ordine] = (await leggiUnico(req.scope, req.params.id)).ordini
    const voce = { id: randomUUID(), testo, chi: await autore(req), quando: new Date().toISOString() }
    await servizioOrdini(req).updateOrders([{ id: ordine.id, metadata: { ...ordine.metadata, note: [voce, ...noteDi(ordine)] } }])
    return voce
  })
  res.status(201).json({ nota })
}
