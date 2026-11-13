import PostalMime from "postal-mime"
import { credenzialiEmail, provaCasella } from "../canali/email-connessioni"
import { inviaEmail, type RispostaEmail } from "../canali/email-smtp"
import { NON_CONFERMATO } from "../service"
import { avviaImapFinto } from "./finti/imap"
import { avviaSmtpFinto, type SmtpFinto } from "./finti/smtp"

const CASELLA = "negozio@ishtar.example"
const SEGRETO = "SEGRETO-di-prova-smtp"
const RISPOSTA: RispostaEmail = {
  a: "cliente@example.com",
  oggetto: "Re: Ordine 12",
  testo: "Il pacco parte domani.",
  messageId: "<crm.r1-abcdefgh@ishtar.example>",
  inReplyTo: "<abc@example.com>",
  references: ["<x@example.com>", "<abc@example.com>"],
}

describe("invio delle risposte email (SMTP finto)", () => {
  let smtp: SmtpFinto
  const prima = process.env.EMAIL_PROVE_LOCALI
  beforeAll(() => { process.env.EMAIL_PROVE_LOCALI = "1" })
  afterAll(() => { if (prima === undefined) delete process.env.EMAIL_PROVE_LOCALI; else process.env.EMAIL_PROVE_LOCALI = prima })
  beforeEach(async () => { smtp = await avviaSmtpFinto({ utente: CASELLA, password: SEGRETO }) })
  afterEach(async () => { await smtp.chiudi() })
  const cred = (extra: Record<string, string> = {}) =>
    credenzialiEmail({ indirizzo: CASELLA, nome: "Negozio Ishtar", password: SEGRETO, imap_host: "127.0.0.1", imap_porta: "1", smtp_host: "127.0.0.1", smtp_porta: String(smtp.porta), ...extra })

  it("consegna nello stesso filo: From della casella, In-Reply-To, References, un solo «Re:», Message-ID nostro", async () => {
    const primaDellInvio = jest.fn(async () => {})
    expect(await inviaEmail(cred(), RISPOSTA, { primaDellInvio })).toEqual({ esito: { stato: "inviato", id_esterno: RISPOSTA.messageId } })
    expect(primaDellInvio).toHaveBeenCalledTimes(1)
    expect(smtp.consegne).toHaveLength(1)
    expect(smtp.consegne[0]).toMatchObject({ da: CASELLA, a: ["cliente@example.com"] })
    const email = await PostalMime.parse(smtp.consegne[0].grezzo)
    expect(email).toMatchObject({
      subject: "Re: Ordine 12",
      messageId: RISPOSTA.messageId,
      inReplyTo: "<abc@example.com>",
      references: "<x@example.com> <abc@example.com>",
      from: { name: "Negozio Ishtar", address: CASELLA },
    })
    expect(email.text?.trim()).toBe("Il pacco parte domani.")
    expect(email.replyTo).toBeUndefined()
  })

  it("indirizzo rifiutato (RCPT 550): fallito con la risposta del server, nessun tentativo segnato", async () => {
    smtp.modo = "rcpt550"
    const primaDellInvio = jest.fn(async () => {})
    expect(await inviaEmail(cred(), RISPOSTA, { primaDellInvio })).toEqual({ esito: { stato: "fallito", errore: "The mail server refused the email: 550 5.1.1 User unknown" } })
    expect(primaDellInvio).not.toHaveBeenCalled()
    expect(smtp.consegne).toEqual([])
  })

  it("contenuto rifiutato dopo DATA (554): fallito, il server ha risposto chiaramente", async () => {
    smtp.modo = "dati554"
    const primaDellInvio = jest.fn(async () => {})
    expect(await inviaEmail(cred(), RISPOSTA, { primaDellInvio })).toEqual({ esito: { stato: "fallito", errore: "The mail server refused the email: 554 5.7.1 Message rejected" } })
    expect(primaDellInvio).toHaveBeenCalledTimes(1)
  })

  it("connessione caduta dopo il contenuto: incerto, forse arrivata", async () => {
    smtp.modo = "cadeDopoDati"
    expect(await inviaEmail(cred(), RISPOSTA, { primaDellInvio: async () => {} })).toEqual({ esito: { stato: "incerto", errore: NON_CONFERMATO } })
  })

  it("server irraggiungibile: fallito, nessun tentativo, connettore non toccato", async () => {
    const primaDellInvio = jest.fn(async () => {})
    expect(await inviaEmail(cred({ smtp_porta: "1" }), RISPOSTA, { primaDellInvio })).toEqual({ esito: { stato: "fallito", errore: "The mail server can't be reached" } })
    expect(primaDellInvio).not.toHaveBeenCalled()
  })

  it("nome del server che oggi non si risolve: fallito, connettore non toccato (può passare da solo)", async () => {
    const risolvi = async () => { throw new Error("ENOTFOUND") }
    expect(await inviaEmail(cred({ smtp_host: "smtp.esempio.example", smtp_porta: "465" }), RISPOSTA, { primaDellInvio: async () => {}, risolvi })).toEqual({
      esito: { stato: "fallito", errore: "The mail server can't be reached" },
    })
  })

  it("password sbagliata: fallito con il testo fisso, connettore da segnalare, password mai nell'esito", async () => {
    const esito = await inviaEmail(cred({ password: "sbagliata-segreta-7" }), RISPOSTA, { primaDellInvio: async () => {} })
    expect(esito).toEqual({
      esito: { stato: "fallito", errore: "The mailbox refused the username or password" },
      daSegnalare: "The mailbox refused the username or password",
    })
    expect(JSON.stringify(esito)).not.toContain("sbagliata-segreta-7")
  })

  it("accesso rifiutato per un guasto passeggero (454): fallito, connettore non toccato", async () => {
    smtp.modo = "auth454"
    expect(await inviaEmail(cred(), RISPOSTA, { primaDellInvio: async () => {} })).toEqual({ esito: { stato: "fallito", errore: "The mail server is busy: try again later" } })
  })

  it("server che chiude prima del saluto: mai «password rifiutata», né nell'invio né nella prova della casella", async () => {
    smtp.modo = "chiudeSubito"
    expect(await inviaEmail(cred(), RISPOSTA, { primaDellInvio: async () => {} })).toEqual({ esito: { stato: "fallito", errore: "The mail server can't be reached" } })
    const imap = await avviaImapFinto({ utente: CASELLA, password: SEGRETO })
    try {
      expect(await provaCasella({ indirizzo: CASELLA, password: SEGRETO, imap_host: "127.0.0.1", imap_porta: String(imap.porta), smtp_host: "127.0.0.1", smtp_porta: String(smtp.porta) }))
        .toEqual({ ok: false, errore: "The mail server can't be reached" })
    } finally {
      await imap.chiudi()
    }
  })

  it("server non pubblico: fallito e connettore da segnalare", async () => {
    expect(await inviaEmail(cred({ smtp_host: "10.0.0.5", smtp_porta: "465" }), RISPOSTA, { primaDellInvio: async () => {} })).toEqual({
      esito: { stato: "fallito", errore: "This server is not reachable on the public internet" },
      daSegnalare: "This server is not reachable on the public internet",
    })
  })

  it("errore nel segnare il tentativo: si lancia (nulla è partito) e il server non riceve il contenuto", async () => {
    await expect(inviaEmail(cred(), RISPOSTA, { primaDellInvio: async () => { throw new Error("database giù") } })).rejects.toThrow("database giù")
    expect(smtp.consegne).toEqual([])
  })

  it("oggetto con a capo (viene dall'email del cliente): nessuna intestazione aggiunta, un solo destinatario", async () => {
    await inviaEmail(cred(), { ...RISPOSTA, oggetto: "Re: a\r\nBcc: spia@example.com" }, { primaDellInvio: async () => {} })
    expect(smtp.consegne[0].a).toEqual(["cliente@example.com"])
    expect(smtp.consegne[0].grezzo).not.toMatch(/^Bcc:/im)
  })
})
