import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONNECTORS_MODULE } from "../../../../../modules/connectors"
import type ConnectorsModuleService from "../../../../../modules/connectors/service"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const connettori = req.scope.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  res.json({ indirizzo: await connettori.avviaLogin(req.params.id) })
}
