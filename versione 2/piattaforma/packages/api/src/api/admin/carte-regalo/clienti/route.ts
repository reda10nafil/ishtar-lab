import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { interroga } from "../../../utili"

const MASSIMO = 200

/** I clienti veri tra cui scegliere il destinatario di una carta. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { data } = await interroga(req).graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name"],
    pagination: { take: MASSIMO, order: { first_name: "ASC" } },
  })
  res.json({
    clienti: data.map((c) => ({ id: c.id, nome: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email, email: c.email })),
  })
}
