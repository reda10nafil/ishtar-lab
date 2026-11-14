import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { CONNECTORS_MODULE } from "../../connectors"
import { MESSAGGI_SITO } from "../canali/sito"
import { MESSAGGIO_INDIRIZZO, type RigaCasella } from "../canali/sito-regole"
import { CONVERSAZIONI_MODULE } from "../index"
import { elaboraSito, riceviDaSito } from "../ricezione-sito"
import type { InArrivo } from "../tipi"
import { avviaCasellaFinta, type CasellaFinta } from "./finti/casella"

const CHIAVE = "sb_secret_prova-lettura-5678"
const ANNA = "0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a"
const BRUNO = "1e8d7c6b-5a49-4382-8716-0a9b8c7d6e5f"

type Cursore = { uidvalidity: string; ultimo_uid: number }
type Guasti = { registraAl?: number; dopoRegistra?: (e: InArrivo) => void; cursore?: boolean }

/**
 * Contenitore finto con i soli servizi che la lettura usa. La registrazione imita la chiave unica del modulo
 * (canale:account:id_messaggio): un messaggio riletto non diventa un doppione.
 */
function contenitore(valori: Record<string, string> | null, { occupato = false }: { occupato?: boolean } = {}) {
  const unici = new Map<string, InArrivo>()
  const chiamate: InArrivo[] = []
  const errori: unknown[][] = []
  const registro: string[] = []
  const cursori = new Map<string, Cursore>()
  const guasti: Guasti = {}
  const scrivi = (riga: string) => { registro.push(riga) }
  const servizi: Record<string, unknown> = {
    [Modules.LOCKING]: {
      execute: async (_chiavi: string[], lavoro: () => Promise<unknown>) => {
        if (occupato) throw new Error("Timed-out acquiring lock: conversazioni:ricevi:sito")
        return lavoro()
      },
    },
    [CONNECTORS_MODULE]: {
      credenzialiCollegate: async (id: string) => (id === "chat_sito" && valori ? { valori, account: "locale" } : null),
      segnaErrore: async (...argomenti: unknown[]) => { errori.push(argomenti) },
    },
    [CONVERSAZIONI_MODULE]: {
      registraInArrivo: async (e: InArrivo) => {
        chiamate.push(e)
        if (guasti.registraAl && chiamate.length === guasti.registraAl) throw new Error(`insert failed: ${e.testo} ${e.recapito} ${e.nome}`)
        const chiave = `${e.canale}:${e.account}:${e.id_messaggio}`
        const nuovo = !unici.has(chiave)
        if (nuovo) unici.set(chiave, e)
        guasti.dopoRegistra?.(e)
        return { conversazione_id: "conv_1", messaggio_id: chiave, nuovo }
      },
      leggiCursore: async (canale: string, account: string, cartella: string) => {
        if (guasti.cursore) throw new Error("cursor table down")
        return cursori.get(`${canale}|${account}|${cartella}`) ?? null
      },
      salvaCursore: async (canale: string, account: string, cartella: string, valore: Cursore) => { cursori.set(`${canale}|${account}|${cartella}`, valore) },
    },
    [ContainerRegistrationKeys.LOGGER]: { info: scrivi, warn: scrivi, error: scrivi },
  }
  return { container: { resolve: (chiave: string) => servizi[chiave] } as never, registrati: () => [...unici.values()], chiamate, errori, registro, cursori, guasti }
}

describe("lettura della chat del sito (casella finta)", () => {
  let casella: CasellaFinta
  const prima = { prove: process.env.SITO_PROVE_LOCALI, istanza: process.env.ISHTAR_INSTANCE_ID }
  beforeAll(() => {
    process.env.SITO_PROVE_LOCALI = "1"
    process.env.ISHTAR_INSTANCE_ID = "ishtar-lab-redx"
  })
  afterAll(() => {
    for (const [nome, valore] of [["SITO_PROVE_LOCALI", prima.prove], ["ISHTAR_INSTANCE_ID", prima.istanza]] as const) {
      if (valore === undefined) delete process.env[nome]
      else process.env[nome] = valore
    }
  })
  beforeEach(async () => { casella = await avviaCasellaFinta({ chiave: CHIAVE }) })
  afterEach(async () => { await casella.chiudi() })
  const valori = (extra: Record<string, string> = {}) => ({ url: casella.base, chiave: CHIAVE, nome: "Ishtar Hub", ...extra })
  const conta = (nome: string) => casella.chiamate.filter((n) => n === nome).length

  it("due messaggi registrati in ordine e confermati una volta sola", async () => {
    const a = casella.aggiungiDalVisitatore({ visitatore: ANNA, testo: "Avete l'abito verde?", nome: "Anna", email: "Anna@Example.com", pagina: "https://negozio.example/abiti?utm=x" })
    const b = casella.aggiungiDalVisitatore({ visitatore: BRUNO, testo: "Spedite in Svizzera?" })
    const c = contenitore(valori())
    expect(await riceviDaSito(c.container, { giri: 2, attesa: 0 })).toBe("fatto")
    expect(c.registrati().map((e) => [e.canale, e.account, e.id_contatto, e.id_messaggio, e.testo, e.nome, e.recapito])).toEqual([
      ["sito", "locale", ANNA, a.id, "Avete l'abito verde?", "Anna", "anna@example.com"],
      ["sito", "locale", BRUNO, b.id, "Spedite in Svizzera?", null, null],
    ])
    expect(c.registrati()[0].dettagli).toEqual({ pagina: "https://negozio.example/abiti", dichiarato: true })
    expect(casella.messaggi.every((m) => m.importato_il)).toBe(true)
    expect([conta("chat_preleva"), conta("chat_conferma")]).toEqual([2, 1])
    expect(c.errori).toEqual([])
  })

  it("lettura ripetuta: niente doppioni e sempre lo stesso lettore, scelto una volta e salvato", async () => {
    casella.aggiungiDalVisitatore({ visitatore: ANNA, testo: "Ciao" })
    const c = contenitore(valori())
    expect(await riceviDaSito(c.container, { giri: 1, attesa: 0 })).toBe("fatto")
    const lettore = casella.negozio.lettore
    expect(lettore).toMatch(/^ishtar-lab-redx-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    casella.aggiungiDalVisitatore({ visitatore: ANNA, testo: "Ci sei?" })
    expect(await riceviDaSito(c.container, { giri: 1, attesa: 0 })).toBe("fatto")
    expect(casella.negozio.lettore).toBe(lettore)
    expect(c.registrati().map((e) => e.testo)).toEqual(["Ciao", "Ci sei?"])
    expect(c.chiamate).toHaveLength(2)
    expect(c.cursori.size).toBe(1)
  })

  it("caduta fra registrazione e conferma: al giro dopo si rilegge e la chiave unica evita il doppione", async () => {
    casella.aggiungiDalVisitatore({ visitatore: ANNA, testo: "Primo" })
    casella.aggiungiDalVisitatore({ visitatore: BRUNO, testo: "Secondo" })
    const c = contenitore(valori())
    c.guasti.dopoRegistra = () => { casella.guasti = { stato: 503 } }
    expect(await riceviDaSito(c.container, { giri: 1, attesa: 0 })).toBe("errore")
    expect(casella.messaggi.filter((m) => !m.importato_il)).toHaveLength(2)
    expect(c.registro.join("\n")).toContain(MESSAGGI_SITO.servizio)
    expect(c.errori).toEqual([])
    c.guasti.dopoRegistra = undefined
    casella.guasti = {}
    expect(await riceviDaSito(c.container, { giri: 1, attesa: 0 })).toBe("fatto")
    expect(c.chiamate).toHaveLength(4)
    expect(c.registrati().map((e) => e.testo)).toEqual(["Primo", "Secondo"])
    expect(casella.messaggi.every((m) => m.importato_il)).toBe(true)
  })

  it("conferma persa per strada: il messaggio resta registrato una volta e la lettura riprende", async () => {
    casella.aggiungiDalVisitatore({ visitatore: ANNA, testo: "Ciao" })
    casella.guasti = { confermaPersa: true }
    const c = contenitore(valori())
    expect(await riceviDaSito(c.container, { giri: 2, attesa: 0 })).toBe("errore")
    expect(c.registro.join("\n")).toContain(MESSAGGI_SITO.rete)
    casella.guasti = {}
    expect(await riceviDaSito(c.container, { giri: 1, attesa: 0 })).toBe("fatto")
    expect(c.registrati()).toHaveLength(1)
    expect(c.errori).toEqual([])
  })

  it("errore del database a metà: i messaggi prima sono confermati, il resto resta da importare; nel registro nessun dato", async () => {
    for (const testo of ["Uno", "Due", "Tre"]) casella.aggiungiDalVisitatore({ visitatore: ANNA, testo, nome: "Annalisa", email: "annalisa@example.com" })
    const c = contenitore(valori())
    c.guasti.registraAl = 2
    expect(await riceviDaSito(c.container, { giri: 3, attesa: 0 })).toBe("errore")
    expect(c.registrati().map((e) => e.testo)).toEqual(["Uno"])
    expect(casella.messaggi.filter((m) => m.importato_il).map((m) => m.testo)).toEqual(["Uno"])
    expect(conta("chat_preleva")).toBe(1)
    const registro = c.registro.join("\n")
    for (const dato of ["Due", "Tre", "annalisa@example.com", "Annalisa", CHIAVE]) expect(registro).not.toContain(dato)
    c.guasti.registraAl = 0
    expect(await riceviDaSito(c.container, { giri: 1, attesa: 0 })).toBe("fatto")
    expect(c.registrati().map((e) => e.testo)).toEqual(["Uno", "Due", "Tre"])
  })

  it("chiave rifiutata: connettore in errore con i valori usati, chiave mai nel registro, nessun altro giro", async () => {
    const usati = valori({ chiave: "sb_secret_sbagliata-segreta-99" })
    const c = contenitore(usati)
    expect(await riceviDaSito(c.container, { giri: 3, attesa: 0 })).toBe("errore")
    expect(c.errori).toEqual([["chat_sito", MESSAGGI_SITO.credenziali, usati]])
    expect(c.registro.join("\n")).not.toContain("sbagliata-segreta-99")
    expect(casella.chiamate).toEqual(["chat_preleva"])
  })

  it("un altro Ishtar Lab legge la casella: connettore in errore, i messaggi restano all'altro", async () => {
    casella.aggiungiDalVisitatore({ visitatore: ANNA, testo: "Ciao" })
    casella.negozio.lettore = "altro-ishtar-lab"
    casella.negozio.battito = new Date().toISOString()
    const c = contenitore(valori())
    expect(await riceviDaSito(c.container, { giri: 2, attesa: 0 })).toBe("errore")
    expect(c.errori).toEqual([["chat_sito", MESSAGGI_SITO.lettore, valori()]])
    expect(c.registrati()).toEqual([])
    expect(casella.negozio.lettore).toBe("altro-ishtar-lab")
  })

  it("progetto senza l'SQL della chat: connettore in errore con l'invito a eseguirlo", async () => {
    casella.guasti = { assenti: ["chat_preleva"] }
    const c = contenitore(valori())
    expect(await riceviDaSito(c.container, { giri: 1, attesa: 0 })).toBe("errore")
    expect(c.errori).toEqual([["chat_sito", MESSAGGI_SITO.versione, valori()]])
  })

  it("indirizzo salvato non più ammesso (casella locale fuori dalle prove): connettore in errore, nessuna chiamata", async () => {
    const c = contenitore(valori())
    delete process.env.SITO_PROVE_LOCALI
    try {
      expect(await riceviDaSito(c.container, { giri: 1, attesa: 0 })).toBe("errore")
    } finally {
      process.env.SITO_PROVE_LOCALI = "1"
    }
    expect(c.errori).toEqual([["chat_sito", MESSAGGIO_INDIRIZZO, valori()]])
    expect(casella.chiamate).toEqual([])
  })

  it("guasto del database sul lettore: la lettura fallisce senza toccare il connettore né la casella", async () => {
    const c = contenitore(valori())
    c.guasti.cursore = true
    await expect(riceviDaSito(c.container, { giri: 1, attesa: 0 })).rejects.toThrow("cursor table down")
    expect(c.errori).toEqual([])
    expect(casella.chiamate).toEqual([])
  })

  it("senza connettore non legge; con il lucchetto preso da un'altra lettura nemmeno", async () => {
    expect(await riceviDaSito(contenitore(null).container, { giri: 1, attesa: 0 })).toBe("spento")
    expect(await riceviDaSito(contenitore(valori(), { occupato: true }).container, { giri: 1, attesa: 0 })).toBe("occupato")
    expect(casella.chiamate).toEqual([])
  })

  it("i giri sono distanziati di `attesa` secondi", async () => {
    const c = contenitore(valori())
    const inizio = Date.now()
    expect(await riceviDaSito(c.container, { giri: 3, attesa: 0.05 })).toBe("fatto")
    expect(Date.now() - inizio).toBeGreaterThanOrEqual(90)
    expect(conta("chat_preleva")).toBe(3)
  })

  it("elaboraSito: righe senza gli identificativi della casella scartate e mai confermate; al primo errore si ferma", async () => {
    const riga = (id: string, testo: string): RigaCasella => ({ id, visitatore: ANNA, testo, creato_il: "2026-11-14T10:00:00Z" })
    const buona = "5f0e9d8c-7b6a-4594-8382-716253443526"
    const seconda = "6a1f0e9d-8c7b-4a69-8584-736251404938"
    const registrati: string[] = []
    const confermati: string[][] = []
    const conferma = async (ids: string[]) => { confermati.push(ids); return ids.length }
    expect(await elaboraSito([riga("non-un-uuid", "x"), riga(buona, "buona")], { rif: "locale", registra: async (e) => { registrati.push(e.testo) }, conferma }))
      .toEqual({ registrati: 1, scartati: 1, errore: null })
    expect(confermati).toEqual([[buona]])
    const guasto = new Error("db")
    expect(await elaboraSito([riga(buona, "a"), riga(seconda, "b")], { rif: "locale", registra: async (e) => { if (e.testo === "b") throw guasto }, conferma }))
      .toEqual({ registrati: 1, scartati: 0, errore: guasto })
    expect(confermati[1]).toEqual([buona])
    confermati.length = 0
    expect(await elaboraSito([riga(buona, "a")], { rif: "locale", registra: async () => { throw guasto }, conferma })).toEqual({ registrati: 0, scartati: 0, errore: guasto })
    expect(confermati).toEqual([])
  })
})
