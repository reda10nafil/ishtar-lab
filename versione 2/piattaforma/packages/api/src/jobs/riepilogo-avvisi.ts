import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getPermissionCatalog } from "@mercurjs/core/permissions/registry"
import { inviaRiepilogo } from "../api/admin/avvisi/invio-riepilogo"
import { PERMESSI_MODULE } from "../modules/permessi"
import type PermessiModuleService from "../modules/permessi/service"
import { RUOLO_PROPRIETARIO } from "../modules/permessi/ruoli"

/** Ogni mattina il proprietario riceve gli avvisi non letti. Il riepilogo si spegne in Settings, sotto Alerts. */
export default async function riepilogoAvvisi(container: MedusaContainer) {
  const permessi = container.resolve<PermessiModuleService>(PERMESSI_MODULE)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const proprietari = await permessi.listRuoloCollaboratores({ ruolo: RUOLO_PROPRIETARIO })
  const { data: utenti } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "user",
    fields: ["id"],
    filters: { email: proprietari.map((p) => p.email) },
  })
  for (const { id } of utenti) {
    try {
      const attore = { actor_type: "user", actor_id: id, surface: "admin" as const }
      const concessi = await permessi.resolvePermissions(attore, getPermissionCatalog())
      // Le fonti leggono solo contenitore, account e permessi: qui valgono come in una richiesta.
      const contesto = { scope: container, auth_context: attore, permissions: concessi } as unknown as AuthenticatedMedusaRequest
      await inviaRiepilogo(contesto)
    } catch (errore) {
      logger.warn(`Riepilogo degli avvisi non inviato: ${(errore as Error).message}`)
    }
  }
}

export const config = { name: "riepilogo-avvisi", schedule: "0 7 * * *" }
