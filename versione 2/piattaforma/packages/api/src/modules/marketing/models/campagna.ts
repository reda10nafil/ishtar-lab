import { model } from "@medusajs/framework/utils"

/**
 * Un invio a più clienti. `pubblico` vale `tutti`, `segmento:<chiave>` o `gruppo:<id>`.
 * I conteggi si aggiornano dalle consegne vere, mai da stime.
 */
export const Campagna = model
  .define("campagna_marketing", {
    id: model.id({ prefix: "camp" }).primaryKey(),
    nome: model.text().searchable(),
    canale: model.enum(["email"]).default("email"),
    oggetto: model.text(),
    testo: model.text(),
    pubblico: model.text().default("tutti"),
    stato: model.enum(["bozza", "programmata", "in_invio", "inviata", "fallita"]).default("bozza"),
    programmata_il: model.dateTime().nullable(),
    avviata_il: model.dateTime().nullable(),
    conclusa_il: model.dateTime().nullable(),
    destinatari: model.number().default(0),
    inviati: model.number().default(0),
    falliti: model.number().default(0),
  })
  .indexes([{ on: ["stato"] }])
