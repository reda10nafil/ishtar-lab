import { model } from "@medusajs/framework/utils"

/** Una modifica fatta da una persona. Non contiene il corpo della richiesta. */
export const VoceRegistro = model.define("voce_registro", {
  id: model.id({ prefix: "reg" }).primaryKey(),
  attore_tipo: model.text(),
  attore_id: model.text(),
  azienda_id: model.text().nullable(),
  metodo: model.text(),
  percorso: model.text(),
  esito: model.number(),
})
