import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { CONNECTORS_MODULE } from "../connectors"
import type ConnectorsModuleService from "../connectors/service"
import { classificaErrore, credenzialiEmail, MESSAGGI_ERRORE } from "./canali/email-connessioni"
import { elaboraEmail, leggiCasella, type Lettura } from "./canali/email-imap"
import { ErroreRete, type Risolvi } from "./canali/email-rete"
import { CONVERSAZIONI_MODULE } from "./index"
import type { EsitoLettura } from "./ricezione"
import type ConversazioniModuleService from "./service"

/*
 * Lettura a intervalli della casella email del negozio (connettore «Shop mailbox»). Un solo giro alla volta (lucchetto);
 * senza casella collegata non fa nulla. Password rifiutata, certificato non valido o server non ammesso mettono il
 * connettore in errore (la lettura riparte dopo una nuova prova dalla console: niente tentativi di accesso ripetuti che
 * farebbero bloccare l'account); un server che oggi non risponde si riprova al giro dopo. Nel registro solo testi fissi e
 * il tipo degli errori: le risposte dei server e del database possono ripetere indirizzi e contenuti delle email.
 */

type Lucchetti = { execute: <T>(chiavi: string[], lavoro: () => Promise<T>, opzioni?: { timeout?: number }) => Promise<T> }

export async function riceviDaEmail(container: MedusaContainer, opzioni: { risolvi?: Risolvi } = {}): Promise<EsitoLettura> {
  const lucchetti = container.resolve(Modules.LOCKING) as unknown as Lucchetti
  try {
    return await lucchetti.execute(["conversazioni:ricevi:email"], () => leggiEmail(container, opzioni.risolvi), { timeout: 1 })
  } catch (errore) {
    if (/timed-out acquiring lock/i.test(String((errore as Error)?.message ?? errore))) return "occupato"
    throw errore
  }
}

async function leggiEmail(container: MedusaContainer, risolvi?: Risolvi): Promise<EsitoLettura> {
  const connettori = container.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  const conversazioni = container.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const credenziali = await connettori.credenzialiCollegate("casella_email")
  if (!credenziali?.valori.password) return "spento"
  const cred = credenzialiEmail(credenziali.valori)
  let lettura: Lettura
  try {
    lettura = await leggiCasella(cred, await conversazioni.leggiCursore("email", cred.indirizzo, "INBOX"), { risolvi })
  } catch (errore) {
    const rete = errore instanceof ErroreRete ? errore : null
    const tipo = classificaErrore(errore)
    const messaggio = rete ? rete.message : MESSAGGI_ERRORE[tipo]
    const daCorreggere = rete ? !rete.transitoria : tipo !== "rete"
    // Con i valori usati: se nel frattempo la casella è stata riconfigurata, l'errore non tocca la configurazione nuova.
    if (daCorreggere) await connettori.segnaErrore("casella_email", messaggio, credenziali.valori)
    logger.warn(`Customer inbox, email: ${messaggio}`)
    return "errore"
  }
  try {
    await elaboraEmail(lettura, {
      account: cred.indirizzo,
      registra: (e) => conversazioni.registraInArrivo(e),
      rimbalzo: (message_id, motivo) => conversazioni.segnaRimbalzo(message_id, motivo),
      salva: (cursore) => conversazioni.salvaCursore("email", cred.indirizzo, "INBOX", cursore),
    })
    return "fatto"
  } catch (errore) {
    logger.error(`Customer inbox, email: a message was not saved and will be read again (${(errore as Error)?.name ?? "error"})`)
    return "errore"
  }
}
