import type { MiddlewareFunction, MiddlewareRoute } from "@medusajs/framework/http"
import { requirePermission } from "@mercurjs/core/api/utils/permissions-middleware"
import type { PermissionRight } from "@mercurjs/types"

export type RottaProtetta = MiddlewareRoute

/**
 * Il controllo di Mercur è tipizzato sulla richiesta autenticata; Medusa accetta
 * middleware generici. Il contesto di autenticazione c'è sempre sulle rotte admin e vendor.
 */
export const permesso = (chiave: string, diritto: PermissionRight): MiddlewareFunction =>
  requirePermission(chiave, diritto) as unknown as MiddlewareFunction
