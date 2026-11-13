import { model } from "@medusajs/framework/utils"
import { Conversazione } from "./conversazione"

/**
 * Un messaggio della conversazione. `chiave_unica` è unica in tutta la tabella: per quelli in arrivo viene dal canale
 * (lo stesso messaggio letto due volte non si registra due volte), per le risposte dall'id mandato dal pannello (la
 * stessa risposta non parte due volte).
 */
export const Messaggio = model
  .define("messaggio_cliente", {
    id: model.id({ prefix: "msgc" }).primaryKey(),
    conversazione: model.belongsTo(() => Conversazione, { mappedBy: "messaggi" }),
    direzione: model.enum(["entrata", "uscita"]),
    testo: model.text(),
    quando: model.dateTime(),
    chiave_unica: model.text(),
    id_esterno: model.text().nullable(),
    stato_consegna: model.enum(["ricevuto", "in_coda", "inviato", "fallito"]),
    errore: model.text().nullable(),
    autore_id: model.text().nullable(),
    autore_nome: model.text().nullable(),
  })
  .indexes([{ on: ["chiave_unica"], unique: true }])
