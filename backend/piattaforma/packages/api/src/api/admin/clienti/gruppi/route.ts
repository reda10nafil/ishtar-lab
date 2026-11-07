import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createCustomerGroupsWorkflow } from "@medusajs/medusa/core-flows"
import { valida } from "../../../utili"
import { leggiGruppi, nomeLibero } from "../lib/gruppi"

const NuovoGruppo = z.object({
  nome: z.string({ message: "Enter a group name" }).trim().min(1, "Enter a group name").max(100, "No more than 100 characters"),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ gruppi: await leggiGruppi(req) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { nome } = valida(NuovoGruppo, req.body)
  await nomeLibero(req, nome)
  const { result } = await createCustomerGroupsWorkflow(req.scope).run({
    input: { customersData: [{ name: nome, created_by: req.auth_context.actor_id }] },
  })
  res.status(201).json({ id: result[0].id })
}
