import { baseTelegram } from "../../connectors/catalogo"
import type { InArrivo } from "../tipi"

/*
 * Canale Telegram (Bot API): traduce i messaggi dei clienti in `InArrivo`, legge gli aggiornamenti e manda le risposte.
 * Verificato in __tests__/telegram.unit.spec.ts. Il token del bot sta nell'indirizzo di ogni chiamata: gli errori hanno
 * testi fissi e non riportano mai l'indirizzo.
 */

export { baseTelegram }

export type CodiceErrore = "credenziali" | "webhook" | "conflitto" | "limite" | "bloccato" | "richiesta" | "servizio" | "rete"

export class ErroreCanale extends Error {
  constructor(public codice: CodiceErrore, messaggio: string) {
    super(messaggio)
    this.name = "ErroreCanale"
  }
}

export type AggiornamentoTelegram = { update_id: number; [chiave: string]: unknown }

/**
 * Contenuti che un cliente manda: un segnaposto dice al team che c'è un allegato (prima della didascalia, se c'è). Tutto
 * il resto (messaggi fissati, timer, permessi e gli altri messaggi di servizio) non è un messaggio del cliente.
 */
const SEGNAPOSTI: [chiave: string, testo: string][] = [
  ["photo", "[Photo]"], ["video", "[Video]"], ["animation", "[GIF]"], ["video_note", "[Video message]"], ["voice", "[Voice message]"],
  ["audio", "[Audio]"], ["document", "[Document]"], ["sticker", "[Sticker]"], ["contact", "[Contact]"], ["venue", "[Location]"],
  ["location", "[Location]"], ["poll", "[Poll]"],
]

type MessaggioTelegram = {
  message_id: number
  date: number
  chat?: { id: number | string; type?: string }
  from?: { is_bot?: boolean; first_name?: string; last_name?: string; username?: string }
  text?: string
  caption?: string
  [chiave: string]: unknown
}

/** Solo messaggi nuovi di chat private con persone: gruppi, bot e messaggi modificati non entrano nella casella. */
export function normalizzaAggiornamento(u: unknown, account: string): InArrivo | null {
  const m = (u as { message?: MessaggioTelegram } | null)?.message
  if (!m?.chat || m.chat.type !== "private" || m.from?.is_bot) return null
  const nome = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ") || m.from?.username || null
  const segnaposto = SEGNAPOSTI.find(([chiave]) => m[chiave])?.[1]
  const testo = m.text || [segnaposto, m.caption].filter(Boolean).join(" ")
  if (!testo) return null
  return {
    canale: "telegram",
    account,
    id_contatto: String(m.chat.id),
    nome,
    recapito: null,
    id_messaggio: `${m.chat.id}:${m.message_id}`,
    testo,
    quando: new Date(m.date * 1000),
  }
}

function erroreDa(stato: number, descrizione: string | null): ErroreCanale {
  if (stato === 401 || stato === 404) return new ErroreCanale("credenziali", "Telegram refused the bot token")
  if (stato === 403) return new ErroreCanale("bloccato", "The customer blocked the bot or never started it")
  if (stato === 409 && /webhook/i.test(descrizione ?? "")) return new ErroreCanale("webhook", "A webhook is set on this bot: remove it to read messages here")
  if (stato === 409) return new ErroreCanale("conflitto", "Another program is reading this bot's messages: use this bot only for the shop inbox")
  if (stato === 429) return new ErroreCanale("limite", "Telegram is limiting requests: try again shortly")
  if (stato >= 400 && stato < 500) return new ErroreCanale("richiesta", `Telegram refused the message${descrizione ? `: ${descrizione}` : ""}`)
  return new ErroreCanale("servizio", `Telegram is not responding (error ${stato})`)
}

export function clientTelegram(token: string, chiama: typeof fetch = fetch) {
  // La descrizione di Telegram si mostra al team: per prudenza senza il token, anche se Telegram non lo ripete.
  const pulisci = (testo: string) => testo.split(token).join("[token]")

  async function metodo<T>(nome: string, corpo: Record<string, unknown>, attesa = 0): Promise<T> {
    let risposta: Response
    try {
      risposta = await chiama(`${baseTelegram()}/bot${token}/${nome}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
        redirect: "error",
        signal: AbortSignal.timeout((attesa + 10) * 1000),
      })
    } catch {
      throw new ErroreCanale("rete", "Telegram can't be reached")
    }
    const dati = (await risposta.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null
    if (risposta.ok && dati?.ok) return dati.result as T
    throw erroreDa(risposta.status, typeof dati?.description === "string" ? pulisci(dati.description) : null)
  }

  return {
    /** Username del bot. */
    account: async () => (await metodo<{ username?: string }>("getMe", {})).username ?? "",
    /** Aggiornamenti dal cursore `offset` (null: dall'inizio), aspettando fino ad `attesa` secondi (long polling). */
    leggi: (offset: number | null, attesa: number) =>
      metodo<AggiornamentoTelegram[]>("getUpdates", { ...(offset === null ? {} : { offset }), timeout: attesa, allowed_updates: ["message"] }, attesa),
    invia: async (chat_id: string, testo: string) => {
      const r = await metodo<{ message_id: number; chat: { id: number | string } }>("sendMessage", { chat_id, text: testo })
      return { id_esterno: `${r.chat.id}:${r.message_id}` }
    },
  }
}

export type ClientTelegram = ReturnType<typeof clientTelegram>
