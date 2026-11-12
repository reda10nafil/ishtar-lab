import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import OutfitModule from "../modules/outfit"

/** Legame di sola lettura: `query.graph` risolve `capo_outfit.product` dal campo `product_id`, senza tabelle in più. */
export default defineLink(
  { linkable: OutfitModule.linkable.capoOutfit, field: "product_id" },
  ProductModule.linkable.product,
  { readOnly: true }
)
