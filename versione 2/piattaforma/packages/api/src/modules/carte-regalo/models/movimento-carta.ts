import { model } from "@medusajs/framework/utils"
import { CartaRegalo } from "./carta-regalo"

/** Ogni variazione del saldo: l'importo è positivo se aggiunge, negativo se toglie. */
export const MovimentoCarta = model.define("movimento_carta", {
  id: model.id({ prefix: "cmov" }).primaryKey(),
  tipo: model.enum(["emissione", "rettifica", "annullamento"]),
  importo: model.bigNumber(),
  saldo_dopo: model.bigNumber(),
  nota: model.text().nullable(),
  attore: model.text(),
  carta: model.belongsTo(() => CartaRegalo, { mappedBy: "movimenti" }),
})
