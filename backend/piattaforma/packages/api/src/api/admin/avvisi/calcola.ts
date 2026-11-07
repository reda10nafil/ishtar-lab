import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { satisfiesRight } from "@mercurjs/core/permissions/registry"
import type { PermissionMap } from "@mercurjs/types"
import { ASSISTENZA_MODULE } from "../../../modules/assistenza"
import type AssistenzaModuleService from "../../../modules/assistenza/service"
import type { Attore } from "../../../modules/assistenza/service"
import { aziendaDi, valida } from "../../utili"
import { FONTI, type Avviso, type Fonte, type Profilo } from "./fonti"

const MASSIMO_CHIAVI = 1000

const Letti = z.object({
  chiavi: z.array(z.string().min(1).max(300), { error: "No notifications specified" }).min(1, "No notifications specified").max(MASSIMO_CHIAVI),
})

const servizio = (req: AuthenticatedMedusaRequest) => req.scope.resolve<AssistenzaModuleService>(ASSISTENZA_MODULE)

const attoreDi = (req: AuthenticatedMedusaRequest): Attore => ({ tipo: req.auth_context.actor_type, id: req.auth_context.actor_id })

/** Le fonti che questo account può vedere: chi non ha il permesso non riceve nemmeno il conteggio. */
export function fontiPermesse(req: AuthenticatedMedusaRequest, profilo: Profilo): Fonte[] {
  const permessi = (req as unknown as { permissions?: PermissionMap }).permissions ?? {}
  return FONTI.filter((f) => f.profilo === profilo && (!f.permesso || satisfiesRight(permessi[f.permesso[0]], f.permesso[1])))
}

/** Una fonte in errore non blocca le altre: resta vuota e il problema finisce nel log. */
async function raccogli(req: AuthenticatedMedusaRequest, fonti: Fonte[], profilo: Profilo): Promise<Avviso[]> {
  const contesto = { req, attore: attoreDi(req), azienda: profilo === "azienda" ? aziendaDi(req) : null }
  const esiti = await Promise.allSettled(fonti.map((f) => f.calcola(contesto)))
  const avvisi: Avviso[] = []
  esiti.forEach((esito, i) => {
    if (esito.status === "fulfilled") avvisi.push(...esito.value)
    else req.scope.resolve(ContainerRegistrationKeys.LOGGER).warn(`Avvisi: fonte ${fonti[i].id} non letta: ${(esito.reason as Error).message}`)
  })
  return avvisi.sort((a, b) => (b.quando ?? "").localeCompare(a.quando ?? ""))
}

export async function elencoAvvisi(req: AuthenticatedMedusaRequest, res: MedusaResponse, profilo: Profilo) {
  const attore = attoreDi(req)
  const assistenza = servizio(req)
  const spente = new Set(await assistenza.fontiSpente(attore))
  const avvisi = await raccogli(req, fontiPermesse(req, profilo).filter((f) => !spente.has(f.id)), profilo)
  const lette = await assistenza.chiaviLette(attore, avvisi.map((a) => a.chiave))
  res.json({
    non_letti: avvisi.filter((a) => !lette.has(a.chiave)).length,
    avvisi: avvisi.map((a) => ({ ...a, letto: lette.has(a.chiave) })),
  })
}

export async function segnaLetti(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { chiavi } = valida(Letti, req.body)
  await servizio(req).segnaLette(attoreDi(req), chiavi)
  res.json({ ok: true })
}
