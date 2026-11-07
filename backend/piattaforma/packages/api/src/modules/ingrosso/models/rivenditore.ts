import { model } from "@medusajs/framework/utils"
import { Trattativa } from "./trattativa"

/** Un cliente all'ingrosso con contatti e condizioni commerciali. */
export const Rivenditore = model.define("rivenditore", {
  id: model.id({ prefix: "riv" }).primaryKey(),
  nome: model.text().searchable(),
  referente: model.text().searchable().nullable(),
  email: model.text().searchable().nullable(),
  telefono: model.text().nullable(),
  partita_iva: model.text().nullable(),
  indirizzo: model.text().nullable(),
  citta: model.text().nullable(),
  cap: model.text().nullable(),
  paese: model.text().default("it"),
  condizione: model.enum(["listino", "sconto"]).default("sconto"),
  listino: model.text().nullable(),
  sconto_percentuale: model.bigNumber().nullable(),
  pagamento: model.text().nullable(),
  ordine_minimo: model.bigNumber().nullable(),
  appunti: model.text().nullable(),
  trattative: model.hasMany(() => Trattativa, { mappedBy: "rivenditore" }),
})
