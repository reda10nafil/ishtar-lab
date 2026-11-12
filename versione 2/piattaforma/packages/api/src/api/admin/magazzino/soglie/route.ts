import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../utili"
import { leggiScorte, vedeMargini } from "../lib/scorte"
import { riepilogoSoglie, salvaSogliaAzienda, valoreSoglia } from "../lib/soglie"

const SogliaAzienda = z.object({ azienda_id: z.string().min(1, "Choose a company"), soglia: valoreSoglia })

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { righe } = await leggiScorte(req)
  res.json(await riepilogoSoglie(req, righe, vedeMargini(req)))
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { azienda_id, soglia } = valida(SogliaAzienda, req.body)
  await salvaSogliaAzienda(req, azienda_id, soglia)
  res.json({ azienda_id, soglia })
}
