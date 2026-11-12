import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { updateShippingOptionsWorkflow, type UpdateShippingOptionsWorkflowInput } from "@medusajs/medusa/core-flows"
import { valida } from "../../../../../utili"
import { leggiOpzioni, prezziAggiornati, regoleAggiornate, vistaOpzione } from "../../tariffe"

const MASSIMO_IMPORTO = 1_000_000

const Modifica = z.object({
  nome: z.string({ error: "Enter a name for this option" }).trim().min(1, "Enter a name for this option").max(120, "Name is too long"),
  tariffa: z.number({ error: "Enter the rate" }).min(0, "The rate cannot be negative").max(MASSIMO_IMPORTO, "The rate is too high"),
  soglia_gratuita: z
    .number({ error: "The threshold must be an amount" })
    .positive("The threshold must be above zero")
    .max(MASSIMO_IMPORTO, "The threshold is too high")
    .nullable(),
  attiva: z.boolean({ error: "Say whether this option is on" }),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { nome, tariffa, soglia_gratuita, attiva } = valida(Modifica, req.body)
  const [opzione] = await leggiOpzioni(req.scope, req.params.id)
  if (!opzione) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Shipping option not found")

  const input = [{
    id: opzione.id,
    name: nome,
    prices: prezziAggiornati(opzione, tariffa, soglia_gratuita),
    rules: regoleAggiornate(opzione, attiva),
  }]
  await updateShippingOptionsWorkflow(req.scope).run({ input: input as unknown as UpdateShippingOptionsWorkflowInput })

  const [aggiornata] = await leggiOpzioni(req.scope, opzione.id)
  res.json({ opzione: vistaOpzione(aggiornata) })
}
