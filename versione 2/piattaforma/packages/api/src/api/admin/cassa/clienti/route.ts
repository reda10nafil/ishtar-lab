import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { interroga } from "../../../utili"

const MASSIMO = 8

type Cliente = { id: string; email: string; first_name: string | null; last_name: string | null }

/** Solo ciò che serve al banco: il permesso della cassa non apre tutta l'anagrafica. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
  if (q.length < 2) {
    res.json({ clienti: [] })
    return
  }
  const { data } = await interroga(req).graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name"],
    filters: { q } as never,
    pagination: { take: MASSIMO },
  })
  res.json({
    clienti: (data as unknown as Cliente[]).map((c) => ({
      id: c.id,
      email: c.email,
      nome: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email,
    })),
  })
}
