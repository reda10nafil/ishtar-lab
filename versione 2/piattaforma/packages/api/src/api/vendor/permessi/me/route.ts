import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PERMESSI_MODULE } from "../../../../modules/permessi"
import type PermessiModuleService from "../../../../modules/permessi/service"

type Contesto = { seller_context?: { seller_member?: { id: string } }; permissions?: Record<string, string> }

/** Ruolo e permessi del membro collegato per l'azienda scelta. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const contesto = req as unknown as Contesto
  const permessi = req.scope.resolve<PermessiModuleService>(PERMESSI_MODULE)
  const membro = contesto.seller_context?.seller_member?.id
  const ruolo = membro ? await permessi.ruoloDiMembro(membro) : undefined
  res.json({
    ruolo: ruolo ? { id: ruolo.id, etichetta: ruolo.etichetta } : null,
    permessi: contesto.permissions ?? {},
  })
}
