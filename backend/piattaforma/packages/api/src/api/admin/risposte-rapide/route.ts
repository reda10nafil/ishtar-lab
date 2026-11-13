import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONVERSAZIONI_MODULE } from "../../../modules/conversazioni"
import type ConversazioniModuleService from "../../../modules/conversazioni/service"
import { valida } from "../../utili"
import { RispostaRapidaNuova } from "../conversazioni/lib/schemi"

const vista = (r: { id: string; titolo: string; testo: string }) => ({ id: r.id, titolo: r.titolo, testo: r.testo })

/** Risposte rapide della casella: le usa chi risponde, le scrive chi gestisce la casella. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const s = req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  res.json({ risposte: (await s.listRispostaRapidas({}, { order: { titolo: "ASC" } })).map(vista) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(RispostaRapidaNuova, req.body)
  const s = req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  res.json({ risposta: vista(await s.createRispostaRapidas(dati)) })
}
