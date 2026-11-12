import { model } from "@medusajs/framework/utils"

/** Una regola automatica. `chiave` è fissa: le regole esistono nel codice, qui c'è il loro stato. */
export const Automazione = model.define("automazione_marketing", {
  id: model.id({ prefix: "auto" }).primaryKey(),
  chiave: model.text().unique(),
  attiva: model.boolean().default(false),
  oggetto: model.text(),
  testo: model.text(),
})
