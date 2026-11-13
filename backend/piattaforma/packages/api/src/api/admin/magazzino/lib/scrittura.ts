import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { esegui, scorteWorkflow, type EsitoScorte } from "../../../../workflows/catalogo/salvataggio-prodotto"
import { invalido } from "../../../utili"
import type { OperazioneScorte } from "./operazioni"

/** Valore cambiato altrove: la console riceve 412 con il valore attuale e ricarica i dati. */
export class ConflittoHttp extends Error {
  constructor(messaggio: string, public conflitti: unknown[]) {
    super(messaggio)
    this.name = "ConflittoHttp"
  }
}

export const rispondiConflitto = (res: MedusaResponse, errore: ConflittoHttp) =>
  res.status(412).json({ message: errore.message, code: "conflitto", conflitti: errore.conflitti })

/** Codice del 500 «salvataggio a metà»: la console mostra il suo testo invece del generico «try again shortly». */
export const CODICE_A_META = "salvataggio_a_meta"

/**
 * Errore uscito da un workflow di scorte (serializzato da Medusa, riconosciuto dal nome): conflitto → 412 con la riga
 * (articolo e deposito), scorte sotto zero → 400, annullamento non riuscito → 500 con un testo esplicito (le voci da
 * sistemare le scrive esegui nel log). Gli altri errori (SKU o EAN già usati, voce non trovata, lucchetto non ottenuto)
 * restano come sono, con il loro tipo: l'errorHandler di Medusa ne ricava 400, 404 o 409, come quando la rotta lanciava
 * direttamente il workflow di Medusa.
 */
export function erroreScorte(errore: any, aMeta: boolean): unknown {
  if (aMeta || errore?.name === "ScorteAMeta") {
    return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Saving was interrupted and could not be fully undone: reload and check the values you changed", CODICE_A_META)
  }
  if (errore?.name === "ConflittoScorte") {
    const testo = errore.campo === "incoming" ? "the incoming units were changed elsewhere" : "stock was changed elsewhere"
    const riga = errore.voce ? { articolo_id: errore.voce, deposito_id: errore.deposito } : {}
    return new ConflittoHttp(`Not saved: ${testo} (now ${errore.attuale}).`, [{ campo: errore.campo, attuale: errore.attuale, ...riga }])
  }
  if (errore?.name === "ScorteNonValide") return invalido("Stock cannot go below zero")
  return errore ?? new Error("Saving failed")
}

/** Correzioni e conteggi del Magazzino in un solo workflow, sotto il lucchetto di ogni voce. */
export async function eseguiScorte(req: AuthenticatedMedusaRequest, operazioni: OperazioneScorte[], chi: string): Promise<EsitoScorte[]> {
  const quando = new Date().toISOString()
  const esito = await esegui(scorteWorkflow, req.scope, { operazioni: operazioni.map((o) => ({ ...o, chi, quando })) })
  if (esito.esito === "fatto") return esito.risultato as EsitoScorte[]
  throw erroreScorte(esito.errore, esito.esito === "a-meta")
}
