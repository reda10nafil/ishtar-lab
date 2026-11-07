import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PERMESSI_MODULE } from "../modules/permessi"
import type PermessiModuleService from "../modules/permessi/service"

type Autenticata = MedusaRequest & {
  auth_context?: { actor_id?: string; actor_type?: string }
  seller_context?: { seller_id?: string }
}

const METODI = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Scrive nel registro ogni modifica riuscita o negata.
 * Salva solo il percorso, senza parametri né corpo: non può contenere segreti.
 */
export function registraModifiche(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (!METODI.has(req.method)) return next()
  const percorso = req.originalUrl.split("?")[0]
  res.once("finish", () => {
    const { auth_context, seller_context } = req as Autenticata
    if (!auth_context?.actor_id) return
    const permessi = req.scope.resolve<PermessiModuleService>(PERMESSI_MODULE)
    permessi
      .createRegistraziones({
        attore_tipo: auth_context.actor_type ?? "sconosciuto",
        attore_id: auth_context.actor_id,
        azienda_id: seller_context?.seller_id ?? null,
        metodo: req.method,
        percorso,
        esito: res.statusCode,
      })
      .catch((errore: Error) => {
        req.scope.resolve(ContainerRegistrationKeys.LOGGER).warn(`Activity log entry not written: ${errore.message}`)
      })
  })
  next()
}
