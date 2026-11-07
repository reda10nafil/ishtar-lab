import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { valida } from "../../../utili"
import { impostazioniDi, leggiStore, metadatiCon } from "../lettura"
import { leggiOpzioni, vistaOpzione } from "./tariffe"

const Regole = z.object({
  giorni_max_evasione: z
    .number({ error: "Enter the number of days" })
    .int("Days must be a whole number")
    .min(1, "At least 1 day")
    .max(60, "60 days at most")
    .nullable(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const [store, opzioni] = await Promise.all([leggiStore(req.scope), leggiOpzioni(req.scope)])
  res.json({ regole: impostazioniDi(store).spedizioni, opzioni: opzioni.map(vistaOpzione) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const regole = valida(Regole, req.body)
  const store = await leggiStore(req.scope)
  await updateStoresWorkflow(req.scope).run({
    input: { selector: { id: store.id }, update: { metadata: metadatiCon(store, { spedizioni: regole }) } },
  })
  res.json({ regole })
}
