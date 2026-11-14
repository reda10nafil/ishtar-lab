import { Modules } from "@medusajs/framework/utils"
import { CONNECTORS_MODULE } from "../../connectors"
import { MESSAGGI_SITO } from "../canali/sito"
import { CONVERSAZIONI_MODULE } from "../index"
import { inviaRisposta } from "../invio"
import { decidiInvio } from "../regole"
import { NON_CONFERMATO } from "../service"
import type { StatoConsegna } from "../tipi"
import { avviaCasellaFinta, type CasellaFinta } from "./finti/casella"

const CHIAVE = "sb_secret_prova-invio-4321"
const VISITATORE = "0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a"
const ID = "8f14e45f-ceea-467f-a8f5"

type Salvato = { id: string; conversazione_id: string; testo: string; chiave_unica: string; stato_consegna: StatoConsegna; tentato_il: Date | null; errore?: string | null; id_esterno?: string | null }

/**
 * Contenitore finto: lucchetto vero per chiave (le chiamate con la stessa chiave si mettono in fila) e una sola risposta
 * salvata, decisa con la regola vera del modulo (`decidiInvio`) come fa `preparaUscita`.
 */
function contenitore(valori: Record<string, string> | null, { alTentativo }: { alTentativo?: () => void } = {}) {
  const chiamate: string[] = []
  const errori: unknown[][] = []
  const esiti: Record<string, unknown>[] = []
  let salvato: Salvato | null = null
  const code = new Map<string, Promise<unknown>>()
  const servizi: Record<string, unknown> = {
    [Modules.LOCKING]: {
      execute: async (chiavi: string[], lavoro: () => Promise<unknown>) => {
        const chiave = chiavi.join("|")
        const prima = code.get(chiave) ?? Promise.resolve()
        let libera = () => {}
        const mia = new Promise<void>((ok) => { libera = ok })
        code.set(chiave, prima.then(() => mia))
        await prima
        try {
          return await lavoro()
        } finally {
          libera()
        }
      },
    },
    [CONNECTORS_MODULE]: {
      credenzialiCollegate: async (id: string) => (id === "chat_sito" && valori ? { valori, account: "locale" } : null),
      segnaErrore: async (...argomenti: unknown[]) => { errori.push(argomenti) },
    },
    [CONVERSAZIONI_MODULE]: {
      preparaUscita: async (conversazione_id: string, u: { testo: string; id_client: string }) => {
        if (!salvato) {
          salvato = { id: "msgc_1", conversazione_id, testo: u.testo, chiave_unica: `uscita:${u.id_client}`, stato_consegna: "in_coda", tentato_il: null }
          return { messaggio: { ...salvato }, decisione: "invia" }
        }
        const decisione = decidiInvio(salvato)
        if (decisione === "invia") Object.assign(salvato, { stato_consegna: "in_coda", tentato_il: null, errore: null })
        return { messaggio: { ...salvato }, decisione }
      },
      retrieveConversazione: async () => ({ id: "conv_1", canale: "sito", oggetto: null, identita: { id_contatto: VISITATORE } }),
      segnaTentativo: async () => { alTentativo?.(); chiamate.push("tentativo"); salvato!.tentato_il = new Date() },
      esitoUscita: async (_id: string, esito: Record<string, unknown>) => {
        chiamate.push(`esito:${esito.stato}`)
        esiti.push(esito)
        Object.assign(salvato!, { stato_consegna: esito.stato, errore: esito.errore ?? null, id_esterno: esito.id_esterno ?? null })
      },
      retrieveBattuta: async () => ({ ...salvato }),
    },
  }
  return { container: { resolve: (chiave: string) => servizi[chiave] } as never, chiamate, errori, esiti, salvato: () => salvato }
}

describe("risposte del team nella chat del sito (casella finta)", () => {
  let casella: CasellaFinta
  const prima = process.env.SITO_PROVE_LOCALI
  beforeAll(() => { process.env.SITO_PROVE_LOCALI = "1" })
  afterAll(() => { if (prima === undefined) delete process.env.SITO_PROVE_LOCALI; else process.env.SITO_PROVE_LOCALI = prima })
  beforeEach(async () => {
    casella = await avviaCasellaFinta({ chiave: CHIAVE })
    casella.aggiungiDalVisitatore({ visitatore: VISITATORE, testo: "Avete l'abito verde?" })
  })
  afterEach(async () => { await casella.chiudi() })
  const valori = (extra: Record<string, string> = {}) => ({ url: casella.base, chiave: CHIAVE, nome: "  Ishtar Hub  ", ...extra })
  const uscita = { testo: "Sì, in taglia S e M.", id_client: ID, autore: { id: "user_1", nome: "Giulia" }, ultimo_visto: null }
  const risposte = () => casella.messaggi.filter((m) => m.direzione === "uscita")

  it("risposta consegnata una volta, con il testo salvato e la firma del connettore; id esterno = id della casella", async () => {
    // Il tentativo si segna prima di chiamare la casella: un arresto durante la chiamata lascia la risposta «forse arrivata».
    const allaChiamata: number[] = []
    const c = contenitore(valori(), { alTentativo: () => { allaChiamata.push(casella.chiamate.length) } })
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(allaChiamata).toEqual([0])
    expect(casella.chiamate).toEqual(["chat_rispondi"])
    expect(c.chiamate).toEqual(["tentativo", "esito:inviato"])
    expect(risposte()).toHaveLength(1)
    expect(risposte()[0]).toMatchObject({ visitatore: VISITATORE, id_client: ID, testo: "Sì, in taglia S e M.", firma: "Ishtar Hub" })
    expect(c.esiti).toEqual([{ stato: "inviato", id_esterno: risposte()[0].id }])
  })

  it("senza firma nel connettore la risposta parte senza firma", async () => {
    const c = contenitore(valori({ nome: "   " }))
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(risposte()[0].firma).toBeNull()
  })

  it("caduta dopo la scrittura: incerta (mai rimandata con lo stesso id), e la casella la contiene una volta", async () => {
    casella.guasti = { cadeDopoScrittura: true }
    const c = contenitore(valori())
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.esiti).toEqual([{ stato: "incerto", errore: NON_CONFERMATO }])
    casella.guasti = {}
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.chiamate).toEqual(["tentativo", "esito:incerto"])
    expect(risposte()).toHaveLength(1)
  })

  it("servizio in errore prima della scrittura: incerta; dopo «fallita» il nuovo tentativo con lo stesso id parte una volta", async () => {
    casella.guasti = { stato: 503 }
    const c = contenitore(valori())
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.esiti).toEqual([{ stato: "incerto", errore: NON_CONFERMATO }])
    expect(risposte()).toHaveLength(0)
    // La riconciliazione (job di lettura) la segna «fallita» dopo 2 minuti senza trovarla: si può ritentare.
    Object.assign(c.salvato()!, { stato_consegna: "fallito", errore: "Not sent" })
    casella.guasti = {}
    await inviaRisposta(c.container, "conv_1", uscita)
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(risposte()).toHaveLength(1)
    expect(c.salvato()).toMatchObject({ stato_consegna: "inviato", id_esterno: risposte()[0].id })
  })

  it("un nuovo tentativo su una risposta che era arrivata ritrova la stessa nella casella (mai un doppione)", async () => {
    casella.guasti = { cadeDopoScrittura: true }
    const c = contenitore(valori())
    await inviaRisposta(c.container, "conv_1", uscita)
    const scritta = risposte()[0]
    Object.assign(c.salvato()!, { stato_consegna: "fallito" })
    casella.guasti = {}
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(risposte()).toEqual([scritta])
    expect(c.salvato()).toMatchObject({ stato_consegna: "inviato", id_esterno: scritta.id })
  })

  it("chiave rifiutata: fallita e connettore in errore con i valori usati", async () => {
    const usati = valori({ chiave: "sb_secret_sbagliata-segreta-7" })
    const c = contenitore(usati)
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.esiti).toEqual([{ stato: "fallito", errore: MESSAGGI_SITO.credenziali }])
    expect(c.errori).toEqual([["chat_sito", MESSAGGI_SITO.credenziali, usati]])
  })

  it("visitatore non più nella casella: fallita con il motivo, connettore intatto", async () => {
    casella.visitatori.clear()
    const c = contenitore(valori())
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.esiti).toEqual([{ stato: "fallito", errore: "The visitor is no longer in the site chat" }])
    expect(c.errori).toEqual([])
  })

  it("progetto senza l'SQL della chat: fallita, connettore in errore", async () => {
    casella.guasti = { assenti: ["chat_rispondi"] }
    const c = contenitore(valori())
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.esiti).toEqual([{ stato: "fallito", errore: MESSAGGI_SITO.versione }])
    expect(c.errori).toEqual([["chat_sito", MESSAGGI_SITO.versione, valori()]])
  })

  it("chat del sito non collegata: fallita «Site chat is not connected», nessun tentativo", async () => {
    const c = contenitore(null)
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.chiamate).toEqual(["esito:fallito"])
    expect(c.esiti).toEqual([{ stato: "fallito", errore: "Site chat is not connected" }])
    expect(casella.chiamate).toEqual([])
  })

  it("doppio invio dello stesso id insieme: una sola chiamata alla casella, una sola risposta", async () => {
    const c = contenitore(valori())
    await Promise.all([inviaRisposta(c.container, "conv_1", uscita), inviaRisposta(c.container, "conv_1", uscita)])
    expect(casella.chiamate.filter((n) => n === "chat_rispondi")).toHaveLength(1)
    expect(risposte()).toHaveLength(1)
    expect(c.chiamate).toEqual(["tentativo", "esito:inviato"])
  })
})
