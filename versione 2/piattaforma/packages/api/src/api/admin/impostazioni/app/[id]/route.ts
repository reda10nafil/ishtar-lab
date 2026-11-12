import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { CONNECTORS_MODULE } from "../../../../../modules/connectors"
import type ConnectorsModuleService from "../../../../../modules/connectors/service"
import { invalido, valida } from "../../../../utili"
import { impostazioniDi, leggiStore, metadatiCon } from "../../lettura"
import { trovaApp } from "../catalogo"
import { vistaApp } from "../route"

const Cambio = z.object({
  installata: z.boolean({ error: "Invalid value" }).optional(),
  attiva: z.boolean({ error: "Invalid value" }).optional(),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { installata, attiva } = valida(Cambio, req.body)
  const { id } = req.params
  const demo = trovaApp(id)
  if (!demo) {
    const connettori = await req.scope.resolve<ConnectorsModuleService>(CONNECTORS_MODULE).elenco()
    if (!connettori.some((c) => c.id === id)) throw new MedusaError(MedusaError.Types.NOT_FOUND, "App not found")
    if (installata !== undefined) throw invalido("Connect or disconnect this service from its own window")
  }

  const store = await leggiStore(req.scope)
  const { app } = impostazioniDi(store)
  const attuale = app[id] ?? { installata: Boolean(demo?.predefinita), attiva: demo?.predefinita?.attiva ?? true }
  // Installare accende l'app; disinstallarla la spegne.
  const prossimo = {
    installata: installata ?? attuale.installata,
    attiva: installata === undefined ? attiva ?? attuale.attiva : attiva ?? installata,
  }
  const aggiornato = await updateStoresWorkflow(req.scope).run({
    input: { selector: { id: store.id }, update: { metadata: metadatiCon(store, { app: { ...app, [id]: prossimo } }) } },
  })
  res.json(vistaApp({ ...store, metadata: aggiornato.result[0].metadata as Record<string, unknown> | null }))
}
