import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getSellerOwnedProductIds } from "@mercurjs/core/api/vendor/products/helpers"

/** Prodotti dell'azienda: quelli che ha creato e quelli legati a lei. Mai il resto del catalogo. */
export async function prodottiAzienda(scope: MedusaContainer, aziendaId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const [creati, { data }] = await Promise.all([
    getSellerOwnedProductIds(scope, aziendaId),
    query.graph({ entity: "product_seller", fields: ["product_id"], filters: { seller_id: aziendaId } }),
  ])
  return [...new Set([...creati, ...(data as { product_id: string }[]).map((l) => l.product_id)])]
}
