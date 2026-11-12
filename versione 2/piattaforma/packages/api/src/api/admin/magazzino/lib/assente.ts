import { MedusaError } from "@medusajs/framework/utils"

/** Risposta 404 in inglese, come il resto dell'interfaccia. */
export const assente = (cosa: string) => new MedusaError(MedusaError.Types.NOT_FOUND, `${cosa} not found`)
