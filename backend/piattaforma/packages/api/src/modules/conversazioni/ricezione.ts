import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { CONNECTORS_MODULE } from "../connectors"
import type ConnectorsModuleService from "../connectors/service"
import { clientTelegram, ErroreCanale, normalizzaAggiornamento } from "./canali/telegram"
import { CONVERSAZIONI_MODULE } from "./index"
import type ConversazioniModuleService from "./service"

/*
 * Lettura a intervalli dei canali che non hanno bisogno di un indirizzo pubblico (oggi Telegram). Ogni esecuzione parte
 * senza offset, così Telegram restituisce tutto ciò che non è ancora confermato: dopo una settimana senza messaggi gli
 * identificativi ripartono da un numero a caso, anche più basso, e un offset salvato li scarterebbe in silenzio. L'offset
 * avanza solo dentro un'esecuzione e solo dopo che un messaggio è registrato; la chiave unica dei messaggi impedisce i
 * doppioni quando un aggiornamento si rilegge.
 */

type Lucchetti = { execute: <T>(chiavi: string[], lavoro: () => Promise<T>, opzioni?: { timeout?: number }) => Promise<T> }

export type EsitoLettura = "spento" | "occupato" | "fatto" | "errore"

/** Registra in ordine; al primo errore si ferma e il cursore resta sull'aggiornamento fallito. */
export async function elaboraAggiornamenti<U extends { update_id: number }>(
  aggiornamenti: U[],
  registra: (u: U) => Promise<void>
): Promise<{ prossimo: number | null; errore: unknown | null }> {
  let prossimo: number | null = null
  for (const u of aggiornamenti) {
    try {
      await registra(u)
    } catch (errore) {
      return { prossimo: u.update_id, errore }
    }
    prossimo = u.update_id + 1
  }
  return { prossimo, errore: null }
}

/** `giri` richieste di aggiornamenti: la prima senza offset, le altre con l'offset dopo l'ultimo registrato. */
export async function leggiGiri<U extends { update_id: number }>(
  leggi: (offset: number | null) => Promise<U[]>,
  registra: (u: U) => Promise<void>,
  giri: number
): Promise<{ errore: unknown | null }> {
  let offset: number | null = null
  for (let giro = 0; giro < giri; giro += 1) {
    const { prossimo, errore } = await elaboraAggiornamenti(await leggi(offset), registra)
    if (prossimo !== null) offset = prossimo
    if (errore) return { errore }
  }
  return { errore: null }
}

/**
 * Un'esecuzione della lettura del bot Telegram del negozio: `giri` richieste getUpdates, ciascuna in attesa fino ad `attesa`
 * secondi. Un solo giro alla volta (lucchetto); senza un bot collegato non fa nulla. Token rifiutato o webhook di un altro
 * sistema mettono il connettore in errore: la lettura riparte dopo una nuova prova dalla console.
 */
export async function riceviDaTelegram(container: MedusaContainer, { giri, attesa }: { giri: number; attesa: number }): Promise<EsitoLettura> {
  const lucchetti = container.resolve(Modules.LOCKING) as unknown as Lucchetti
  try {
    return await lucchetti.execute(["conversazioni:ricevi:telegram"], () => leggiTelegram(container, giri, attesa), { timeout: 1 })
  } catch (errore) {
    if (/timed-out acquiring lock/i.test(String((errore as Error)?.message ?? errore))) return "occupato"
    throw errore
  }
}

async function leggiTelegram(container: MedusaContainer, giri: number, attesa: number): Promise<EsitoLettura> {
  const connettori = container.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  const conversazioni = container.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const credenziali = await connettori.credenzialiCollegate("telegram")
  const token = credenziali?.valori.bot_token
  if (!token) return "spento"
  const client = clientTelegram(token)
  try {
    const account = credenziali.account || (await client.account())
    const { errore } = await leggiGiri((offset) => client.leggi(offset, attesa), async (u) => {
      const messaggio = normalizzaAggiornamento(u, account)
      if (messaggio) await conversazioni.registraInArrivo(messaggio)
    }, giri)
    if (errore) {
      // Solo il tipo dell'errore: il messaggio del database può contenere la riga con testo, nome e chat del cliente.
      logger.error(`Customer inbox, Telegram: a message was not saved and will be read again (${(errore as Error)?.name ?? "error"})`)
      return "errore"
    }
    return "fatto"
  } catch (errore) {
    if (!(errore instanceof ErroreCanale)) throw errore
    if (["credenziali", "webhook", "conflitto"].includes(errore.codice)) await connettori.segnaErrore("telegram", errore.message, token)
    logger.warn(`Customer inbox, Telegram: ${errore.message}`)
    return "errore"
  }
}
