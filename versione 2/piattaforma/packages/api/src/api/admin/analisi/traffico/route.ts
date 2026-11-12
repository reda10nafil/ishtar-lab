import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { leggiDemo, trafficoDi } from "../lib/demo"

/** Nessun tracciamento esiste ancora: si leggono i dati dimostrativi, se ci sono, altrimenti nulla. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ traffico: trafficoDi(await leggiDemo(req.scope)) })
}
