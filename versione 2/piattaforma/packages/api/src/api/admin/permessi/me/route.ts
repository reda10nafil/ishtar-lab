import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PERMESSI_MODULE } from "../../../../modules/permessi"
import type PermessiModuleService from "../../../../modules/permessi/service"

/** Ruolo e permessi di chi è collegato: l'interfaccia li usa solo per mostrare o nascondere. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const permessi = req.scope.resolve<PermessiModuleService>(PERMESSI_MODULE)
  const ruolo = await permessi.ruoloDiUtente(req.auth_context.actor_id)
  res.json({
    ruolo: ruolo ? { id: ruolo.id, etichetta: ruolo.etichetta } : null,
    permessi: (req as unknown as { permissions?: Record<string, string> }).permissions ?? {},
  })
}
