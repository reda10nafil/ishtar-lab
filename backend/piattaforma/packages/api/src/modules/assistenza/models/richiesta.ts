import { model } from "@medusajs/framework/utils"
import { Messaggio } from "./messaggio"

/**
 * Una richiesta di aiuto. `azienda_id` è vuoto per quelle aperte da un collaboratore.
 * Stati: `aperta` tocca allo staff, `in_attesa` tocca a chi l'ha aperta, `chiusa` è conclusa.
 */
export const Richiesta = model
  .define("richiesta_assistenza", {
    id: model.id({ prefix: "ric" }).primaryKey(),
    oggetto: model.text(),
    categoria: model.text(),
    stato: model.enum(["aperta", "in_attesa", "chiusa"]).default("aperta"),
    azienda_id: model.text().nullable(),
    autore_id: model.text(),
    autore_nome: model.text(),
    ultimo_messaggio_il: model.dateTime(),
    messaggi: model.hasMany(() => Messaggio, { mappedBy: "richiesta" }),
  })
  .indexes([{ on: ["azienda_id"] }, { on: ["stato"] }])
  .cascades({ delete: ["messaggi"] })
