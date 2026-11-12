import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { linkSellersToProductWorkflow } from "@mercurjs/core/workflows"

/**
 * Lega alle rispettive aziende i prodotti già presenti, compreso il catalogo dimostrativo:
 * chi li ha creati, oppure chi ne ha offerte attive. Si può rieseguire senza effetti collaterali.
 */
export default async function prodottiEsclusivi({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: prodotti } = await query.graph({ entity: "product", fields: ["id"] })
  const { data: legami } = await query.graph({ entity: "product_seller", fields: ["product_id"] })
  const giaLegati = new Set(legami.map((l: { product_id: string }) => l.product_id))
  const daLegare = prodotti.map((p: { id: string }) => p.id).filter((id: string) => !giaLegati.has(id))

  const { data: azioni } = await query.graph({
    entity: "product_change_action",
    fields: ["product_id", "product_change.created_by"],
    filters: { product_id: daLegare, action: "PRODUCT_ADD" },
  })
  const { data: offerte } = await query.graph({
    entity: "offer",
    fields: ["seller_id", "product_id"],
    filters: { product_id: daLegare },
  })

  const aziende = new Map<string, Set<string>>()
  const aggiungi = (prodotto: string, azienda?: string | null) => {
    if (!azienda?.startsWith("sel_")) return
    aziende.set(prodotto, (aziende.get(prodotto) ?? new Set()).add(azienda))
  }
  for (const a of azioni) aggiungi(a.product_id, a.product_change?.created_by)
  for (const o of offerte) aggiungi(o.product_id, o.seller_id)

  for (const [id, gruppo] of aziende) {
    await linkSellersToProductWorkflow(container).run({ input: { id, add: [...gruppo] } })
  }
  logger.info(`Prodotti legati: ${aziende.size} su ${daLegare.length} da controllare`)
}
