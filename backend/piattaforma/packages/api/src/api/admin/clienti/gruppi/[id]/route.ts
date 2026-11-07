import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { deleteCustomerGroupsWorkflow, updateCustomerGroupsWorkflow } from "@medusajs/medusa/core-flows"
import { valida } from "../../../../utili"
import { leggiGruppo, nomeLibero } from "../../lib/gruppi"

const Rinomina = z.object({
  nome: z.string({ message: "Enter a group name" }).trim().min(1, "Enter a group name").max(100, "No more than 100 characters"),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ gruppo: await leggiGruppo(req, req.params.id) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const { nome } = valida(Rinomina, req.body)
  await leggiGruppo(req, id)
  await nomeLibero(req, nome, id)
  await updateCustomerGroupsWorkflow(req.scope).run({ input: { selector: { id }, update: { name: nome } } })
  res.json({ id, nome })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  await leggiGruppo(req, id)
  await deleteCustomerGroupsWorkflow(req.scope).run({ input: { ids: [id] } })
  res.json({ id, eliminato: true })
}
