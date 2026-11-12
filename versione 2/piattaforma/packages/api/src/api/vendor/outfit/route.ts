import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { schedeDi, servizioOutfit, vistaAzienda, type RigaOutfit } from "../../admin/outfit/lettura"
import { FiltriElencoAzienda } from "../../admin/outfit/schemi"
import { aziendaDi, interroga, valida } from "../../utili"

/** Gli outfit che contengono capi dell'azienda collegata. L'azienda viene dal contesto verificato, mai dalla richiesta. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { q, stato, limit, offset } = valida(FiltriElencoAzienda, req.query)
  const azienda = aziendaDi(req)
  const servizio = servizioOutfit(req)

  const [capi, alternative] = await Promise.all([
    servizio.listCapoOutfits({ azienda_id: azienda }, { select: ["outfit_id"], take: null }),
    servizio.listCapoOutfits({ alternativa_azienda_id: azienda }, { select: ["outfit_id"], take: null }),
  ])
  const ids = [...new Set([...capi, ...alternative].map((c) => c.outfit_id))]
  if (!ids.length) {
    res.json({ outfit: [], count: 0, offset, limit })
    return
  }

  const [righe, count] = await servizio.listAndCountOutfits(
    { id: ids, ...(q ? { q } : {}), ...(stato ? { stato } : {}) },
    { relations: ["capi"], order: { updated_at: "DESC" }, take: limit, skip: offset }
  )
  const outfit = righe as unknown as RigaOutfit[]
  const schede = await schedeDi(interroga(req), outfit)
  res.json({ outfit: outfit.map((o) => vistaAzienda(o, schede, azienda)), count, offset, limit })
}
