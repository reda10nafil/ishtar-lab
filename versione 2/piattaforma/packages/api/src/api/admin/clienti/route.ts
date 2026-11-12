import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { interroga, invalido, valida } from "../../utili"
import { ParametriClienti, elencoClienti, leggiClienti } from "./lib/clienti"
import { DatiCliente } from "./lib/moduli"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parametri = valida(ParametriClienti, req.query)
  res.json(elencoClienti(await leggiClienti(req), parametri))
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const corpo = valida(DatiCliente, req.body)
  const { data } = await interroga(req).graph({ entity: "customer", fields: ["id"], filters: { email: corpo.email } })
  if (data.length) throw invalido("A customer with this email already exists")
  const { result } = await createCustomersWorkflow(req.scope).run({
    input: {
      customersData: [
        {
          email: corpo.email,
          first_name: corpo.nome,
          last_name: corpo.cognome || null,
          company_name: corpo.azienda || null,
          phone: corpo.telefono || null,
          created_by: req.auth_context.actor_id,
          metadata: {
            newsletter: Boolean(corpo.newsletter),
            newsletter_data: corpo.newsletter ? new Date().toISOString() : null,
            rivenditore: Boolean(corpo.rivenditore),
            citta: corpo.citta || null,
            tag: corpo.tag ?? [],
            note: corpo.note || null,
          },
        },
      ],
    },
  })
  res.status(201).json({ id: result[0].id })
}
