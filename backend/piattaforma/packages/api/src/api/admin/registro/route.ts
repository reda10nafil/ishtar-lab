import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PERMESSI_MODULE } from "../../../modules/permessi"
import { descriviAzione } from "../../../modules/permessi/azioni"
import type PermessiModuleService from "../../../modules/permessi/service"
import { interroga } from "../../utili"

const PER_PAGINA = 100

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const permessi = req.scope.resolve<PermessiModuleService>(PERMESSI_MODULE)
  const voci = await permessi.listRegistraziones({}, { order: { created_at: "DESC" }, take: PER_PAGINA })
  const query = interroga(req)
  const idDi = (tipo: string): string[] => [...new Set(voci.filter((v) => v.attore_tipo === tipo).map((v) => String(v.attore_id)))]
  const aziendeId = [...new Set(voci.map((v) => v.azienda_id).filter(Boolean))] as string[]
  const [{ data: utenti }, { data: membri }, { data: aziende }] = await Promise.all([
    query.graph({ entity: "user", fields: ["id", "email"], filters: { id: idDi("user") } }),
    query.graph({ entity: "member", fields: ["id", "email"], filters: { id: idDi("member") } }),
    query.graph({ entity: "seller", fields: ["id", "name"], filters: { id: aziendeId } }),
  ])
  const nomi = new Map<string, string>([...utenti, ...membri].map((p) => [p.id, p.email]))
  const nomiAzienda = new Map<string, string>(aziende.map((a) => [a.id, a.name]))
  res.json({
    voci: voci.map((v) => ({
      id: v.id,
      quando: v.created_at,
      chi: nomi.get(v.attore_id) ?? "Removed account",
      azienda: v.azienda_id ? nomiAzienda.get(v.azienda_id) ?? null : null,
      azione: descriviAzione(v.metodo, v.percorso, v.esito),
      esito: v.esito,
    })),
  })
}
