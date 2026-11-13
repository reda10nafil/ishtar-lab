import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { CONNECTORS_MODULE } from "../connectors"
import type ConnectorsModuleService from "../connectors/service"
import { clientTelegram, ErroreCanale } from "./canali/telegram"
import { CONVERSAZIONI_MODULE } from "./index"
import { NON_CONFERMATO } from "./service"
import type ConversazioniModuleService from "./service"
import type { EsitoUscita, MessaggioDTO, Uscita } from "./service"
import type { Canale } from "./tipi"

/*
 * Invio di una risposta del team. Lo stesso id della risposta passa da un solo lucchetto e da una sola riga (chiave
 * unica): un doppio clic o un nuovo tentativo trovano la risposta già partita o in partenza e non la rimandano. Si
 * distingue ciò che certamente non è partito (fallito: si può ritentare) da ciò che forse è arrivato (incerto: con lo
 * stesso id non si rimanda mai, per non mandarlo due volte).
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
  let tentato = false
  try {
    const conversazione = await conversazioni.retrieveConversazione(conversazione_id, { relations: ["identita"] })
    // Al cliente parte sempre il testo salvato con questo id.
    const esito = await consegna(scope, conversazione.canale, conversazione.identita.id_contatto, messaggio.testo, async () => {
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

async function consegna(scope: MedusaContainer, canale: Canale, id_contatto: string, testo: string, primaDellInvio: () => Promise<void>): Promise<EsitoUscita> {
  if (canale !== "telegram") return { stato: "fallito", errore: "Replies on this channel are not available yet" }
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
