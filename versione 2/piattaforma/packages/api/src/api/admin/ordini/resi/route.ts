import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valida } from "../../../utili"
import { creaReso, elencoResi, ParametriResi } from "../lib/resi"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await elencoResi(req, valida(ParametriResi, req.query).vista))
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.status(201).json({ id: await creaReso(req, req.body) })
}
