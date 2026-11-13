import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import MailComposer from "nodemailer/lib/mail-composer"
import { CONNECTORS_MODULE } from "../../connectors"
import { CONVERSAZIONI_MODULE } from "../index"
import { riceviDaEmail } from "../ricezione-email"
import type { InArrivo } from "../tipi"
import { avviaImapFinto, type ImapFinto } from "./finti/imap"

const CASELLA = "negozio@ishtar.example"
const SEGRETO = "SEGRETO-di-prova-job"
const componi = (opzioni: Record<string, unknown>): Promise<Buffer> => new MailComposer(opzioni as never).compile().build()
const email = (n: number) =>
  componi({ from: `Cliente ${n} <cliente${n}@example.com>`, to: CASELLA, subject: `Domanda ${n}`, messageId: `<m${n}@example.com>`, text: `Testo ${n}` })

type Cursore = { uidvalidity: string; ultimo_uid: number }

/** Contenitore finto con i soli servizi che la lettura usa: lucchetti, connettori, conversazioni e registro. */
function contenitore(valori: Record<string, string> | null, { occupato = false, guastoRegistra = false } = {}) {
  let cursore: Cursore | null = null
  const registrati: InArrivo[] = []
  const errori: unknown[][] = []
  const registro: string[] = []
  const scrivi = (riga: string) => { registro.push(riga) }
  const servizi: Record<string, unknown> = {
    [Modules.LOCKING]: {
      execute: async (_chiavi: string[], lavoro: () => Promise<unknown>) => {
        if (occupato) throw new Error("Timed-out acquiring lock: conversazioni:ricevi:email")
        return lavoro()
      },
    },
    [CONNECTORS_MODULE]: {
      credenzialiCollegate: async (id: string) => (id === "casella_email" && valori ? { valori, account: valori.indirizzo } : null),
      segnaErrore: async (...argomenti: unknown[]) => { errori.push(argomenti) },
    },
    [CONVERSAZIONI_MODULE]: {
      leggiCursore: async () => cursore,
      salvaCursore: async (_canale: string, _account: string, _cartella: string, valore: Cursore) => { cursore = valore },
      registraInArrivo: async (e: InArrivo) => {
        if (guastoRegistra) throw new Error(`insert failed for ${e.id_contatto}: ${e.testo}`)
        registrati.push(e)
      },
      segnaRimbalzo: async () => false,
    },
    [ContainerRegistrationKeys.LOGGER]: { info: scrivi, warn: scrivi, error: scrivi },
  }
  return { container: { resolve: (chiave: string) => servizi[chiave] } as never, registrati, errori, registro, cursore: () => cursore }
}

describe("job di lettura della casella email", () => {
  let imap: ImapFinto
  const prima = process.env.EMAIL_PROVE_LOCALI
  beforeAll(() => { process.env.EMAIL_PROVE_LOCALI = "1" })
  afterAll(() => { if (prima === undefined) delete process.env.EMAIL_PROVE_LOCALI; else process.env.EMAIL_PROVE_LOCALI = prima })
  beforeEach(async () => { imap = await avviaImapFinto({ utente: CASELLA, password: SEGRETO }) })
  afterEach(async () => { await imap.chiudi() })
  const valori = (extra: Record<string, string> = {}) => ({
    indirizzo: CASELLA, password: SEGRETO, imap_host: "127.0.0.1", imap_porta: String(imap.porta), smtp_host: "127.0.0.1", smtp_porta: "1", ...extra,
  })

  it("primo giro: segna il punto di partenza senza importare; il giro dopo registra solo le email nuove", async () => {
    imap.aggiungi(await email(1))
    const c = contenitore(valori())
    expect(await riceviDaEmail(c.container)).toBe("fatto")
    expect(c.registrati).toEqual([])
    expect(c.cursore()).toEqual({ uidvalidity: "1700000000", ultimo_uid: 1 })
    imap.aggiungi(await email(2))
    expect(await riceviDaEmail(c.container)).toBe("fatto")
    expect(c.registrati.map((e) => [e.id_messaggio, e.account, e.testo])).toEqual([["<m2@example.com>", CASELLA, "Testo 2"]])
    expect(c.cursore()).toEqual({ uidvalidity: "1700000000", ultimo_uid: 2 })
  })

  it("password sbagliata: connettore in errore con il testo fisso, password mai nel registro", async () => {
    const usati = valori({ password: "sbagliata-segreta-42" })
    const c = contenitore(usati)
    expect(await riceviDaEmail(c.container)).toBe("errore")
    expect(c.errori).toEqual([["casella_email", "The mailbox refused the username or password", usati]])
    expect(c.registro.join("\n")).not.toContain("sbagliata-segreta-42")
    expect(c.cursore()).toBeNull()
  })

  it("server irraggiungibile o nome che non si risolve: connettore non toccato, si riprova al giro dopo", async () => {
    const chiuso = contenitore(valori({ imap_porta: "1" }))
    expect(await riceviDaEmail(chiuso.container)).toBe("errore")
    expect(chiuso.errori).toEqual([])
    expect(chiuso.registro).toEqual(["Customer inbox, email: The mail server can't be reached"])
    const dns = contenitore(valori({ imap_host: "imap.esempio.example", imap_porta: "993" }))
    expect(await riceviDaEmail(dns.container, { risolvi: async () => { throw new Error("ENOTFOUND") } })).toBe("errore")
    expect(dns.errori).toEqual([])
  })

  it("server non pubblico: configurazione da correggere, connettore in errore", async () => {
    const c = contenitore(valori({ imap_host: "10.0.0.5", imap_porta: "993" }))
    expect(await riceviDaEmail(c.container)).toBe("errore")
    expect(c.errori).toEqual([["casella_email", "This server is not reachable on the public internet", expect.any(Object)]])
  })

  it("accesso rifiutato per un guasto passeggero (UNAVAILABLE): connettore non toccato, si riprova al giro dopo", async () => {
    imap.guasti.loginTemporaneo = true
    const c = contenitore(valori())
    expect(await riceviDaEmail(c.container)).toBe("errore")
    expect(c.errori).toEqual([])
    expect(c.registro).toEqual(["Customer inbox, email: The mail server is busy: try again later"])
  })

  it("email che non si legge e non ha busta: saltata con un avviso nel registro, la lettura continua", async () => {
    const c = contenitore(valori())
    expect(await riceviDaEmail(c.container)).toBe("fatto")
    imap.aggiungi(await email(2))
    imap.aggiungi(await email(3))
    imap.guasti.fetchSenza = [1]
    expect(await riceviDaEmail(c.container)).toBe("fatto")
    expect(c.registrati.map((e) => e.id_messaggio)).toEqual(["<m3@example.com>"])
    expect(c.registro).toEqual(["Customer inbox, email: 1 email could not be read and was skipped"])
    expect(c.cursore()).toEqual({ uidvalidity: "1700000000", ultimo_uid: 2 })
  })

  it("verifica DMARC con il server della casella scelto nel connettore", async () => {
    const c = contenitore(valori({ server_verifica: "mx.example.org" }))
    await riceviDaEmail(c.container)
    imap.aggiungi(Buffer.from([
      "Authentication-Results: mx.example.org; dmarc=pass header.from=example.com", "From: Cliente <cliente@example.com>", `To: ${CASELLA}`,
      "Subject: Ordine", "Message-ID: <v1@example.com>", "", "Ciao", "",
    ].join("\r\n")))
    await riceviDaEmail(c.container)
    expect(c.registrati[0]?.dettagli).toMatchObject({ verifica: "verificato" })
  })

  it("nessuna casella collegata: spento; lettura già in corso: occupato", async () => {
    expect(await riceviDaEmail(contenitore(null).container)).toBe("spento")
    expect(await riceviDaEmail(contenitore(valori(), { occupato: true }).container)).toBe("occupato")
  })

  it("registrazione non riuscita: nel registro solo il tipo dell'errore, cursore fermo", async () => {
    const c = contenitore(valori(), { guastoRegistra: true })
    expect(await riceviDaEmail(c.container)).toBe("fatto")
    imap.aggiungi(await email(2))
    expect(await riceviDaEmail(c.container)).toBe("errore")
    expect(c.registro).toEqual(["Customer inbox, email: a message was not saved and will be read again (Error)"])
    expect(c.cursore()).toEqual({ uidvalidity: "1700000000", ultimo_uid: 0 })
  })
})
