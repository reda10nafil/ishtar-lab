import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { CONNECTORS_MODULE } from "../connectors"
import type ConnectorsModuleService from "../connectors/service"
import { credenzialiEmail } from "./canali/email-connessioni"
import { filoDaDettagli, intestazioniRisposta, messageIdNostro } from "./canali/email-regole"
import { inviaEmail } from "./canali/email-smtp"
import { clientTelegram, ErroreCanale } from "./canali/telegram"
import { CONVERSAZIONI_MODULE } from "./index"
import { NON_CONFERMATO } from "./service"
import type ConversazioniModuleService from "./service"
import type { EsitoUscita, MessaggioDTO, Uscita } from "./service"

/*
 * Invio di una risposta del team. Lo stesso id della risposta passa da un solo lucchetto e da una sola riga (chiave
 * unica): un doppio clic o un nuovo tentativo trovano la risposta già partita o in partenza e non la rimandano. Si
 * distingue ciò che certamente non è partito (fallito: si può ritentare) da ciò che forse è arrivato (incerto: con lo
 * stesso id non si rimanda mai, per non mandarlo due volte).
 */

type Lucchetti = { execute: <T>(chiavi: string[], lavoro: () => Promise<T>, opzioni?: { timeout?: number }) => Promise<T> }
type Destinazione = { id: string; canale: string; oggetto?: string | null; identita: { id_contatto: string } }

export async function inviaRisposta(scope: MedusaContainer, conversazione_id: string, uscita: Uscita): Promise<MessaggioDTO> {
  const lucchetti = scope.resolve(Modules.LOCKING) as unknown as Lucchetti
  return lucchetti.execute([`conversazioni:uscita:${uscita.id_client}`], () => invia(scope, conversazione_id, uscita), { timeout: 30 })
}

async function invia(scope: MedusaContainer, conversazione_id: string, uscita: Uscita): Promise<MessaggioDTO> {
  const conversazioni = scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  const { messaggio, decisione } = await conversazioni.preparaUscita(conversazione_id, uscita)
  if (decisione !== "invia") return messaggio
  let tentato = false
  try {
    const conversazione = await conversazioni.retrieveConversazione(conversazione_id, { relations: ["identita"] })
    // Al cliente parte sempre il testo salvato con questo id.
    const esito = await consegna(scope, conversazione, messaggio, async () => {
      await conversazioni.segnaTentativo(messaggio.id)
      tentato = true
    })
    await conversazioni.esitoUscita(messaggio.id, esito)
  } catch {
    // Errore imprevisto: prima del tentativo la risposta certamente non è partita, dopo forse sì.
    await conversazioni.esitoUscita(messaggio.id, tentato
      ? { stato: "incerto", errore: NON_CONFERMATO }
      : { stato: "fallito", errore: "Not sent: something went wrong before sending. Try again" })
  }
  return conversazioni.retrieveBattuta(messaggio.id)
}

async function consegna(scope: MedusaContainer, conversazione: Destinazione, messaggio: MessaggioDTO, primaDellInvio: () => Promise<void>): Promise<EsitoUscita> {
  if (conversazione.canale === "email") return consegnaEmail(scope, conversazione, messaggio, primaDellInvio)
  if (conversazione.canale !== "telegram") return { stato: "fallito", errore: "Replies on this channel are not available yet" }
  const id_contatto = conversazione.identita.id_contatto
  const testo = messaggio.testo
  const connettori = scope.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  const credenziali = await connettori.credenzialiCollegate("telegram")
  const token = credenziali?.valori.bot_token
  if (!token) return { stato: "fallito", errore: "Telegram is not connected" }
  await primaDellInvio()
  try {
    const { id_esterno } = await clientTelegram(token).invia(id_contatto, testo)
    return { stato: "inviato", id_esterno }
  } catch (errore) {
    if (!(errore instanceof ErroreCanale)) throw errore
    if (errore.codice === "credenziali") await connettori.segnaErrore("telegram", errore.message, token)
    // Senza una risposta chiara di Telegram (rete, timeout, errore del servizio) il messaggio può essere arrivato.
    if (errore.codice === "rete" || errore.codice === "servizio") return { stato: "incerto", errore: NON_CONFERMATO }
    return { stato: "fallito", errore: errore.message }
  }
}

/**
 * Risposta email nello stesso filo dell'ultima email del cliente, sempre all'indirizzo da cui ha scritto (mai al
 * Reply-To). Intestazioni e Message-ID si salvano prima del tentativo; il Message-ID nasce dall'id della risposta, quindi
 * un nuovo tentativo con lo stesso id manda la stessa email.
 */
async function consegnaEmail(scope: MedusaContainer, conversazione: Destinazione, messaggio: MessaggioDTO, primaDellInvio: () => Promise<void>): Promise<EsitoUscita> {
  const connettori = scope.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  const conversazioni = scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  const credenziali = await connettori.credenzialiCollegate("casella_email")
  if (!credenziali?.valori.password) return { stato: "fallito", errore: "Email is not connected" }
  const cred = credenzialiEmail(credenziali.valori)
  const ultimo = await conversazioni.ultimoInArrivo(conversazione.id)
  const filo = intestazioniRisposta(filoDaDettagli(ultimo?.dettagli), conversazione.oggetto ?? null)
  const id_client = messaggio.chiave_unica?.startsWith("uscita:") ? messaggio.chiave_unica.slice("uscita:".length) : messaggio.id
  const message_id = messageIdNostro(id_client, cred.indirizzo)
  await conversazioni.dettagliUscita(messaggio.id, { message_id, in_reply_to: filo.inReplyTo ?? null, references: filo.references, oggetto: filo.oggetto })
  const { esito, daSegnalare } = await inviaEmail(
    cred,
    { a: conversazione.identita.id_contatto, oggetto: filo.oggetto, testo: messaggio.testo, messageId: message_id, inReplyTo: filo.inReplyTo, references: filo.references },
    { primaDellInvio }
  )
  // Con i valori usati: se nel frattempo la casella è stata riconfigurata, l'errore non tocca la configurazione nuova.
  if (daSegnalare) await connettori.segnaErrore("casella_email", daSegnalare, credenziali.valori)
  return esito
}
