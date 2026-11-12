import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { productEditDeleteProductWorkflow } from "@mercurjs/core/workflows"
import { leggiOfferte, rimuoviOfferte } from "../../comune/offerte"
import { assente, vedeMargini } from "../../comune/permessi"
import { leggiScheda, schedaPerAdmin } from "../../comune/prodotti"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const scheda = await leggiScheda(req.scope, req.params.id)
  if (!scheda) throw assente("Product")
  res.json({ prodotto: schedaPerAdmin(scheda, vedeMargini(req)) })
}

/** Elimina prodotto, offerte e voci di magazzino: l'eliminazione nativa lascerebbe le voci orfane. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const id = req.params.id
  const scheda = await leggiScheda(req.scope, id)
  if (!scheda) throw assente("Product")
  await rimuoviOfferte(req.scope, await leggiOfferte(req.scope, { product_id: id }))
  await productEditDeleteProductWorkflow(req.scope).run({ input: { product_id: id, created_by: req.auth_context.actor_id, auto_confirm: true } })
  res.json({ id, eliminato: true })
}
