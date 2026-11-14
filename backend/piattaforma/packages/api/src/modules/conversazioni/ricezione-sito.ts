import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { CONNECTORS_MODULE } from "../connectors"
import type ConnectorsModuleService from "../connectors/service"
import { clientCasella } from "./canali/sito"
import { ErroreSito, rigaInArrivo, type CodiceSito, type RigaCasella } from "./canali/sito-regole"
import { CONVERSAZIONI_MODULE } from "./index"
import type { EsitoLettura } from "./ricezione"
import type ConversazioniModuleService from "./service"
import type { InArrivo } from "./tipi"

/*
 * Lettura a intervalli della chat del sito (connettore «Site chat»): i messaggi dei visitatori aspettano nella casella su
 * Supabase finché Ishtar Lab non li registra e conferma. Si conferma solo dopo la registrazione, quindi una caduta in
 * mezzo fa rileggere il messaggio e la chiave unica del modulo evita il doppione. Un solo giro alla volta (lucchetto) e
 * un solo lettore per casella: un altro Ishtar Lab attivo sulla stessa casella mette il connettore in errore invece di
 * dividersi i messaggi in silenzio. Nel registro solo testi fissi e il tipo degli errori, mai i dati dei visitatori.
 */

type Lucchetti = { execute: <T>(chiavi: string[], lavoro: () => Promise<T>, opzioni?: { timeout?: number }) => Promise<T> }

const LIMITE = 50
/** Errori che chiedono un intervento dalla console: la lettura si ferma finché il connettore non viene riprovato. */
const DA_CORREGGERE: CodiceSito[] = ["credenziali", "lettore", "versione", "indirizzo"]

/** Registra in ordine e conferma solo i messaggi registrati; al primo errore si ferma (il resto resta da importare). */
export async function elaboraSito(
  righe: RigaCasella[],
  { rif, registra, conferma }: { rif: string; registra: (e: InArrivo) => Promise<unknown>; conferma: (ids: string[]) => Promise<unknown> }
): Promise<{ registrati: number; scartati: number; errore: unknown | null }> {
  const ids: string[] = []
  let scartati = 0
  let errore: unknown = null
  for (const riga of righe) {
    const messaggio = rigaInArrivo(riga, rif)
    if (!messaggio) {
      scartati += 1
      continue
    }
    try {
      await registra(messaggio)
    } catch (e) {
      errore = e
      break
    }
    ids.push(riga.id)
  }
  if (ids.length) await conferma(ids)
  return { registrati: ids.length, scartati, errore }
}

/**
 * Identificativo di questo Ishtar Lab come lettore della casella: il nome dell'istanza più una parte casuale scelta la
 * prima volta e salvata nel database (fra i punti di lettura). Resta uguale ai riavvii, così la casella non lo scambia
 * per un altro lettore; due installazioni con database diversi hanno identificativi diversi anche con lo stesso nome.
 */
async function idLettore(conversazioni: ConversazioniModuleService): Promise<string> {
  const salvato = await conversazioni.leggiCursore("sito", "*", "lettore")
  if (salvato?.uidvalidity) return salvato.uidvalidity
  const istanza = (process.env.ISHTAR_INSTANCE_ID || "ishtar-lab").replace(/[^\w.-]/g, "").slice(0, 40) || "ishtar-lab"
  const id = `${istanza}-${randomUUID()}`
  await conversazioni.salvaCursore("sito", "*", "lettore", { uidvalidity: id, ultimo_uid: 0 })
  return id
}

const pausa = (secondi: number) => new Promise((ok) => setTimeout(ok, secondi * 1000))

/**
 * Un'esecuzione della lettura della chat del sito: `giri` prelievi distanziati di `attesa` secondi. Senza connettore
 * collegato non fa nulla.
 */
export async function riceviDaSito(container: MedusaContainer, { giri, attesa }: { giri: number; attesa: number }): Promise<EsitoLettura> {
  const lucchetti = container.resolve(Modules.LOCKING) as unknown as Lucchetti
  try {
    return await lucchetti.execute(["conversazioni:ricevi:sito"], () => leggiSito(container, giri, attesa), { timeout: 1 })
  } catch (errore) {
    if (/timed-out acquiring lock/i.test(String((errore as Error)?.message ?? errore))) return "occupato"
    throw errore
  }
}

async function leggiSito(container: MedusaContainer, giri: number, attesa: number): Promise<EsitoLettura> {
  const connettori = container.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  const conversazioni = container.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const credenziali = await connettori.credenzialiCollegate("chat_sito")
  if (!credenziali?.valori.chiave) return "spento"
  try {
    const client = clientCasella({ url: credenziali.valori.url, chiave: credenziali.valori.chiave })
    const lettore = await idLettore(conversazioni)
    for (let giro = 0; giro < giri; giro += 1) {
      if (giro) await pausa(attesa)
      const { scartati, errore } = await elaboraSito(await client.preleva(lettore, LIMITE), {
        rif: client.rif,
        registra: (e) => conversazioni.registraInArrivo(e),
        conferma: (ids) => client.conferma(lettore, ids),
      })
      if (scartati) logger.warn(`Customer inbox, site chat: ${scartati} message${scartati === 1 ? "" : "s"} without the chat's ids skipped`)
      if (errore) {
        // Solo il tipo dell'errore: il messaggio del database può contenere la riga con testo, nome ed email del visitatore.
        logger.error(`Customer inbox, site chat: a message was not saved and will be read again (${(errore as Error)?.name ?? "error"})`)
        return "errore"
      }
    }
    return "fatto"
  } catch (errore) {
    if (!(errore instanceof ErroreSito)) throw errore
    // Con i valori usati: se nel frattempo il connettore è stato riconfigurato, l'errore non tocca la configurazione nuova.
    if (DA_CORREGGERE.includes(errore.codice)) await connettori.segnaErrore("chat_sito", errore.message, credenziali.valori)
    logger.warn(`Customer inbox, site chat: ${errore.message}`)
    return "errore"
  }
}
