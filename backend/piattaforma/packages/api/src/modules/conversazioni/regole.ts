import { MedusaError } from "@medusajs/framework/utils"
import type { Direzione, InArrivo, StatoConsegna, StatoConversazione } from "./tipi"

/*
 * Regole della casella senza database (verificate in __tests__/regole.unit.spec.ts).
 */

/** Identificativo di una risposta generato dal pannello: lo stesso id, la stessa risposta (mai inviata due volte). */
export const ID_CLIENT = /^[A-Za-z0-9_-]{8,80}$/

/** Anteprima dell'ultimo messaggio nell'elenco delle conversazioni. */
export function estratto(testo: string, massimo = 140): string {
  const pulito = testo.replace(/\s+/g, " ").trim()
  return pulito.length > massimo ? `${pulito.slice(0, massimo - 1)}…` : pulito
}

export const chiaveInArrivo = ({ canale, account, id_messaggio }: Pick<InArrivo, "canale" | "account" | "id_messaggio">) =>
  `${canale}:${account}:${id_messaggio}`

export const chiaveUscita = (id_client: string) => `uscita:${id_client}`

/** Un messaggio del cliente riapre la conversazione (anche chiusa); una risposta del team passa la palla al cliente. */
export function statoDopo(stato: StatoConversazione, direzione: Direzione): StatoConversazione {
  if (direzione === "entrata") return "aperta"
  if (stato === "chiusa") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This conversation is closed: reopen it to reply")
  return "in_attesa"
}

/** Si manda solo una risposta mai partita o fallita; una in coda è già in partenza (doppio clic, nuovo tentativo). */
export function decidiInvio(esistente: { stato_consegna: StatoConsegna } | null): "invia" | "gia_inviato" | "in_corso" {
  if (!esistente || esistente.stato_consegna === "fallito") return "invia"
  return esistente.stato_consegna === "inviato" ? "gia_inviato" : "in_corso"
}
