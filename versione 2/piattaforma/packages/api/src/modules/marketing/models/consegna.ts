import { model } from "@medusajs/framework/utils"

/**
 * Un tentativo di invio a un cliente. `origine` è `campagna:<id>` o `automazione:<chiave>`.
 * L'indice unico impedisce il doppio invio se un lavoro riparte a metà.
 */
export const Consegna = model
  .define("consegna_marketing", {
    id: model.id({ prefix: "cons" }).primaryKey(),
    origine: model.text(),
    cliente_id: model.text(),
    email: model.text(),
    stato: model.enum(["inviato", "fallito"]),
    errore: model.text().nullable(),
    inviata_il: model.dateTime(),
  })
  .indexes([{ on: ["origine", "cliente_id"], unique: true }, { on: ["origine"] }])
