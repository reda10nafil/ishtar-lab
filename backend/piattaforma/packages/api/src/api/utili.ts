import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { z } from "@medusajs/framework/zod"

/** Valida il corpo della richiesta e restituisce un messaggio leggibile dall'interfaccia. */
export function valida<S extends z.ZodTypeAny>(schema: S, dati: unknown): z.infer<S> {
  const esito = schema.safeParse(dati)
  if (esito.success) return esito.data
  const problema = esito.error.issues[0]
  throw new MedusaError(MedusaError.Types.INVALID_DATA, problema?.message ?? "Invalid data")
}

export const nonTrovato = (cosa: string) => new MedusaError(MedusaError.Types.NOT_FOUND, `${cosa} not found`)

export const rifiutato = (motivo: string) => new MedusaError(MedusaError.Types.NOT_ALLOWED, motivo)

export const invalido = (motivo: string) => new MedusaError(MedusaError.Types.INVALID_DATA, motivo)

export const interroga = (req: AuthenticatedMedusaRequest) => req.scope.resolve(ContainerRegistrationKeys.QUERY)

/** L'azienda è letta dal contesto verificato da Mercur, mai dall'intestazione grezza. */
export function aziendaDi(req: AuthenticatedMedusaRequest): string {
  const azienda = (req as unknown as { seller_context?: { seller_id?: string } }).seller_context?.seller_id
  if (!azienda) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Company not recognised")
  return azienda
}
