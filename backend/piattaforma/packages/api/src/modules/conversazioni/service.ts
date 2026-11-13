import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import type { InferTypeOf } from "@medusajs/framework/types"
import { Conversazione } from "./models/conversazione"
import { Cursore } from "./models/cursore"
import { Identita } from "./models/identita"
import { Messaggio } from "./models/messaggio"
import { RispostaRapida } from "./models/risposta-rapida"
import { chiaveInArrivo, chiaveUscita, decidiInvio, estratto, statoDopo } from "./regole"
import type { Canale, InArrivo } from "./tipi"

export type MessaggioDTO = InferTypeOf<typeof Messaggio>
export type Autore = { id: string; nome: string }
export type Uscita = { testo: string; id_client: string; autore: Autore }
export type EsitoUscita = { stato: "inviato"; id_esterno: string } | { stato: "fallito"; errore: string }
export type Preparata = { messaggio: MessaggioDTO; decisione: "invia" | "gia_inviato" | "in_corso" }

const ERRORE_UNICITA = /unique|duplicate|already exists/i
const unicita = (errore: unknown) => ERRORE_UNICITA.test(String((errore as Error)?.message ?? errore))

// Le chiavi finiscono in «a» o in «e»: per le parole in «o» il plurale dei tipi (Messaggioes) e quello a runtime
// (Messaggios) sono diversi, e i metodi generati non esisterebbero.
export default class ConversazioniModuleService extends MedusaService({ Conversazione, Battuta: Messaggio, Identita, RispostaRapida, Cursore }) {
  /**
   * Messaggio di un cliente arrivato da un canale. Lo stesso messaggio letto due volte (un giro di lettura interrotto,
   * un webhook ripetuto) non si registra due volte: lo garantisce l'indice unico su `chiave_unica`. La conversazione è
   * l'ultima del contatto, riaperta se era chiusa. Chi chiama non registra in parallelo per lo stesso contatto (il job
   * di lettura ha il suo lucchetto): i non letti si contano leggendo e riscrivendo.
   */
  async registraInArrivo(e: InArrivo): Promise<{ conversazione_id: string; messaggio_id: string; nuovo: boolean }> {
    const chiave = chiaveInArrivo(e)
    const [gia] = await this.listBattutas({ chiave_unica: chiave }, { take: 1 })
    if (gia) return { conversazione_id: gia.conversazione_id, messaggio_id: gia.id, nuovo: false }

    const identita = await this.identitaPer(e)
    const [ultima] = await this.listConversaziones({ identita_id: identita.id }, { order: { ultimo_messaggio_il: "DESC" }, take: 1 })
    const conversazione = ultima ?? (await this.createConversaziones({
      canale: e.canale,
      identita_id: identita.id,
      stato: "aperta",
      oggetto: e.oggetto ?? null,
      ultimo_messaggio_il: e.quando,
      ultimo_estratto: estratto(e.testo),
      non_letti: 0,
    }))

    let messaggio: MessaggioDTO
    try {
      messaggio = await this.createBattutas({
        conversazione_id: conversazione.id,
        direzione: "entrata",
        testo: e.testo,
        quando: e.quando,
        chiave_unica: chiave,
        id_esterno: e.id_messaggio,
        stato_consegna: "ricevuto",
      })
    } catch (errore) {
      if (!unicita(errore)) throw errore
      const [registrato] = await this.listBattutas({ chiave_unica: chiave }, { take: 1 })
      return { conversazione_id: registrato.conversazione_id, messaggio_id: registrato.id, nuovo: false }
    }

    // Un messaggio arrivato in ritardo (più vecchio dell'ultimo) non sposta l'anteprima.
    const piuVecchio = new Date(conversazione.ultimo_messaggio_il).getTime() > e.quando.getTime()
    await this.updateConversaziones({
      id: conversazione.id,
      stato: statoDopo(conversazione.stato, "entrata"),
      non_letti: conversazione.non_letti + 1,
      ...(piuVecchio ? {} : { ultimo_messaggio_il: e.quando, ultimo_estratto: estratto(e.testo) }),
    })
    return { conversazione_id: conversazione.id, messaggio_id: messaggio.id, nuovo: true }
  }

  /** Identità del contatto per canale e account: creata la prima volta, nome e recapito aggiornati se il canale li cambia. */
  private async identitaPer(e: InArrivo) {
    const filtro = { canale: e.canale, account: e.account, id_contatto: e.id_contatto }
    const [esistente] = await this.listIdentitas(filtro, { take: 1 })
    if (esistente) {
      const cambi = {
        ...(e.nome && e.nome !== esistente.nome ? { nome: e.nome } : {}),
        ...(e.recapito && e.recapito !== esistente.recapito ? { recapito: e.recapito } : {}),
      }
      if (Object.keys(cambi).length) await this.updateIdentitas({ id: esistente.id, ...cambi })
      return esistente
    }
    try {
      return await this.createIdentitas({ ...filtro, nome: e.nome, recapito: e.recapito })
    } catch (errore) {
      if (!unicita(errore)) throw errore
      const [creata] = await this.listIdentitas(filtro, { take: 1 })
      return creata
    }
  }

  /**
   * Prepara una risposta del team. Lo stesso `id_client` è la stessa risposta: un doppio clic o un nuovo tentativo la
   * ritrovano e decidono con `decidiInvio` (già inviata, in partenza, oppure fallita e quindi da rimandare). Una
   * risposta nuova su una conversazione chiusa è rifiutata.
   */
  async preparaUscita(conversazione_id: string, { testo, id_client, autore }: Uscita): Promise<Preparata> {
    const conversazione = await this.retrieveConversazione(conversazione_id)
    const chiave = chiaveUscita(id_client)
    const [esistente] = await this.listBattutas({ chiave_unica: chiave }, { take: 1 })
    if (esistente) return this.riprendi(esistente, conversazione_id, conversazione.stato)

    const stato = statoDopo(conversazione.stato, "uscita")
    let messaggio: MessaggioDTO
    try {
      messaggio = await this.createBattutas({
        conversazione_id,
        direzione: "uscita",
        testo,
        quando: new Date(),
        chiave_unica: chiave,
        stato_consegna: "in_coda",
        autore_id: autore.id,
        autore_nome: autore.nome,
      })
    } catch (errore) {
      if (!unicita(errore)) throw errore
      const [registrato] = await this.listBattutas({ chiave_unica: chiave }, { take: 1 })
      return this.riprendi(registrato, conversazione_id, conversazione.stato)
    }
    // Chi risponde ha letto: la conversazione passa al cliente.
    await this.updateConversaziones({ id: conversazione_id, stato, non_letti: 0, ultimo_messaggio_il: messaggio.quando, ultimo_estratto: estratto(testo) })
    return { messaggio, decisione: "invia" }
  }

  /** Risposta già vista: resta nella sua conversazione; se era fallita torna in coda (mai su una conversazione chiusa). */
  private async riprendi(messaggio: MessaggioDTO, conversazione_id: string, stato: InferTypeOf<typeof Conversazione>["stato"]): Promise<Preparata> {
    if (messaggio.conversazione_id !== conversazione_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "This message id was already used")
    }
    const decisione = decidiInvio(messaggio)
    if (decisione !== "invia") return { messaggio, decisione }
    statoDopo(stato, "uscita")
    const inCoda = await this.updateBattutas({ id: messaggio.id, stato_consegna: "in_coda", errore: null })
    return { messaggio: inCoda, decisione }
  }

  async esitoUscita(messaggio_id: string, esito: EsitoUscita): Promise<void> {
    await this.updateBattutas(
      esito.stato === "inviato"
        ? { id: messaggio_id, stato_consegna: "inviato", id_esterno: esito.id_esterno, errore: null }
        : { id: messaggio_id, stato_consegna: "fallito", errore: esito.errore }
    )
  }

  async cambiaStato(id: string, stato: "aperta" | "chiusa"): Promise<void> {
    await this.retrieveConversazione(id)
    await this.updateConversaziones({ id, stato })
  }

  async segnaLetta(id: string): Promise<void> {
    await this.retrieveConversazione(id)
    await this.updateConversaziones({ id, non_letti: 0 })
  }

  /** Collega (o scollega, con null) il contatto a un cliente del negozio: lo decide una persona del team. */
  async collegaCliente(identita_id: string, cliente_id: string | null): Promise<void> {
    await this.retrieveIdentita(identita_id)
    await this.updateIdentitas({ id: identita_id, cliente_id })
  }

  async leggiCursore(canale: Canale, account: string): Promise<string | null> {
    const [cursore] = await this.listCursores({ canale, account }, { take: 1 })
    return cursore?.valore ?? null
  }

  async salvaCursore(canale: Canale, account: string, valore: string): Promise<void> {
    const [cursore] = await this.listCursores({ canale, account }, { take: 1 })
    if (cursore) {
      await this.updateCursores({ id: cursore.id, valore })
      return
    }
    try {
      await this.createCursores({ canale, account, valore })
    } catch (errore) {
      if (!unicita(errore)) throw errore
      const [creato] = await this.listCursores({ canale, account }, { take: 1 })
      await this.updateCursores({ id: creato.id, valore })
    }
  }
}
