import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONVERSAZIONI_MODULE } from "../../../../modules/conversazioni"
import { ORDINE_MESSAGGI } from "../../../../modules/conversazioni/regole"
import type ConversazioniModuleService from "../../../../modules/conversazioni/service"
import { rigaConversazione, vistaIdentita, vistaMessaggio } from "../lib/elenco"

/**
 * Una conversazione con gli ultimi 200 messaggi nell'ordine di arrivo nella casella (lo stesso dei messaggi nuovi), dal più
 * vecchio. Leggerla non la segna come letta (c'è POST letta).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const s = req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  const conversazione = await s.retrieveConversazione(req.params.id, { relations: ["identita"] })
  const messaggi = await s.listBattutas({ conversazione_id: conversazione.id }, { order: ORDINE_MESSAGGI, take: 200 })
  res.json({
    conversazione: rigaConversazione(conversazione),
    messaggi: messaggi.reverse().map(vistaMessaggio),
    identita: vistaIdentita(conversazione.identita),
  })
}
