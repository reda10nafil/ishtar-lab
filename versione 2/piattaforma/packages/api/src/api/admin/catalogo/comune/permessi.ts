import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

const RANGO: Record<string, number> = { view: 1, edit: 2, manage: 3 }

type ConPermessi = { permissions?: Record<string, string> }

/** Legge i permessi che Mercur ha già risolto per chi sta chiamando. */
export function puo(req: AuthenticatedMedusaRequest, chiave: string, diritto: "view" | "edit" | "manage" = "view") {
  const valore = (req as unknown as ConPermessi).permissions?.[chiave]
  return (RANGO[valore ?? ""] ?? 0) >= RANGO[diritto]
}

/** Come `nonTrovato` di `utili.ts`, con il messaggio in inglese dell'interfaccia. */
export const assente = (cosa: string) => new MedusaError(MedusaError.Types.NOT_FOUND, `${cosa} not found`)

/** Prezzo di cessione e margine viaggiano solo verso chi ha questo permesso. */
export const vedeMargini = (req: AuthenticatedMedusaRequest) => puo(req, "margini", "view")

/**
 * L'offerta è il legame fra azienda e variante: cessione e consigliato stanno nei suoi metadati
 * perché appartengono a una sola azienda. `rotte/catalogo.ts` li toglie dalle rotte native.
 */
export const CHIAVI_RISERVATE = ["prezzo_cessione", "prezzo_consigliato", "proposta_prezzi"]
