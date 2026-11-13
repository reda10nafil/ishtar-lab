import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONVERSAZIONI_MODULE } from "../../../../../modules/conversazioni"
import type ConversazioniModuleService from "../../../../../modules/conversazioni/service"
import { valida } from "../../../../utili"
import { rigaConversazione } from "../../lib/elenco"
import { CambioStato } from "../../lib/schemi"

/**
 * Chiude o riapre la conversazione (un messaggio nuovo del cliente la riapre comunque). Se il cliente ha scritto dopo
 * l'ultimo messaggio che la pagina mostrava, non si chiude: 412 con quanti messaggi nuovi ci sono.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { stato, ultimo_visto } = valida(CambioStato, req.body)
  const s = req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  const { nuovi } = await s.cambiaStato(req.params.id, stato, ultimo_visto ?? null)
  if (nuovi > 0) {
    res.status(412).json({ message: "The customer wrote again: read the new messages before closing", code: "conflitto", nuovi })
    return
  }
  res.json({ conversazione: rigaConversazione(await s.retrieveConversazione(req.params.id, { relations: ["identita"] })) })
}
