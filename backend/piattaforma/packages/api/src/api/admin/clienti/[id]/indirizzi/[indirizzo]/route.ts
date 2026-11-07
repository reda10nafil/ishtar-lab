import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteCustomerAddressesWorkflow, updateCustomerAddressesWorkflow } from "@medusajs/medusa/core-flows"
import { valida } from "../../../../../utili"
import { assente } from "../../../../magazzino/lib/assente"
import { leggiCliente } from "../../../lib/clienti"
import { ModificaIndirizzo, perMedusa } from "../../../lib/moduli"

async function verifica(req: AuthenticatedMedusaRequest) {
  const { id, indirizzo } = req.params
  const { indirizzi } = await leggiCliente(req, id)
  if (!indirizzi.some((i) => i.id === indirizzo)) throw assente("Address")
  return { id, indirizzo }
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const corpo = valida(ModificaIndirizzo, req.body)
  const { id, indirizzo } = await verifica(req)
  await updateCustomerAddressesWorkflow(req.scope).run({
    input: { selector: { id: indirizzo, customer_id: id }, update: perMedusa(corpo) },
  })
  res.json({ id: indirizzo })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { indirizzo } = await verifica(req)
  await deleteCustomerAddressesWorkflow(req.scope).run({ input: { ids: [indirizzo] } })
  res.json({ id: indirizzo, eliminato: true })
}
