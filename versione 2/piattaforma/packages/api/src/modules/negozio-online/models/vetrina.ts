import { model } from "@medusajs/framework/utils"

/** Aspetto del negozio online: una sola riga. Finché il sito pubblico non esiste non va online. */
export const Vetrina = model.define("vetrina_negozio", {
  id: model.id({ prefix: "vetr" }).primaryKey(),
  testata: model.text().default("Ishtar Lab"),
  annuncio: model.text().default(""),
  accento: model.enum(["rosa", "mare", "sabbia"]).default("rosa"),
  messaggio: model.text().default(""),
})
