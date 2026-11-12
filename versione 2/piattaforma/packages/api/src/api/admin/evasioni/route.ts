import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valida } from "../../utili"
import { elencoCoda, leggiCoda, ParametriCoda } from "../ordini/lib/coda"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(elencoCoda(await leggiCoda(req.scope), valida(ParametriCoda, req.query), true))
}
