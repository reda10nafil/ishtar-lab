import { InjectTransactionManager, MedusaContext, MedusaError, MedusaService } from "@medusajs/framework/utils"
import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { Conversazione } from "./models/conversazione"
import { Identita } from "./models/identita"
import { Messaggio } from "./models/messaggio"
import { RispostaRapida } from "./models/risposta-rapida"
import { chiaveInArrivo, chiaveUscita, decidiInvio, estratto, filtroNuoviDopo, statoDopo, statoDopoFallimento, type Decisione } from "./regole"
import type { InArrivo } from "./tipi"

export type MessaggioDTO = InferTypeOf<typeof Messaggio>
type ConversazioneDTO = InferTypeOf<typeof Conversazione>
export type Autore = { id: string; nome: string }
/** `ultimo_visto`: id dell'ultimo messaggio che chi risponde aveva davanti (null se nessuno). */
export type Uscita = { testo: string; id_client: string; autore: Autore; ultimo_visto: string | null }
export type EsitoUscita = { stato: "inviato"; id_esterno: string } | { stato: "fallito" | "incerto"; errore: string }
export type Preparata = { messaggio: MessaggioDTO; decisione: Decisione }

/** Risposta rimasta in coda dopo la chiamata al canale (processo fermato durante l'invio): forse è arrivata. */
export const NON_CONFERMATO = "Not confirmed: the customer may have received it. To repeat it, send it as a new reply"

const ERRORE_UNICITA = /unique|duplicate|already exists/i
const unicita = (errore: unknown) => ERRORE_UNICITA.test(String((errore as Error)?.message ?? errore))

// Le chiavi finiscono in «a» o in «e»: per le parole in «o» il plurale dei tipi (Messaggioes) e quello a runtime
// (Messaggios) sono diversi, e i metodi generati non esisterebbero.
export default class ConversazioniModuleService extends MedusaService({ Conversazione, Battuta: Messaggio, Identita, RispostaRapida }) {
  /**
   * Messaggio di un cliente arrivato da un canale. Messaggio, identità e conversazione si scrivono in una sola
   * transazione: un guasto a metà non lascia un messaggio registrato in una conversazione mai aggiornata (la rilettura lo
   * ritroverebbe «già registrato» e non riparerebbe nulla). Lo stesso messaggio letto due volte non si registra due volte:
   * lo garantisce l'indice unico su `chiave_unica`. Un errore di unicità annulla la transazione (due registrazioni
   * insieme dello stesso contatto o messaggio): al secondo tentativo l'identità c'è già e il messaggio, se l'altra
   * registrazione l'ha scritto, risulta «già registrato». Chi chiama non registra in parallelo per lo stesso contatto (il
   * job di lettura ha il suo lucchetto): i non letti si contano leggendo e riscrivendo.
   */
  async registraInArrivo(e: InArrivo): Promise<{ conversazione_id: string; messaggio_id: string; nuovo: boolean }> {
    for (let tentativo = 0; ; tentativo += 1) {
      try {
        return await this.registraInTransazione(e)
      } catch (errore) {
        if (!unicita(errore) || tentativo >= 1) throw errore
      }
    }
  }

  @InjectTransactionManager()
  protected async registraInTransazione(e: InArrivo, @MedusaContext() contesto: Context = {}) {
    const chiave = chiaveInArrivo(e)
    const [gia] = await this.listBattutas({ chiave_unica: chiave }, { take: 1 }, contesto)
    if (gia) return { conversazione_id: gia.conversazione_id, messaggio_id: gia.id, nuovo: false }

    const identita = await this.identitaPer(e, contesto)
    const [ultima] = await this.listConversaziones({ identita_id: identita.id }, { order: { ultimo_messaggio_il: "DESC" }, take: 1 }, contesto)
    const conversazione = ultima ?? (await this.createConversaziones({
      canale: e.canale,
      identita_id: identita.id,
      stato: "aperta",
      oggetto: e.oggetto ?? null,
      ultimo_messaggio_il: e.quando,
      ultimo_estratto: estratto(e.testo),
      non_letti: 0,
    }, contesto))

    const messaggio = await this.createBattutas({
      conversazione_id: conversazione.id,
      direzione: "entrata",
      testo: e.testo,
      quando: e.quando,
      chiave_unica: chiave,
      id_esterno: e.id_messaggio,
      stato_consegna: "ricevuto",
    }, contesto)

    // Un messaggio arrivato in ritardo (più vecchio dell'ultimo) non sposta l'anteprima.
    const piuVecchio = new Date(conversazione.ultimo_messaggio_il).getTime() > e.quando.getTime()
    await this.updateConversaziones({
      id: conversazione.id,
      stato: statoDopo(conversazione.stato, "entrata"),
      non_letti: conversazione.non_letti + 1,
      ...(piuVecchio ? {} : { ultimo_messaggio_il: e.quando, ultimo_estratto: estratto(e.testo) }),
    }, contesto)
    return { conversazione_id: conversazione.id, messaggio_id: messaggio.id, nuovo: true }
  }

  /** Identità del contatto per canale e account: creata la prima volta, nome e recapito aggiornati se il canale li cambia. */
  private async identitaPer(e: InArrivo, contesto: Context) {
    const filtro = { canale: e.canale, account: e.account, id_contatto: e.id_contatto }
    const [esistente] = await this.listIdentitas(filtro, { take: 1 }, contesto)
    if (!esistente) return this.createIdentitas({ ...filtro, nome: e.nome, recapito: e.recapito }, contesto)
    const cambi = {
      ...(e.nome && e.nome !== esistente.nome ? { nome: e.nome } : {}),
      ...(e.recapito && e.recapito !== esistente.recapito ? { recapito: e.recapito } : {}),
    }
    if (Object.keys(cambi).length) await this.updateIdentitas({ id: esistente.id, ...cambi }, contesto)
    return esistente
  }

  /**
   * Messaggi del cliente arrivati dopo `ultimo_visto` (l'ultimo messaggio che il team aveva davanti; null: nessuno). Una
   * pagina rimasta indietro non segna letti, non chiude e non mette «in attesa» messaggi che nessuno ha visto.
   */
  async nuoviDopo(conversazione_id: string, ultimo_visto: string | null, contesto: Context = {}): Promise<number> {
    let visto: { id: string; created_at: Date | string } | null = null
    if (ultimo_visto) {
      ;[visto] = await this.listBattutas({ id: ultimo_visto, conversazione_id }, { take: 1 }, contesto)
      if (!visto) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Reload the conversation: this message is not in it")
    }
    const [, quanti] = await this.listAndCountBattutas(filtroNuoviDopo(conversazione_id, visto) as never, { take: 1 }, contesto)
    return quanti
  }

  /**
   * Prepara una risposta del team, nella stessa transazione del messaggio e della conversazione. Lo stesso `id_client` è
   * la stessa risposta (stesso testo, stessa conversazione): un doppio clic o un nuovo tentativo la ritrovano e decidono con
   * `decidiInvio`. I messaggi del cliente arrivati dopo `ultimo_visto` restano non letti e la conversazione resta al team.
   */
  async preparaUscita(conversazione_id: string, uscita: Uscita): Promise<Preparata> {
    for (let tentativo = 0; ; tentativo += 1) {
      try {
        return await this.preparaInTransazione(conversazione_id, uscita)
      } catch (errore) {
        if (!unicita(errore) || tentativo >= 1) throw errore
      }
    }
  }

  @InjectTransactionManager()
  protected async preparaInTransazione(conversazione_id: string, { testo, id_client, autore, ultimo_visto }: Uscita, @MedusaContext() contesto: Context = {}): Promise<Preparata> {
    const conversazione = await this.retrieveConversazione(conversazione_id, {}, contesto)
    const chiave = chiaveUscita(id_client)
    const [esistente] = await this.listBattutas({ chiave_unica: chiave }, { take: 1 }, contesto)
    if (esistente) return this.riprendi(esistente, conversazione, testo, contesto)

    const stato = statoDopo(conversazione.stato, "uscita")
    const nonLetti = await this.nuoviDopo(conversazione_id, ultimo_visto, contesto)
    const messaggio = await this.createBattutas({
      conversazione_id,
      direzione: "uscita",
      testo,
      quando: new Date(),
      chiave_unica: chiave,
      stato_consegna: "in_coda",
      tentato_il: null,
      autore_id: autore.id,
      autore_nome: autore.nome,
    }, contesto)
    await this.updateConversaziones({
      id: conversazione_id,
      stato: nonLetti > 0 ? "aperta" : stato,
      non_letti: nonLetti,
      ultimo_messaggio_il: messaggio.quando,
      ultimo_estratto: estratto(testo),
    }, contesto)
    return { messaggio, decisione: "invia" }
  }

  /**
   * Risposta già vista con lo stesso id: resta nella sua conversazione e con il suo testo (al cliente arriva sempre quello
   * salvato). Fallita o interrotta prima del tentativo: torna in coda (mai su una conversazione chiusa). Interrotta dopo il
   * tentativo: diventa incerta e non si rimanda.
   */
  private async riprendi(messaggio: MessaggioDTO, conversazione: ConversazioneDTO, testo: string, contesto: Context): Promise<Preparata> {
    if (messaggio.conversazione_id !== conversazione.id || messaggio.testo !== testo) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "This message id was already used")
    }
    const decisione = decidiInvio(messaggio)
    if (decisione === "incerto" && messaggio.stato_consegna === "in_coda") {
      const incerto = await this.updateBattutas({ id: messaggio.id, stato_consegna: "incerto", errore: NON_CONFERMATO }, contesto)
      await this.updateConversaziones({ id: conversazione.id, stato: statoDopoFallimento(conversazione.stato) }, contesto)
      return { messaggio: incerto, decisione }
    }
    if (decisione !== "invia") return { messaggio, decisione }
    statoDopo(conversazione.stato, "uscita")
    const inCoda = await this.updateBattutas({ id: messaggio.id, stato_consegna: "in_coda", errore: null, tentato_il: null }, contesto)
    return { messaggio: inCoda, decisione }
  }

  /** Si sta per chiamare il canale: da qui una risposta rimasta in coda forse è arrivata. */
  async segnaTentativo(messaggio_id: string): Promise<void> {
    await this.updateBattutas({ id: messaggio_id, tentato_il: new Date() })
  }

  /** Esito dell'invio. Una risposta non consegnata (fallita o incerta) rimette la conversazione al team. */
  @InjectTransactionManager()
  async esitoUscita(messaggio_id: string, esito: EsitoUscita, @MedusaContext() contesto: Context = {}): Promise<void> {
    if (esito.stato === "inviato") {
      await this.updateBattutas({ id: messaggio_id, stato_consegna: "inviato", id_esterno: esito.id_esterno, errore: null }, contesto)
      return
    }
    const messaggio = await this.updateBattutas({ id: messaggio_id, stato_consegna: esito.stato, errore: esito.errore }, contesto)
    const conversazione = await this.retrieveConversazione(messaggio.conversazione_id, {}, contesto)
    await this.updateConversaziones({ id: conversazione.id, stato: statoDopoFallimento(conversazione.stato) }, contesto)
  }

  /**
   * Chiude o riapre. Una chiusura decisa davanti a una pagina rimasta indietro non nasconde i messaggi arrivati dopo:
   * non chiude e restituisce quanti sono (la rotta risponde 412).
   */
  async cambiaStato(id: string, stato: "aperta" | "chiusa", ultimo_visto: string | null = null): Promise<{ nuovi: number }> {
    await this.retrieveConversazione(id)
    if (stato === "chiusa") {
      const nuovi = await this.nuoviDopo(id, ultimo_visto)
      if (nuovi > 0) return { nuovi }
    }
    await this.updateConversaziones({ id, stato })
    return { nuovi: 0 }
  }

  /** Letta fino a `ultimo_visto`: i messaggi arrivati dopo restano da leggere. */
  async segnaLetta(id: string, ultimo_visto: string | null): Promise<void> {
    await this.retrieveConversazione(id)
    await this.updateConversaziones({ id, non_letti: await this.nuoviDopo(id, ultimo_visto) })
  }

  /** Collega (o scollega, con null) il contatto a un cliente del negozio: lo decide una persona del team. */
  async collegaCliente(identita_id: string, cliente_id: string | null): Promise<void> {
    await this.retrieveIdentita(identita_id)
    await this.updateIdentitas({ id: identita_id, cliente_id })
  }
}
