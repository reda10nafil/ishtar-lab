import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteCustomersWorkflow, updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { interroga, invalido, valida } from "../../../utili"
import { leggiCliente } from "../lib/clienti"
import { ModificaCliente } from "../lib/moduli"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { scheda, indirizzi, ordini } = await leggiCliente(req, req.params.id)
  res.json({ cliente: scheda, indirizzi, ordini })
}

/** Il consenso alla newsletter porta la data dell'ultima scelta del cliente. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const corpo = valida(ModificaCliente, req.body)
  const { grezzo, scheda } = await leggiCliente(req, id)
  if (corpo.email && corpo.email !== grezzo.email) {
    const { data } = await interroga(req).graph({ entity: "customer", fields: ["id"], filters: { email: corpo.email } })
    if (data.length) throw invalido("A customer with this email already exists")
  }
  const consensoCambiato = corpo.newsletter !== undefined && corpo.newsletter !== scheda.newsletter
  await updateCustomersWorkflow(req.scope).run({
    input: {
      selector: { id },
      update: {
        email: corpo.email,
        first_name: corpo.nome,
        last_name: corpo.cognome === undefined ? undefined : corpo.cognome || null,
        company_name: corpo.azienda === undefined ? undefined : corpo.azienda || null,
        phone: corpo.telefono === undefined ? undefined : corpo.telefono || null,
        metadata: {
          ...grezzo.metadata,
          newsletter: corpo.newsletter ?? scheda.newsletter,
          newsletter_data: consensoCambiato ? new Date().toISOString() : scheda.newsletter_data,
          rivenditore: corpo.rivenditore ?? scheda.rivenditore,
          note: corpo.note === undefined ? scheda.note : corpo.note || null,
        },
      },
    },
  })
  const dopo = await leggiCliente(req, id)
  res.json({ cliente: dopo.scheda })
}

/** Gli ordini restano nello storico: portano già il proprio indirizzo di spedizione. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  await leggiCliente(req, id)
  await deleteCustomersWorkflow(req.scope).run({ input: { ids: [id] } })
  res.json({ id, eliminato: true })
}
