import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONVERSAZIONI_MODULE } from "../../../../../modules/conversazioni"
import type ConversazioniModuleService from "../../../../../modules/conversazioni/service"
import { interroga, nonTrovato, valida } from "../../../../utili"
import { vistaIdentita } from "../../lib/elenco"
import { Collegamento } from "../../lib/schemi"

/** Collega il contatto della conversazione a un cliente del negozio (o lo scollega con null): lo decide il team. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { cliente_id } = valida(Collegamento, req.body)
  const s = req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  const conversazione = await s.retrieveConversazione(req.params.id, { relations: ["identita"] })
  if (cliente_id) {
    const { data } = await interroga(req).graph({ entity: "customer", fields: ["id"], filters: { id: cliente_id } })
    if (!data.length) throw nonTrovato("Customer")
  }
  await s.collegaCliente(conversazione.identita.id, cliente_id)
  res.json({ identita: vistaIdentita(await s.retrieveIdentita(conversazione.identita.id)) })
}
