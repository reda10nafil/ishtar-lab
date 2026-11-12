import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { aziendaDi, valida } from "../../../utili"
import { leggiScorte } from "../../../admin/magazzino/lib/scorte"
import { riepilogoSoglie, salvaSogliaAzienda, valoreSoglia } from "../../../admin/magazzino/lib/soglie"

const SogliaAzienda = z.object({ soglia: valoreSoglia })

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { righe } = await leggiScorte(req, aziendaDi(req))
  res.json(await riepilogoSoglie(req, righe, false))
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { soglia } = valida(SogliaAzienda, req.body)
  await salvaSogliaAzienda(req, aziendaDi(req), soglia)
  res.json({ soglia })
}
