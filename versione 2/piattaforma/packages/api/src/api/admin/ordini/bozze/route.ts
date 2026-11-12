import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { creaBozza, elencoBozze } from "../lib/bozze"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await elencoBozze(req))
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.status(201).json(await creaBozza(req, req.body))
}
