import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createCustomerAddressesWorkflow } from "@medusajs/medusa/core-flows"
import { valida } from "../../../../utili"
import { leggiCliente } from "../../lib/clienti"
import { DatiIndirizzo, perMedusa } from "../../lib/moduli"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const corpo = valida(DatiIndirizzo, req.body)
  await leggiCliente(req, id)
  const { result } = await createCustomerAddressesWorkflow(req.scope).run({
    input: { addresses: [{ ...perMedusa(corpo), customer_id: id }] },
  })
  res.status(201).json({ id: result[0].id })
}
