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

/** Id della risposta mandato dal pannello (dalla chiave unica «uscita:<id>»); per sicurezza l'id del messaggio. */
export const idClientUscita = (m: { id: string; chiave_unica?: string | null }) =>
  m.chiave_unica?.startsWith("uscita:") ? m.chiave_unica.slice("uscita:".length) : m.id

/** Dopo il tentativo si aspetta questo tempo prima di dire che una risposta non ritrovata non è arrivata. */
export const ATTESA_RILETTURA_MS = 2 * 60_000

/**
 * Canali che ritrovano una risposta dal suo id (la chat del sito): una risposta forse arrivata (incerta, oppure rimasta in
 * coda dopo il tentativo) ritrovata è «inviato»; non ritrovata due minuti dopo il tentativo è «fallito», e lì un nuovo
 * tentativo con lo stesso id non può duplicarla (il canale la scrive una volta sola per id). Prima si aspetta: la
 * richiesta potrebbe essere ancora in viaggio. null: niente da cambiare.
 */
export function regolaRileggibile(
  stato: StatoConsegna,
  tentato_il: Date | string | null | undefined,
  trovata: boolean,
  adesso: Date
): "inviato" | "fallito" | null {
  if (stato !== "incerto" && !(stato === "in_coda" && tentato_il)) return null
  if (trovata) return "inviato"
  const quando = tentato_il ? new Date(tentato_il).getTime() : Number.NaN
  return Number.isNaN(quando) || adesso.getTime() - quando >= ATTESA_RILETTURA_MS ? "fallito" : null
}

/**
 * Risposta che la riconciliazione dà per non arrivata: arriva minuti dopo, quando il team è passato ad altro. Come un
 * rimbalzo, la conversazione torna al team anche se chiusa, con un segno da leggere (si toglie aprendola).
 */
// Lo stato di prima non conta: aperta, in attesa o chiusa, torna aperta.
export const conversazioneDopoNonArrivata = (c: { stato?: string; non_letti: number }) => ({ stato: "aperta" as const, non_letti: c.non_letti + 1 })

/**
 * Risposta ritrovata dalla riconciliazione: la conversazione torna in attesa del cliente solo se era rimessa al team per il
 * dubbio su questa risposta (aperta, nulla da leggere, nessun messaggio del cliente dopo) e la risposta è l'ultima del
 * team: una successiva incerta o fallita la tiene al team.
 */
export function tornaInAttesa(c: { stato: string; non_letti: number }, nuoviDopo: number, ultimaUscitaId: string | null, rispostaId: string): boolean {
  return c.stato === "aperta" && c.non_letti === 0 && nuoviDopo === 0 && ultimaUscitaId === rispostaId
}

/** Una risposta non consegnata lascia la conversazione al team: nell'elenco non deve sembrare già risposta. */
export const statoDopoFallimento = (stato: StatoConversazione): StatoConversazione => (stato === "chiusa" ? "chiusa" : "aperta")

/**
 * Ordine dei messaggi di una conversazione: quello di arrivo nella casella, lo stesso con cui si contano i messaggi nuovi.
 * Un messaggio del cliente registrato in ritardo (data Telegram più vecchia di una risposta già partita) compare in fondo,
 * dopo l'ultimo messaggio che il team aveva davanti, e resta da leggere: non finisce sopra, già «visto».
 */
export const ORDINE_MESSAGGI = { created_at: "DESC", id: "DESC" } as const

/** Messaggi del cliente dopo `visto` nell'ordine della conversazione (arrivati dopo, o nello stesso istante con id successivo). */
export function filtroNuoviDopo(conversazione_id: string, visto: { id: string; created_at: Date | string } | null) {
  const base = { conversazione_id, direzione: "entrata" as const }
  if (!visto) return base
  const quando = new Date(visto.created_at)
  return { ...base, $or: [{ created_at: { $gt: quando } }, { created_at: quando, id: { $gt: visto.id } }] }
}

