import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { linkCustomersToCustomerGroupWorkflow } from "@medusajs/medusa/core-flows"
import { valida } from "../../../../../utili"
import { leggiGruppo } from "../../../lib/gruppi"

const Membri = z.object({
  aggiungi: z.array(z.string().min(1)).default([]),
  togli: z.array(z.string().min(1)).default([]),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const { aggiungi, togli } = valida(Membri, req.body)
  await leggiGruppo(req, id)
  await linkCustomersToCustomerGroupWorkflow(req.scope).run({ input: { id, add: aggiungi, remove: togli } })
  res.json({ gruppo: await leggiGruppo(req, id) })
}
