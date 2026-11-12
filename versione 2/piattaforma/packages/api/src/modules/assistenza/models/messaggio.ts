import { model } from "@medusajs/framework/utils"
import { Richiesta } from "./richiesta"

/** Un messaggio del dialogo. `da_staff` distingue l'amministrazione da chi ha aperto la richiesta. */
export const Messaggio = model.define("messaggio_assistenza", {
  id: model.id({ prefix: "rmsg" }).primaryKey(),
  richiesta: model.belongsTo(() => Richiesta, { mappedBy: "messaggi" }),
  da_staff: model.boolean(),
  autore_id: model.text(),
  autore_nome: model.text(),
  testo: model.text(),
})
