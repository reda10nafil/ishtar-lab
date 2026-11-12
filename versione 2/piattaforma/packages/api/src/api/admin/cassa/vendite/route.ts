import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valida } from "../../../utili"
import { NuovaVendita, registraVendita } from "../lib/vendita"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.status(201).json({ vendita: await registraVendita(req, valida(NuovaVendita, req.body)) })
}
