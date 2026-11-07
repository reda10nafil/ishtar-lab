import { model } from "@medusajs/framework/utils"
import { MovimentoCarta } from "./movimento-carta"

/** Una carta regalo con il suo saldo. L'uso al checkout non esiste ancora: il saldo cambia solo dal pannello. */
export const CartaRegalo = model
  .define("carta_regalo", {
    id: model.id({ prefix: "creg" }).primaryKey(),
    codice: model.text().searchable().unique(),
    importo_iniziale: model.bigNumber(),
    saldo: model.bigNumber(),
    valuta: model.text().default("eur"),
    scadenza: model.dateTime().nullable(),
    stato: model.enum(["attiva", "annullata"]).default("attiva"),
    destinatario_nome: model.text().searchable().nullable(),
    destinatario_email: model.text().searchable().nullable(),
    nota: model.text().nullable(),
    annullata_il: model.dateTime().nullable(),
    motivo_annullamento: model.text().nullable(),
    movimenti: model.hasMany(() => MovimentoCarta, { mappedBy: "carta" }),
  })
  .cascades({ delete: ["movimenti"] })
