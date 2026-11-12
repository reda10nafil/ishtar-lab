import { model } from "@medusajs/framework/utils"
import { FASI } from "../fasi"
import { NotaTrattativa } from "./nota-trattativa"
import { Rivenditore } from "./rivenditore"

/** Una carta della bacheca. Il valore stimato è inserito dall'utente, non calcolato. */
export const Trattativa = model
  .define("trattativa", {
    id: model.id({ prefix: "trat" }).primaryKey(),
    titolo: model.text().searchable(),
    fase: model.enum([...FASI]).default("richiesta"),
    posizione: model.number().default(0),
    unita: model.number().nullable(),
    valore_stimato: model.bigNumber().nullable(),
    ordine_id: model.text().nullable(),
    spostata_il: model.dateTime().nullable(),
    rivenditore: model.belongsTo(() => Rivenditore, { mappedBy: "trattative" }),
    note: model.hasMany(() => NotaTrattativa, { mappedBy: "trattativa" }),
  })
  .cascades({ delete: ["note"] })
