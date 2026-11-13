/*
 * Tipi della casella dei clienti (CRM): ogni canale traduce i propri messaggi in `InArrivo`, il modulo li conserva in
 * conversazioni con un'identità per canale.
 */

export type Canale = "telegram" | "email" | "sito" | "whatsapp" | "instagram" | "messenger"
export const CANALI: Canale[] = ["telegram", "email", "sito", "whatsapp", "instagram", "messenger"]

/** `aperta` tocca al team, `in_attesa` tocca al cliente, `chiusa` è conclusa (si riapre se il cliente riscrive). */
export type StatoConversazione = "aperta" | "in_attesa" | "chiusa"
export type Direzione = "entrata" | "uscita"
/**
 * `fallito`: certamente non partito (si può ritentare con lo stesso id); `incerto`: forse arrivato (Telegram non ha
 * risposto, il processo si è fermato durante l'invio): con lo stesso id non si rimanda da solo, per non mandarlo due volte.
 */
export type StatoConsegna = "ricevuto" | "in_coda" | "inviato" | "fallito" | "incerto"

/** Messaggio di un cliente già tradotto dal canale. */
export type InArrivo = {
  canale: Canale
  /** Account del negozio sul canale (per esempio lo username del bot): con più account le identità restano separate. */
  account: string
  /** Identificativo del contatto sul canale (chat Telegram, indirizzo email, ...). */
  id_contatto: string
  nome: string | null
  /** Email o telefono, solo se il canale li dà. */
  recapito: string | null
  /** Identificativo del messaggio sul canale, unico per l'account: un nuovo invio dello stesso messaggio non si registra due volte. */
  id_messaggio: string
  testo: string
  quando: Date
  oggetto?: string | null
}
