import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PERMESSI_MODULE } from "../../../../modules/permessi"
import { descriviAzione } from "../../../../modules/permessi/azioni"
import type PermessiModuleService from "../../../../modules/permessi/service"

const QUANTE = 5
const LETTE = 60

/** Ogni voce porta alla sezione dove è successa: il percorso sta nel registro. */
const DESTINAZIONI: [RegExp, string][] = [
  [/\/(ordini|orders|draft-orders|evasioni)/, "/ordini/tutti"],
  [/\/marketing/, "/marketing"],
  [/\/ingrosso/, "/ingrosso"],
  [/\/magazzino/, "/magazzino"],
  [/\/cassa/, "/cassa"],
  [/\/clienti/, "/clienti"],
  [/\/(sconti|carte-regalo)/, "/sconti"],
  [/\/outfit/, "/outfit"],
  [/\/(catalogo|products|collections|product-changes)/, "/prodotti"],
  [/\/(team|sellers)/, "/team"],
  [/\/assistenza/, "/assistenza"],
  [/\/impostazioni/, "/impostazioni"],
]

const destinazione = (percorso: string) => DESTINAZIONI.find(([regola]) => regola.test(percorso))?.[1] ?? null

/** Le ultime cose fatte nel pannello, solo quelle riuscite. */
export async function leggiAttivita(scope: MedusaContainer) {
  const permessi = scope.resolve<PermessiModuleService>(PERMESSI_MODULE)
  const voci = await permessi.listRegistraziones({}, { order: { created_at: "DESC" }, take: LETTE })
  const riuscite = voci.filter((v) => v.esito < 400)
  const ids = (tipo: string) => [...new Set(riuscite.filter((v) => v.attore_tipo === tipo).map((v) => String(v.attore_id)))]
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: utenti }, { data: membri }] = await Promise.all([
    query.graph({ entity: "user", fields: ["id", "email", "first_name"], filters: { id: ids("user") } }),
    query.graph({ entity: "member", fields: ["id", "email"], filters: { id: ids("member") } }),
  ])
  const nomi = new Map<string, string>([...utenti, ...membri].map((p) => [p.id, (p as { first_name?: string | null }).first_name || p.email.split("@")[0].replace(/[._-]+/g, " ")]))
  const oggi = new Date().toDateString()
  return {
    persone_oggi: new Set(riuscite.filter((v) => new Date(v.created_at).toDateString() === oggi).map((v) => v.attore_id)).size,
    voci: riuscite.slice(0, QUANTE).map((v) => ({
      id: v.id,
      quando: v.created_at,
      chi: nomi.get(v.attore_id) ?? "Removed account",
      azione: descriviAzione(v.metodo, v.percorso, v.esito),
      a: destinazione(v.percorso),
    })),
  }
}
