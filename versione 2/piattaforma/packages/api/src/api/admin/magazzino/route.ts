import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valida } from "../../utili"
import { ParametriElenco, elenco, leggiScorte, vedeMargini } from "./lib/scorte"

/** Scorte di tutte le aziende, con filtri per azienda, deposito, stato e ricerca. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parametri = valida(ParametriElenco, req.query)
  const { righe, depositi } = await leggiScorte(req)
  const aziende = new Map(righe.map((r) => [r.azienda_id, r.azienda]))
  res.json({
    ...elenco(righe, parametri, vedeMargini(req)),
    depositi,
    aziende: [...aziende].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "it")),
  })
}
