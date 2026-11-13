import { model } from "@medusajs/framework/utils"
import { CANALI } from "../tipi"

/** Fin dove un canale letto a intervalli è già stato letto (per Telegram il prossimo update_id). */
export const Cursore = model
  .define("cursore_canale", {
    id: model.id({ prefix: "cur" }).primaryKey(),
    canale: model.enum(CANALI),
    account: model.text(),
    valore: model.text(),
  })
  .indexes([{ on: ["canale", "account"], unique: true }])
