import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valida } from "../../utili"
import { contaAperti } from "./lib/resi"
import { elenco, leggiUnici, ParametriElenco } from "./lib/unico"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parametri = valida(ParametriElenco, req.query)
  const [unici, resi] = await Promise.all([leggiUnici(req.scope), contaAperti(req.scope)])
  res.json(elenco(unici, parametri, resi))
}
