import { model } from "@medusajs/framework/utils"

/** Una pagina del negozio online. Nascosta, resta salvata ma esce dal menu. */
export const PaginaNegozio = model.define("pagina_negozio", {
  id: model.id({ prefix: "pagn" }).primaryKey(),
  titolo: model.text().searchable(),
  percorso: model.text().unique(),
  testo: model.text().default(""),
  visibile: model.boolean().default(true),
})
