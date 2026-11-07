import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { confirmProductsWorkflow, ProductWorkflowEvents } from "@mercurjs/core/workflows"
import { invalido, valida } from "../../../utili"
import { puo } from "../comune/permessi"

const Corpo = z.object({
  azione: z.enum(["pubblica", "bozza", "collezione"]),
  ids: z.array(z.string()).min(1, "Select at least one product").max(200, "Up to 200 products at a time"),
  collezione_id: z.string().nullish(),
})

type Riga = { id: string; status: string }

const idDi = (righe: Riga[]) => righe.map((r) => r.id)

async function imposta(req: AuthenticatedMedusaRequest, ids: string[], update: { status?: "draft" | "published"; collection_id?: string | null }) {
  if (ids.length) await updateProductsWorkflow(req.scope).run({ input: { selector: { id: ids }, update } })
}

/** Un prodotto proposto da un'azienda passa dall'approvazione; gli altri si pubblicano e basta. */
async function pubblica(req: AuthenticatedMedusaRequest, prodotti: Riga[]) {
  const proposti = idDi(prodotti.filter((p) => p.status === "proposed"))
  const liberi = idDi(prodotti.filter((p) => p.status === "draft" || p.status === "rejected"))
  const approvabili = puo(req, "products.review", "edit") ? proposti : []
  if (approvabili.length) {
    await confirmProductsWorkflow(req.scope).run({ input: { product_ids: approvabili, actor_id: req.auth_context.actor_id } })
  }
  await imposta(req, liberi, { status: "published" })
  if (liberi.length) {
    await req.scope.resolve(Modules.EVENT_BUS).emit({ name: ProductWorkflowEvents.PUBLISHED, data: liberi.map((id) => ({ id })) })
  }
  return approvabili.length + liberi.length
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { azione, ids, collezione_id } = valida(Corpo, req.body)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "status"], filters: { id: ids } })
  const prodotti = data as Riga[]

  let aggiornati = 0
  if (azione === "pubblica") aggiornati = await pubblica(req, prodotti)
  if (azione === "bozza") {
    const daCambiare = idDi(prodotti.filter((p) => p.status !== "draft"))
    await imposta(req, daCambiare, { status: "draft" })
    aggiornati = daCambiare.length
  }
  if (azione === "collezione") {
    if (collezione_id === undefined) throw invalido("Choose a collection")
    await imposta(req, idDi(prodotti), { collection_id: collezione_id })
    aggiornati = prodotti.length
  }
  res.json({ aggiornati, saltati: prodotti.length - aggiornati })
}
