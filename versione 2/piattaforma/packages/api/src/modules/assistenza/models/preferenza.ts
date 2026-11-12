import { model } from "@medusajs/framework/utils"

/** Fonti di avviso spente da un account. Senza riga, sono tutte accese. */
export const Preferenza = model
  .define("preferenza_avvisi", {
    id: model.id({ prefix: "avp" }).primaryKey(),
    attore_tipo: model.text(),
    attore_id: model.text(),
    disattivate: model.json(),
  })
  .indexes([{ on: ["attore_tipo", "attore_id"], unique: true }])
