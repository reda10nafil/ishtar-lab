import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONVERSAZIONI_MODULE } from "../../../../../modules/conversazioni"
import type ConversazioniModuleService from "../../../../../modules/conversazioni/service"
import { valida } from "../../../../utili"
import { rigaConversazione } from "../../lib/elenco"
import { CambioStato } from "../../lib/schemi"

/** Chiude o riapre la conversazione (un messaggio nuovo del cliente la riapre comunque). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { stato } = valida(CambioStato, req.body)
  const s = req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  await s.cambiaStato(req.params.id, stato)
  res.json({ conversazione: rigaConversazione(await s.retrieveConversazione(req.params.id, { relations: ["identita"] })) })
}
