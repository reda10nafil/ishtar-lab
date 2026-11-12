import { model } from "@medusajs/framework/utils"

/** Un avviso già letto da un account. Gli avvisi sono calcolati: qui si salva solo la lettura. */
export const Lettura = model
  .define("avviso_letto", {
    id: model.id({ prefix: "avl" }).primaryKey(),
    attore_tipo: model.text(),
    attore_id: model.text(),
    chiave: model.text(),
  })
  .indexes([{ on: ["attore_tipo", "attore_id", "chiave"], unique: true }])
