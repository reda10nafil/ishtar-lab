import { model } from "@medusajs/framework/utils"
import { Outfit } from "./outfit"

/**
 * Un capo dell'outfit: un prodotto venduto da un'azienda, con il suo posto sulla tela.
 * Le varianti non si copiano qui: taglie, prezzi e scorte si leggono dalle offerte vere.
 * x, y e larghezza sono percentuali della tela, così la composizione vale a ogni dimensione.
 */
export const CapoOutfit = model
  .define("capo_outfit", {
    id: model.id({ prefix: "capo" }).primaryKey(),
    outfit: model.belongsTo(() => Outfit, { mappedBy: "capi" }),
    product_id: model.text(),
    azienda_id: model.text(),
    alternativa_product_id: model.text().nullable(),
    alternativa_azienda_id: model.text().nullable(),
    x: model.float().default(0),
    y: model.float().default(0),
    larghezza: model.float().default(40),
    livello: model.number().default(1),
  })
  .indexes([{ on: ["product_id"] }, { on: ["azienda_id"] }, { on: ["alternativa_azienda_id"] }])
