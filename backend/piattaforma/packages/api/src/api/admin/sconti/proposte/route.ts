import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { interroga } from "../../../utili"
import { servizioCarte } from "../../carte-regalo/comune"
import { perVista, type Proposta } from "./comune"

const MASSIMO = 500
const STATI = ["in_attesa", "approvata", "rifiutata"] as const

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const stato = STATI.find((s) => s === req.query.stato)
  const servizio = servizioCarte(req)
  const [proposte, [, inAttesa]] = await Promise.all([
    servizio.listPropostas(stato ? { stato } : {}, { order: { created_at: "DESC" }, take: MASSIMO }),
    servizio.listAndCountPropostas({ stato: "in_attesa" }, { take: 1 }),
  ])

  const nomi = new Map<string, string>()
  const aziendeId = [...new Set(proposte.map((p) => p.azienda_id))]
  if (aziendeId.length) {
    const { data } = await interroga(req).graph({ entity: "seller", fields: ["id", "name"], filters: { id: aziendeId } })
    for (const azienda of data) nomi.set(azienda.id, azienda.name)
  }

  const viste = await perVista(req.scope, proposte as unknown as Proposta[])
  res.json({
    proposte: viste.map((vista, i) => ({ ...vista, azienda: nomi.get(proposte[i].azienda_id) ?? "Company removed", deciso_da: proposte[i].deciso_da })),
    in_attesa: inAttesa,
  })
}
