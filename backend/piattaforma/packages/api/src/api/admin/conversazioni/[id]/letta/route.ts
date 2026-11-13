import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONVERSAZIONI_MODULE } from "../../../../../modules/conversazioni"
import type ConversazioniModuleService from "../../../../../modules/conversazioni/service"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE).segnaLetta(req.params.id)
  res.json({ ok: true })
}
