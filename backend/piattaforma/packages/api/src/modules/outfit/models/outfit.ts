import { model } from "@medusajs/framework/utils"
import { CapoOutfit } from "./capo-outfit"

/** Un look composto da capi di una o più aziende. Gli importi sono in euro. */
export const Outfit = model
  .define("outfit", {
    id: model.id({ prefix: "outf" }).primaryKey(),
    nome: model.text().searchable(),
    descrizione: model.text().nullable(),
    stato: model.enum(["bozza", "pubblicato", "archiviato"]).default("bozza"),
    modalita_prezzo: model.enum(["somma", "fisso"]).default("somma"),
    prezzo_fisso: model.bigNumber().nullable(),
    sconto_a_carico: model.enum(["negozio", "aziende", "ripartito"]).default("negozio"),
    /** Percentuale dello sconto che resta al negozio quando la regola è «ripartito». */
    quota_negozio: model.number().default(100),
    pubblicato_il: model.dateTime().nullable(),
    capi: model.hasMany(() => CapoOutfit, { mappedBy: "outfit" }),
  })
  .cascades({ delete: ["capi"] })
