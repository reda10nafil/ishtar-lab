import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { leggiImpostazioni } from "../../../admin/impostazioni/lettura"

/** Valuta in cui mostrare gli importi alle aziende. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { negozio } = await leggiImpostazioni(req.scope)
  res.json({ codice: negozio.valuta })
}
