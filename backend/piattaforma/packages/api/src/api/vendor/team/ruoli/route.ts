import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RUOLI_AZIENDA } from "../../../../modules/permessi/ruoli"

export async function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ ruoli: RUOLI_AZIENDA.map(({ id, etichetta, descrizione }) => ({ id, etichetta, descrizione })) })
}
