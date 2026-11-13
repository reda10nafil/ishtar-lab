import { model } from "@medusajs/framework/utils"
import { CANALI } from "../tipi"
import { Identita } from "./identita"
import { Messaggio } from "./messaggio"

/** Il dialogo con un contatto: stati come l'assistenza, più anteprima e messaggi non letti per l'elenco della casella. */
export const Conversazione = model
  .define("conversazione_cliente", {
    id: model.id({ prefix: "conv" }).primaryKey(),
    canale: model.enum(CANALI),
    identita: model.belongsTo(() => Identita, { mappedBy: "conversazioni" }),
    stato: model.enum(["aperta", "in_attesa", "chiusa"]).default("aperta"),
    oggetto: model.text().nullable(),
    ultimo_messaggio_il: model.dateTime(),
    ultimo_estratto: model.text(),
    non_letti: model.number().default(0),
    messaggi: model.hasMany(() => Messaggio, { mappedBy: "conversazione" }),
  })
  .indexes([{ on: ["stato"] }, { on: ["ultimo_messaggio_il"] }])
  .cascades({ delete: ["messaggi"] })
