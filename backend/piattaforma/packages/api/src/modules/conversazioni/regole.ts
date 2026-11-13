import { MedusaError } from "@medusajs/framework/utils"
import type { Direzione, InArrivo, StatoConsegna, StatoConversazione } from "./tipi"

/*
 * Regole della casella senza database (verificate in __tests__/regole.unit.spec.ts).
 */

/** Identificativo di una risposta generato dal pannello: lo stesso id, la stessa risposta (mai inviata due volte). */
export const ID_CLIENT = /^[A-Za-z0-9_-]{8,80}$/

/** Anteprima dell'ultimo messaggio nell'elenco delle conversazioni. */
export function estratto(testo: string, massimo = 140): string {
  // Per caratteri (code point), non per unità UTF-16: un'emoji non resta spezzata a metà.
  const caratteri = Array.from(testo.replace(/\s+/g, " ").trim())
  return caratteri.length > massimo ? `${caratteri.slice(0, massimo - 1).join("")}…` : caratteri.join("")
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

export type Decisione = "invia" | "gia_inviato" | "incerto"

/**
 * Risposta già vista con lo stesso id (doppio clic, nuovo tentativo), decisa sotto il lucchetto di quell'id. Si rimanda
 * solo ciò che certamente non è partito: mai fatta, fallita, oppure rimasta in coda prima del tentativo (il giro precedente
 * si è interrotto prima di chiamare il canale). Una rimasta in coda dopo il tentativo, o incerta, forse è arrivata: con lo
 * stesso id non si rimanda; chi vuole ripeterla manda una risposta nuova.
 */
export function decidiInvio(esistente: { stato_consegna: StatoConsegna; tentato_il?: Date | string | null } | null): Decisione {
  if (!esistente || esistente.stato_consegna === "fallito") return "invia"
  if (esistente.stato_consegna === "inviato") return "gia_inviato"
  if (esistente.stato_consegna === "in_coda" && !esistente.tentato_il) return "invia"
  return "incerto"
}

/** Una risposta non consegnata lascia la conversazione al team: nell'elenco non deve sembrare già risposta. */
export const statoDopoFallimento = (stato: StatoConversazione): StatoConversazione => (stato === "chiusa" ? "chiusa" : "aperta")
