import { model } from "@medusajs/framework/utils"

/**
 * Punto di lettura di un canale con identificativi stabili (IMAP: UIDVALIDITY e ultimo UID registrato di una cartella).
 * Telegram non lo usa: dopo una settimana di silenzio ricomincia gli identificativi. Valori come testo: gli UID IMAP
 * arrivano a 2^32−1, oltre l'intero del database, e UIDVALIDITY in imapflow è un BigInt.
 */
export const Cursore = model
  .define("cursore_canale", {
    id: model.id({ prefix: "curs" }).primaryKey(),
    canale: model.text(),
    account: model.text(),
    cartella: model.text(),
    uidvalidity: model.text(),
    ultimo_uid: model.text(),
  })
  .indexes([{ on: ["canale", "account", "cartella"], unique: true }])
