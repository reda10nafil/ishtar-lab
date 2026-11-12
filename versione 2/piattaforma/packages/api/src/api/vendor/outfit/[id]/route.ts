import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { caricaOutfit, contieneAzienda, outfitNonTrovato, schedeDi, vistaAzienda } from "../../../admin/outfit/lettura"
import { aziendaDi, interroga } from "../../../utili"

/** Un outfit senza capi dell'azienda risponde come se non esistesse. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const azienda = aziendaDi(req)
  const outfit = await caricaOutfit(req, req.params.id)
  if (!contieneAzienda(outfit, azienda)) throw outfitNonTrovato()
  const schede = await schedeDi(interroga(req), [outfit])
  res.json({ outfit: vistaAzienda(outfit, schede, azienda) })
}
