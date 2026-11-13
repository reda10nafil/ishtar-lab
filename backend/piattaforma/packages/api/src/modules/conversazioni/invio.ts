import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { CONNECTORS_MODULE } from "../connectors"
import type ConnectorsModuleService from "../connectors/service"
import { clientTelegram, ErroreCanale } from "./canali/telegram"
import { CONVERSAZIONI_MODULE } from "./index"
import type ConversazioniModuleService from "./service"
import type { EsitoUscita, MessaggioDTO, Uscita } from "./service"
import type { Canale } from "./tipi"

/*
 * Invio di una risposta del team. Lo stesso id della risposta passa da un solo lucchetto e da una sola riga (chiave
 * unica): un doppio clic o un nuovo tentativo trovano la risposta già partita o in partenza e non la rimandano.
 */

type Lucchetti = { execute: <T>(chiavi: string[], lavoro: () => Promise<T>, opzioni?: { timeout?: number }) => Promise<T> }

export async function inviaRisposta(scope: MedusaContainer, conversazione_id: string, uscita: Uscita): Promise<MessaggioDTO> {
  const lucchetti = scope.resolve(Modules.LOCKING) as unknown as Lucchetti
  return lucchetti.execute([`conversazioni:uscita:${uscita.id_client}`], () => invia(scope, conversazione_id, uscita), { timeout: 30 })
}

async function invia(scope: MedusaContainer, conversazione_id: string, uscita: Uscita): Promise<MessaggioDTO> {
  const conversazioni = scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  const { messaggio, decisione } = await conversazioni.preparaUscita(conversazione_id, uscita)
  if (decisione !== "invia") return messaggio
  const conversazione = await conversazioni.retrieveConversazione(conversazione_id, { relations: ["identita"] })
  const esito = await consegna(scope, conversazione.canale, conversazione.identita.id_contatto, uscita.testo)
  await conversazioni.esitoUscita(messaggio.id, esito)
  return conversazioni.retrieveBattuta(messaggio.id)
}

async function consegna(scope: MedusaContainer, canale: Canale, id_contatto: string, testo: string): Promise<EsitoUscita> {
  if (canale !== "telegram") return { stato: "fallito", errore: "Replies on this channel are not available yet" }
  const connettori = scope.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  const credenziali = await connettori.credenzialiCollegate("telegram")
  const token = credenziali?.valori.bot_token
  if (!token) return { stato: "fallito", errore: "Telegram is not connected" }
  try {
    const { id_esterno } = await clientTelegram(token).invia(id_contatto, testo)
    return { stato: "inviato", id_esterno }
  } catch (errore) {
    if (!(errore instanceof ErroreCanale)) throw errore
    if (errore.codice === "credenziali") await connettori.segnaErrore("telegram", errore.message)
    // Senza risposta di Telegram il messaggio può essere arrivato lo stesso: va controllata la chat prima di rimandarlo.
    const motivo = errore.codice === "rete" ? "Not confirmed by Telegram: check the chat before sending it again" : errore.message
    return { stato: "fallito", errore: motivo }
  }
}
