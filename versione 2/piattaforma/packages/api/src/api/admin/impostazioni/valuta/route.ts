import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { leggiImpostazioni } from "../lettura"

/** Valuta in cui mostrare gli importi: la leggono tutti i ruoli, non solo chi vede le impostazioni. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { negozio } = await leggiImpostazioni(req.scope)
  res.json({ codice: negozio.valuta })
}
