import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONVERSAZIONI_MODULE } from "../../../../../modules/conversazioni"
import type ConversazioniModuleService from "../../../../../modules/conversazioni/service"
import { valida } from "../../../../utili"
import { Letta } from "../../lib/schemi"

/** Letta fino all'ultimo messaggio che la pagina mostrava: quelli arrivati dopo restano da leggere. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { ultimo_visto } = valida(Letta, req.body)
  await req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE).segnaLetta(req.params.id, ultimo_visto)
  res.json({ ok: true })
}
