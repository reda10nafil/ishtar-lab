import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CONNECTORS_MODULE } from "../../../../modules/connectors"
import type ConnectorsModuleService from "../../../../modules/connectors/service"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const corpo = req.body as { valori?: unknown }
  if (!corpo?.valori || typeof corpo.valori !== "object" || Array.isArray(corpo.valori)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing data")
  }
  const connettori = req.scope.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  const esito = await connettori.salva(req.params.id, corpo.valori as Record<string, string>)
  res.json({ esito })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const connettori = req.scope.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  await connettori.scollega(req.params.id)
  res.json({ id: req.params.id, scollegato: true })
}
