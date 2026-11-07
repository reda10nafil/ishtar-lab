import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { motivoBloccoPubblicazione } from "../../../../../modules/outfit/calcolo"
import { interroga, rifiutato, valida } from "../../../../utili"
import { caricaOutfit, esitoOutfit, puoVedereMargini, schedeDi, servizioOutfit, vistaOutfit } from "../../lettura"
import { CambioStato } from "../../schemi"

/** Pubblicare cambia lo stato vero dell'outfit, e solo se il cliente lo troverebbe comprabile. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { stato } = valida(CambioStato, req.body)
  const query = interroga(req)
  const attuale = await caricaOutfit(req, req.params.id)

  if (stato === "pubblicato") {
    const schede = await schedeDi(query, [attuale])
    const motivo = motivoBloccoPubblicazione(attuale.capi.length, esitoOutfit(attuale, schede).disponibilita.motivi)
    if (motivo) throw rifiutato(motivo)
  }

  if (stato !== attuale.stato) {
    await servizioOutfit(req).updateOutfits({
      id: attuale.id,
      stato,
      ...(stato === "pubblicato" ? { pubblicato_il: new Date() } : {}),
      ...(stato === "bozza" ? { pubblicato_il: null } : {}),
    })
  }

  const outfit = await caricaOutfit(req, req.params.id)
  const schede = await schedeDi(query, [outfit])
  res.json({ outfit: vistaOutfit(outfit, schede, puoVedereMargini(req)) })
}
