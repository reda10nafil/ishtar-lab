import { eseguiProva } from "../../connectors/prova"
import { trovaServizio, valoriValidi } from "../../connectors/catalogo"
import { stessiValori } from "../../connectors/service"
import { destinazione } from "../canali/email-rete"
import { classificaErrore, credenzialiEmail, opzioniImap, opzioniSmtp, provaCasella } from "../canali/email-connessioni"
import { avviaImapFinto, type ImapFinto } from "./finti/imap"
import { avviaSmtpFinto, type SmtpFinto } from "./finti/smtp"

const CASELLA = "negozio@ishtar.example"
const SEGRETO = "SEGRETO-di-prova-123"
const pubblico = (address: string) => async () => [{ address, family: 4 }]

describe("rete sicura della casella email", () => {
  const prima = process.env.EMAIL_PROVE_LOCALI
  afterEach(() => { if (prima === undefined) delete process.env.EMAIL_PROVE_LOCALI; else process.env.EMAIL_PROVE_LOCALI = prima })

  it("server pubblici: IMAP solo sulla 993, SMTP sulla 465 o sulla 587 con STARTTLS", async () => {
    delete process.env.EMAIL_PROVE_LOCALI
    expect(await destinazione("imap.gmail.com", 993, "imap", pubblico("142.250.1.1"))).toEqual({ indirizzo: "142.250.1.1", servername: "imap.gmail.com", porta: 993, tls: "implicito" })
    expect(await destinazione("SMTP.gmail.com", 465, "smtp", pubblico("142.250.1.2"))).toMatchObject({ servername: "smtp.gmail.com", tls: "implicito" })
    expect(await destinazione("smtp.aruba.it", 587, "smtp", pubblico("62.149.1.1"))).toMatchObject({ tls: "starttls" })
    await expect(destinazione("imap.gmail.com", 143, "imap", pubblico("142.250.1.1"))).rejects.toThrow("Use port 993 (SSL) for IMAP")
    await expect(destinazione("smtp.gmail.com", 25, "smtp", pubblico("142.250.1.1"))).rejects.toThrow("Use port 465 (SSL) or 587 (STARTTLS) for SMTP")
    await expect(destinazione("https://imap.gmail.com", 993, "imap", pubblico("142.250.1.1"))).rejects.toThrow("Enter only the server name")
  })

  it("server interni o locali rifiutati senza la variabile delle prove (niente scansioni della rete interna)", async () => {
    delete process.env.EMAIL_PROVE_LOCALI
    const nonPubblico = "This server is not reachable on the public internet"
    await expect(destinazione("127.0.0.1", 993, "imap")).rejects.toThrow(nonPubblico)
    await expect(destinazione("localhost", 993, "imap", async () => [{ address: "127.0.0.1", family: 4 }])).rejects.toThrow(nonPubblico)
    await expect(destinazione("imap.interno", 993, "imap", pubblico("10.0.0.5"))).rejects.toThrow(nonPubblico)
    await expect(destinazione("misto.example", 993, "imap", async () => [{ address: "142.250.1.1", family: 4 }, { address: "192.168.1.9", family: 4 }])).rejects.toThrow(nonPubblico)
  })

  it("con EMAIL_PROVE_LOCALI=1: 127.0.0.1 senza TLS per i server finti, gli altri come sempre", async () => {
    process.env.EMAIL_PROVE_LOCALI = "1"
    expect(await destinazione("127.0.0.1", 1143, "imap")).toEqual({ indirizzo: "127.0.0.1", servername: "127.0.0.1", porta: 1143, tls: "nessuno" })
    await expect(destinazione("imap.gmail.com", 1143, "imap", pubblico("142.250.1.1"))).rejects.toThrow("Use port 993")
  })

  it("in produzione la variabile delle prove non apre questo computer", async () => {
    const ambiente = process.env.NODE_ENV
    process.env.EMAIL_PROVE_LOCALI = "1"
    process.env.NODE_ENV = "production"
    try {
      await expect(destinazione("127.0.0.1", 993, "imap")).rejects.toThrow("This server is not reachable on the public internet")
    } finally {
      process.env.NODE_ENV = ambiente
    }
  })

  it("opzioni di connessione: certificati sempre verificati, nessun registro del traffico", () => {
    const cred = credenzialiEmail({ indirizzo: CASELLA, password: SEGRETO, imap_host: "imap.x", smtp_host: "smtp.x" })
    expect(cred).toMatchObject({ utente: CASELLA, imap_porta: 993, smtp_porta: 465 })
    const imap = opzioniImap(cred, { indirizzo: "1.2.3.4", servername: "imap.x", porta: 993, tls: "implicito" }) as any
    expect(imap).toMatchObject({ host: "1.2.3.4", port: 993, secure: true, servername: "imap.x", logger: false, auth: { user: CASELLA, pass: SEGRETO } })
    expect(imap.tls).toMatchObject({ rejectUnauthorized: true, servername: "imap.x" })
    const smtp = opzioniSmtp(cred, { indirizzo: "1.2.3.5", servername: "smtp.x", porta: 587, tls: "starttls" }) as any
    expect(smtp).toMatchObject({ host: "1.2.3.5", port: 587, secure: false, requireTLS: true, logger: false, debug: false })
    expect(smtp.tls).toMatchObject({ rejectUnauthorized: true, servername: "smtp.x" })
    expect(opzioniSmtp(cred, { indirizzo: "1.2.3.5", servername: "smtp.x", porta: 465, tls: "implicito" })).toMatchObject({ secure: true })
  })

  it("errori classificati senza riportare il testo del server", () => {
    expect(classificaErrore(Object.assign(new Error("x"), { authenticationFailed: true }))).toBe("credenziali")
    expect(classificaErrore(Object.assign(new Error("x"), { code: "EAUTH" }))).toBe("credenziali")
    for (const code of ["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"]) {
      expect(classificaErrore(Object.assign(new Error("x"), { code }))).toBe("certificato")
    }
    expect(classificaErrore(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))).toBe("rete")
  })
})

describe("prova della casella e voce del connettore", () => {
  let imap: ImapFinto
  let smtp: SmtpFinto
  const prima = process.env.EMAIL_PROVE_LOCALI
  beforeAll(async () => {
    process.env.EMAIL_PROVE_LOCALI = "1"
    imap = await avviaImapFinto({ utente: CASELLA, password: SEGRETO })
    smtp = await avviaSmtpFinto({ utente: CASELLA, password: SEGRETO })
  })
  afterAll(async () => {
    await imap.chiudi()
    await smtp.chiudi()
    if (prima === undefined) delete process.env.EMAIL_PROVE_LOCALI; else process.env.EMAIL_PROVE_LOCALI = prima
  })
  const valori = (extra: Record<string, string> = {}) => ({
    indirizzo: CASELLA, password: SEGRETO, imap_host: "127.0.0.1", imap_porta: String(imap.porta), smtp_host: "127.0.0.1", smtp_porta: String(smtp.porta), ...extra,
  })

  it("prova riuscita: login IMAP in sola lettura e login SMTP, senza inviare nulla", async () => {
    imap.comandi.length = 0
    smtp.comandi.length = 0
    expect(await provaCasella(valori())).toEqual({ ok: true, account: CASELLA })
    expect(imap.comandi).toContain("EXAMINE INBOX")
    expect(imap.comandi.some((c) => /^(SELECT|STORE|UID STORE|APPEND|EXPUNGE|COPY|MOVE)\b/.test(c))).toBe(false)
    expect(smtp.comandi.some((c) => c.startsWith("AUTH"))).toBe(true)
    expect(smtp.comandi.some((c) => /^(MAIL|RCPT|DATA)\b/i.test(c))).toBe(false)
  })

  it("password sbagliata: messaggio fisso e password mai nell'esito", async () => {
    const esito = await provaCasella(valori({ password: "sbagliata-ma-segreta" }))
    expect(esito).toEqual({ ok: false, errore: "The mailbox refused the username or password" })
    expect(JSON.stringify(esito)).not.toContain("sbagliata-ma-segreta")
  })

  it("server irraggiungibile: messaggio fisso", async () => {
    expect(await provaCasella(valori({ imap_porta: "1" }))).toEqual({ ok: false, errore: "The mail server can't be reached" })
  })

  it("la voce «Shop mailbox» usa questa prova e controlla i campi", async () => {
    const servizio = trovaServizio("casella_email")!
    expect(servizio).toMatchObject({ nome: "Shop mailbox", categoria: "email", accesso: "chiave" })
    expect(servizio.campi.find((c) => c.chiave === "password")?.segreto).toBe(true)
    expect(await eseguiProva(servizio, valori())).toEqual({ ok: true, account: CASELLA })
    expect(valoriValidi(servizio, valori({ indirizzo: "non-un-indirizzo" }))).toMatch(/email address/i)
    expect(valoriValidi(servizio, valori({ smtp_host: "smtp://x.example/percorso" }))).toMatch(/server name/i)
    expect(valoriValidi(servizio, valori({ imap_porta: "abc" }))).toMatch(/port/i)
    expect(valoriValidi(servizio, valori())).toBeNull()
  })

  it("errore del connettore solo se le credenziali salvate sono ancora quelle usate", () => {
    expect(stessiValori({ password: "a", utente: "u" }, { password: "a" })).toBe(true)
    expect(stessiValori({ password: "nuova", utente: "u" }, { password: "a" })).toBe(false)
    expect(stessiValori(undefined, { password: "a" })).toBe(false)
  })
})
