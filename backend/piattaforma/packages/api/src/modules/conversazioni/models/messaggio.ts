import { model } from "@medusajs/framework/utils"
import { Conversazione } from "./conversazione"

/**
 * Un messaggio della conversazione. `chiave_unica` è unica in tutta la tabella: per quelli in arrivo viene dal canale
 * (lo stesso messaggio letto due volte non si registra due volte), per le risposte dall'id mandato dal pannello (la
 * stessa risposta non parte due volte). Stati delle risposte: `in_coda`, `inviato`, `fallito` (certamente non partita,
 * si può ritentare), `incerto` (forse arrivata: con lo stesso id non si rimanda).
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
    stato_consegna: model.enum(["ricevuto", "in_coda", "inviato", "fallito", "incerto"]),
    /** Momento in cui si è chiamato il canale: una risposta rimasta in coda dopo questo punto forse è arrivata. */
    tentato_il: model.dateTime().nullable(),
    errore: model.text().nullable(),
    autore_id: model.text().nullable(),
    autore_nome: model.text().nullable(),
    /**
     * Dati del canale che servono alla casella, per le email: Message-ID, In-Reply-To, References, oggetto, Reply-To,
     * verifica del mittente, allegati, testo intero con le citazioni. Per le risposte: le intestazioni con cui sono partite.
     */
    dettagli: model.json().nullable(),
  })
  .indexes([{ on: ["chiave_unica"], unique: true }])
