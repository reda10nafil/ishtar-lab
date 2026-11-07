import { model } from "@medusajs/framework/utils"

/**
 * Discount proposed da un'azienda: resta fuori dal negozio finché l'amministratore non lo approva.
 * Vive qui perché `medusa-config.ts` attiva solo i moduli di sezione previsti, e `sconti` non è fra questi.
 * `prodotti` vuoto significa tutti i prodotti dell'azienda al momento dell'approvazione.
 */
export const PropostaSconto = model
  .define("proposta_sconto", {
    id: model.id({ prefix: "psc" }).primaryKey(),
    azienda_id: model.text(),
    titolo: model.text().searchable(),
    tipo: model.enum(["percentuale", "importo"]),
    valore: model.bigNumber(),
    inizio: model.dateTime(),
    fine: model.dateTime(),
    motivo: model.text(),
    prodotti: model.array().nullable(),
    stato: model.enum(["in_attesa", "approvata", "rifiutata"]).default("in_attesa"),
    nota: model.text().nullable(),
    deciso_da: model.text().nullable(),
    deciso_il: model.dateTime().nullable(),
    promozione_id: model.text().nullable(),
    codice: model.text().nullable(),
  })
  .indexes([{ on: ["azienda_id"] }, { on: ["stato"] }])
