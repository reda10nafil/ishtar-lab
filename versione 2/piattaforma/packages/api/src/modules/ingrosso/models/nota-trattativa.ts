import { model } from "@medusajs/framework/utils"
import { Trattativa } from "./trattativa"

export const NotaTrattativa = model.define("nota_trattativa", {
  id: model.id({ prefix: "ntr" }).primaryKey(),
  testo: model.text(),
  autore: model.text(),
  trattativa: model.belongsTo(() => Trattativa, { mappedBy: "note" }),
})
