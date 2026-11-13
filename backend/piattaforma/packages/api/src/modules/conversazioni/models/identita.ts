import { model } from "@medusajs/framework/utils"
import { CANALI } from "../tipi"
import { Conversazione } from "./conversazione"

/**
 * Il contatto su un canale (chat Telegram, indirizzo email, ...), una riga per account del negozio. Si collega al cliente
 * del negozio solo quando è certo: un collegamento sbagliato mostrerebbe ordini e indirizzi di un'altra persona.
 */
export const Identita = model
  .define("identita_contatto", {
    id: model.id({ prefix: "idc" }).primaryKey(),
    canale: model.enum(CANALI),
    account: model.text(),
    id_contatto: model.text(),
    nome: model.text().nullable(),
    recapito: model.text().nullable(),
    cliente_id: model.text().nullable(),
    conversazioni: model.hasMany(() => Conversazione, { mappedBy: "identita" }),
  })
  .indexes([{ on: ["canale", "account", "id_contatto"], unique: true }, { on: ["cliente_id"] }])
