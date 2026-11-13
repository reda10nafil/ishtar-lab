import MailComposer from "nodemailer/lib/mail-composer"
import { elaboraEmail, leggiCasella, type CursoreEmail, type EmailLetta, type Lettura } from "../canali/email-imap"
import { classificaErrore, credenzialiEmail } from "../canali/email-connessioni"
import { ILLEGGIBILE } from "../canali/email-regole"
import type { InArrivo } from "../tipi"
import { avviaImapFinto, type ImapFinto } from "./finti/imap"

const CASELLA = "negozio@ishtar.example"
const SEGRETO = "SEGRETO-di-prova-imap"
const UV = "1700000000"
const componi = (opzioni: Record<string, unknown>): Promise<Buffer> => new MailComposer(opzioni as never).compile().build()
const email = (n: number, extra: Record<string, unknown> = {}) =>
  componi({ from: `Cliente ${n} <cliente${n}@example.com>`, to: CASELLA, subject: `Domanda ${n}`, messageId: `<m${n}@example.com>`, text: `Testo ${n}`, ...extra })

describe("lettura della casella (IMAP finto)", () => {
  let imap: ImapFinto
  const prima = process.env.EMAIL_PROVE_LOCALI
  beforeAll(() => { process.env.EMAIL_PROVE_LOCALI = "1" })
  afterAll(() => { if (prima === undefined) delete process.env.EMAIL_PROVE_LOCALI; else process.env.EMAIL_PROVE_LOCALI = prima })
  beforeEach(async () => { imap = await avviaImapFinto({ utente: CASELLA, password: SEGRETO, uidvalidity: Number(UV) }) })
  afterEach(async () => { await imap.chiudi() })
  const cred = () => credenzialiEmail({ indirizzo: CASELLA, password: SEGRETO, imap_host: "127.0.0.1", imap_porta: String(imap.porta), smtp_host: "127.0.0.1", smtp_porta: "1" })
  const uid = (letta: Lettura) => letta.messaggi.map((m) => m.uid)

  it("primo collegamento: nessuna email importata, cursore all'ultima già presente", async () => {
    imap.aggiungi(await email(1))
    imap.aggiungi(await email(2))
    expect(await leggiCasella(cred(), null)).toEqual({ uidvalidity: UV, messaggi: [], cursoreFinale: { uidvalidity: UV, ultimo_uid: 2 } })
  })

  it("primo collegamento con un server che non dice UIDNEXT: cursore all'UID più alto", async () => {
    imap.guasti.senzaUidnext = true
    imap.aggiungi(await email(1))
    imap.aggiungi(await email(2))
    expect((await leggiCasella(cred(), null)).cursoreFinale).toEqual({ uidvalidity: UV, ultimo_uid: 2 })
  })

  it("email nuove lette una volta, in ordine; «n:*» con l'ultima già letta non la ripete", async () => {
    for (let n = 1; n <= 4; n++) imap.aggiungi(await email(n))
    const letta = await leggiCasella(cred(), { uidvalidity: UV, ultimo_uid: 2 })
    expect(uid(letta)).toEqual([3, 4])
    expect(letta.messaggi[0].grezzo?.toString()).toContain("Testo 3")
    expect(letta.cursoreFinale).toBeNull()
    // Il server finto, come uno vero, risponde a «5:*» con l'ultimo messaggio (uid 4): non va riletto.
    expect(uid(await leggiCasella(cred(), { uidvalidity: UV, ultimo_uid: 4 }))).toEqual([])
  })

  it("al massimo N email per giro, le più vecchie prima", async () => {
    for (let n = 1; n <= 5; n++) imap.aggiungi(await email(n))
    expect(uid(await leggiCasella(cred(), { uidvalidity: UV, ultimo_uid: 0 }, { massimo: 2 }))).toEqual([1, 2])
  })

  it("byte scaricati per giro limitati, ma sempre almeno un'email", async () => {
    for (let n = 1; n <= 3; n++) imap.aggiungi(await email(n))
    const peso = Math.max(...imap.messaggi.map((m) => m.grezzo.length))
    expect(uid(await leggiCasella(cred(), { uidvalidity: UV, ultimo_uid: 0 }, { byteGiro: peso * 2 + 1 }))).toEqual([1, 2])
    expect(uid(await leggiCasella(cred(), { uidvalidity: UV, ultimo_uid: 0 }, { byteGiro: 1 }))).toEqual([1])
  })

  it("UIDVALIDITY cambiata: si rileggono solo le email da ieri, poi il cursore va all'ultima presente", async () => {
    imap.aggiungi(await email(1), new Date(Date.now() - 3 * 864e5))
    imap.aggiungi(await email(2), new Date(Date.now() - 3600e3))
    imap.nuovaUidvalidity(1800000000)
    const letta = await leggiCasella(cred(), { uidvalidity: UV, ultimo_uid: 2 })
    expect(uid(letta)).toEqual([2])
    expect(letta.uidvalidity).toBe("1800000000")
    expect(letta.cursoreFinale).toEqual({ uidvalidity: "1800000000", ultimo_uid: 2 })
  })

  it("UIDVALIDITY cambiata con più email del massimo: nessun salto, il cursore segue le email registrate", async () => {
    for (let n = 1; n <= 3; n++) imap.aggiungi(await email(n))
    imap.nuovaUidvalidity(1800000000)
    const letta = await leggiCasella(cred(), { uidvalidity: UV, ultimo_uid: 3 }, { massimo: 2 })
    expect(uid(letta)).toEqual([1, 2])
    expect(letta.cursoreFinale).toBeNull()
  })

  it("email di 11 MB: solo la busta (mittente, oggetto, Message-ID), il contenuto non si scarica", async () => {
    imap.aggiungi(Buffer.concat([await email(1), Buffer.from(`${"x".repeat(998)}\r\n`.repeat(11 * 1024))]))
    const letta = await leggiCasella(cred(), { uidvalidity: UV, ultimo_uid: 0 })
    expect(letta.messaggi).toEqual([
      expect.objectContaining({ uid: 1, grezzo: null, busta: { mittente: "cliente1@example.com", nome: "Cliente 1", oggetto: "Domanda 1", message_id: "<m1@example.com>" } }),
    ])
    expect(imap.comandi.some((c) => c.startsWith("UID FETCH") && c.includes("BODY.PEEK[]"))).toBe(false)
  })

  it("casella mai modificata: solo EXAMINE, UID SEARCH e UID FETCH con PEEK", async () => {
    imap.aggiungi(await email(1))
    imap.aggiungi(await email(2))
    expect(uid(await leggiCasella(cred(), { uidvalidity: UV, ultimo_uid: 0 }))).toEqual([1, 2])
    expect(imap.comandi).toContain("EXAMINE INBOX")
    expect(imap.comandi.filter((c) => !/^(CAPABILITY|LOGIN|NOOP|LOGOUT|LIST|LSUB|EXAMINE INBOX|UID SEARCH|UID FETCH)\b/.test(c))).toEqual([])
    const fetch = imap.comandi.filter((c) => c.startsWith("UID FETCH"))
    expect(fetch.some((c) => c.includes("BODY.PEEK[]"))).toBe(true)
    expect(fetch.every((c) => !/BODY\[/.test(c))).toBe(true)
  })

  it("password sbagliata: errore di credenziali, mai la password", async () => {
    const errore = await leggiCasella({ ...cred(), password: "sbagliata-segreta" }, null).catch((e) => e)
    expect(classificaErrore(errore)).toBe("credenziali")
    expect(String(errore?.message ?? "")).not.toContain("sbagliata-segreta")
  })
})

describe("registrazione delle email lette", () => {
  const lettura = (messaggi: EmailLetta[], cursoreFinale: CursoreEmail | null = null): Lettura => ({ uidvalidity: UV, messaggi, cursoreFinale })
  const letta = (uid: number, grezzo: Buffer | null): EmailLetta => ({ uid, grezzo, internaldate: new Date("2026-11-13T10:00:00Z"), dimensione: grezzo?.length ?? 0 })

  function deps(rifiuta?: (e: InArrivo) => boolean) {
    const registrati: InArrivo[] = []
    const rimbalzi: [string, string][] = []
    const cursori: CursoreEmail[] = []
    return {
      registrati, rimbalzi, cursori,
      dipendenze: {
        account: CASELLA,
        registra: async (e: InArrivo) => {
          if (rifiuta?.(e)) throw new Error("database non disponibile")
          registrati.push(e)
        },
        rimbalzo: async (id: string, motivo: string) => { rimbalzi.push([id, motivo]) },
        salva: async (c: CursoreEmail) => { cursori.push(c) },
      },
    }
  }

  it("messaggi registrati, automatici saltati, rimbalzi segnati; cursore salvato dopo ognuno", async () => {
    const d = deps()
    const fuoriSede = await email(12, { headers: { "Auto-Submitted": "auto-replied" } })
    const dsn = Buffer.from([
      "From: MAILER-DAEMON@mx.example", `To: ${CASELLA}`, "Subject: Undelivered", "MIME-Version: 1.0",
      'Content-Type: multipart/report; report-type=delivery-status; boundary="B"', "", "--B", "Content-Type: message/delivery-status", "",
      "Status: 5.1.1", "Diagnostic-Code: smtp; 550 User unknown", "--B", "Content-Type: text/rfc822-headers", "",
      "Message-ID: <crm.x1@ishtar.example>", "--B--", "",
    ].join("\r\n"))
    const esito = await elaboraEmail(lettura([letta(11, await email(11)), letta(12, fuoriSede), letta(13, dsn)]), d.dipendenze)
    expect(esito).toEqual({ registrati: 1, rimbalzi: 1, scartati: 1 })
    expect(d.registrati.map((e) => e.id_messaggio)).toEqual(["<m11@example.com>"])
    expect(d.rimbalzi).toEqual([["<crm.x1@ishtar.example>", expect.stringContaining("5.1.1")]])
    expect(d.cursori).toEqual([11, 12, 13].map((ultimo_uid) => ({ uidvalidity: UV, ultimo_uid })))
  })

  it("una registrazione che non riesce mai ferma il giro: il cursore resta prima di quel messaggio", async () => {
    const d = deps((e) => e.id_messaggio === "<m12@example.com>")
    const tutte = lettura([letta(11, await email(11)), letta(12, await email(12)), letta(13, await email(13))])
    await expect(elaboraEmail(tutte, d.dipendenze)).rejects.toThrow("database non disponibile")
    expect(d.registrati.map((e) => e.id_messaggio)).toEqual(["<m11@example.com>"])
    expect(d.cursori.map((c) => c.ultimo_uid)).toEqual([11])
  })

  it("email che il database rifiuta per il contenuto: si registra il segnaposto e la lettura va avanti", async () => {
    const d = deps((e) => e.id_messaggio === "<m12@example.com>" && e.testo !== ILLEGGIBILE)
    const tutte = lettura([letta(11, await email(11)), letta(12, await email(12)), letta(13, await email(13))])
    expect(await elaboraEmail(tutte, d.dipendenze)).toEqual({ registrati: 3, rimbalzi: 0, scartati: 0 })
    expect(d.registrati.map((e) => [e.id_messaggio, e.testo])).toEqual([
      ["<m11@example.com>", "Testo 11"],
      ["<m12@example.com>", ILLEGGIBILE],
      ["<m13@example.com>", "Testo 13"],
    ])
    expect(d.registrati[1]).toMatchObject({ id_contatto: "cliente12@example.com", nome: null, oggetto: null, dettagli: null })
    expect(d.cursori.map((c) => c.ultimo_uid)).toEqual([11, 12, 13])
  })

  it("MIME rotto (troppo annidato): segnaposto con il mittente letto dalla testata, cursore avanti", async () => {
    let rotto = "From: Cliente Rotto <rotto@example.com>\r\nSubject: Ordine\r\nMessage-ID: <rotto@example.com>\r\nContent-Type: multipart/mixed; boundary=b0\r\n\r\n"
    for (let i = 1; i <= 40; i++) rotto += `--b${i - 1}\r\nContent-Type: multipart/mixed; boundary=b${i}\r\n\r\n`
    const d = deps()
    await elaboraEmail(lettura([letta(11, Buffer.from(rotto))]), d.dipendenze)
    expect(d.registrati).toEqual([
      expect.objectContaining({ id_contatto: "rotto@example.com", nome: "Cliente Rotto", oggetto: "Ordine", testo: ILLEGGIBILE, id_messaggio: "<rotto@example.com>" }),
    ])
    expect(d.cursori.map((c) => c.ultimo_uid)).toEqual([11])
  })

  it("nessun messaggio: si salva il cursore finale (primo collegamento o casella rinumerata)", async () => {
    const d = deps()
    await elaboraEmail({ uidvalidity: "1800000000", messaggi: [], cursoreFinale: { uidvalidity: "1800000000", ultimo_uid: 5 } }, d.dipendenze)
    expect(d.cursori).toEqual([{ uidvalidity: "1800000000", ultimo_uid: 5 }])
  })

  it("cursore finale: salvato dopo le email se va oltre l'ultima, ignorato se è indietro", async () => {
    const oltre = deps()
    await elaboraEmail(lettura([letta(11, await email(11))], { uidvalidity: UV, ultimo_uid: 20 }), oltre.dipendenze)
    expect(oltre.cursori.map((c) => c.ultimo_uid)).toEqual([11, 20])
    const indietro = deps()
    await elaboraEmail(lettura([letta(11, await email(11))], { uidvalidity: UV, ultimo_uid: 5 }), indietro.dipendenze)
    expect(indietro.cursori.map((c) => c.ultimo_uid)).toEqual([11])
  })
})
