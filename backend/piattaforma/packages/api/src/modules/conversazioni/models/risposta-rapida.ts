import { model } from "@medusajs/framework/utils"

/** Testo pronto da inserire nella risposta con un clic (i pulsanti sopra il campo di risposta). */
export const RispostaRapida = model.define("risposta_rapida", {
  id: model.id({ prefix: "rrap" }).primaryKey(),
  titolo: model.text(),
  testo: model.text(),
})
