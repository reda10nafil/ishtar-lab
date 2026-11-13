import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONVERSAZIONI_MODULE } from "../../../../modules/conversazioni"
import type ConversazioniModuleService from "../../../../modules/conversazioni/service"
import { valida } from "../../../utili"
import { RispostaRapidaNuova } from "../../conversazioni/lib/schemi"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(RispostaRapidaNuova, req.body)
  const s = req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  await s.retrieveRispostaRapida(req.params.id)
  const r = await s.updateRispostaRapidas({ id: req.params.id, ...dati })
  res.json({ risposta: { id: r.id, titolo: r.titolo, testo: r.testo } })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const s = req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  await s.retrieveRispostaRapida(req.params.id)
  await s.deleteRispostaRapidas(req.params.id)
  res.json({ id: req.params.id, eliminata: true })
}
