import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { valida } from "../../../utili"
import { puo } from "../lib/contesto"
import { ParametriReport, creaReport } from "../lib/report"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parametri = valida(ParametriReport, req.query)
  const margini = puo(req, "margini")
  if (parametri.metrica === "margine" && !margini) throw new MedusaError(MedusaError.Types.FORBIDDEN, "Margins need the margins permission")
  res.json(await creaReport(req.scope, parametri, margini))
}
