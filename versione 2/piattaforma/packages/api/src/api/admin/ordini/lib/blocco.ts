import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { satisfiesRight } from "@mercurjs/core/permissions/registry"
import type { PermissionMap } from "@mercurjs/types"
import { rifiutato, valida } from "../../../utili"
import { nonValido } from "./comune"
import { eseguiAzione, prossimoPasso } from "./evasione"
import { annulla, incassa } from "./pagamento"
import { leggiUnico } from "./unico"

const Blocco = z.object({
  azione: z.enum(["avanza", "incassa", "annulla"], { error: "Choose an action" }),
  ids: z.array(z.string().min(1), { error: "Select at least one order" }).min(1, "Select at least one order").max(200, "Too many orders at once"),
})

const puo = (req: AuthenticatedMedusaRequest, chiave: string, diritto: "view" | "edit" | "manage") =>
  satisfiesRight(((req as unknown as { permissions?: PermissionMap }).permissions ?? {})[chiave], diritto)

const PERMESSI = { avanza: ["evasioni", "edit"], incassa: ["payments", "edit"], annulla: ["orders", "edit"] } as const

/** «Move on»: ogni richiesta dell'ordine fa un passo avanti. */
export async function avanza(req: AuthenticatedMedusaRequest, id: string) {
  const unico = await leggiUnico(req.scope, id)
  const passi = unico.richieste.map((r) => ({ r, passo: prossimoPasso(r) })).filter((x) => x.passo)
  if (!passi.length) throw nonValido("This order cannot move on")
  for (const { r, passo } of passi) await eseguiAzione(req, r.ordine_id, r.azienda_id, passo as NonNullable<typeof passo>, "admin", {})
}

const AZIONI = { avanza, incassa, annulla }

export async function inBlocco(req: AuthenticatedMedusaRequest, corpo: unknown) {
  const { azione, ids } = valida(Blocco, corpo)
  const [chiave, diritto] = PERMESSI[azione]
  if (!puo(req, chiave, diritto)) throw rifiutato("You do not have permission to do this")
  const falliti: { id: string; motivo: string }[] = []
  for (const id of ids) {
    try {
      await AZIONI[azione](req, id)
    } catch (errore) {
      falliti.push({ id, motivo: (errore as Error).message })
    }
  }
  return { riusciti: ids.length - falliti.length, falliti }
}
