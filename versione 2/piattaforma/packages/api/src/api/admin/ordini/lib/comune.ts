import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { interroga } from "../../../utili"
import { inFila } from "../../carte-regalo/comune"
import { scordaUnici } from "./unico"

export const servizioOrdini = (req: AuthenticatedMedusaRequest) => req.scope.resolve<IOrderModuleService>(Modules.ORDER)

/** Più azioni sullo stesso ordine passano una alla volta: i metadati si riscrivono interi. */
export const inFilaOrdine = <T>(req: AuthenticatedMedusaRequest, id: string, lavoro: () => Promise<T>) =>
  inFila(req, `ordine:${id}`, lavoro).finally(scordaUnici)

/** Testi leggibili al posto degli errori tecnici di Medusa. */
export const nonValido = (motivo: string) => new MedusaError(MedusaError.Types.INVALID_DATA, motivo)

/** Nome o email di chi agisce: finisce in cronologia e negli appunti. */
export async function autore(req: AuthenticatedMedusaRequest): Promise<string> {
  const { actor_id: id, actor_type: tipo } = req.auth_context
  const azienda = tipo !== "user"
  const { data } = await interroga(req).graph({ entity: azienda ? "member" : "user", fields: ["email", "first_name", "last_name"], filters: { id } })
  const persona = data[0] as { email?: string; first_name?: string | null; last_name?: string | null } | undefined
  return [persona?.first_name, persona?.last_name].filter(Boolean).join(" ") || persona?.email || (azienda ? "Company" : "Team")
}
