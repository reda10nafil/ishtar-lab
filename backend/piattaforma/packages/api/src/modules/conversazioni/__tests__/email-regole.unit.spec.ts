import MailComposer from "nodemailer/lib/mail-composer"
import {
  automatico,
  idMessaggioEmail,
  ILLEGGIBILE,
  intestazioniRisposta,
  messageIdNostro,
  oggettoRisposta,
  senzaCitazioni,
  testoDaHtml,
  traduciEmail,
  verificaMittente,
} from "../canali/email-regole"

const CASELLA = "negozio@ishtar.example"
const meta = { account: CASELLA, uid: 7, uidvalidity: "1700000000", internaldate: new Date("2026-11-13T10:00:00Z") }
const componi = (opzioni: Record<string, unknown>): Promise<Buffer> => new MailComposer(opzioni as never).compile().build()
const intestazioni = (righe: [string, string][]) => righe.map(([key, value]) => ({ key, originalKey: key, value }))

describe("traduzione delle email in arrivo", () => {
  it("messaggio di un cliente: mittente, oggetto, testo nuovo, filo e allegati", async () => {
    const grezzo = await componi({
      from: '"Giulia Martini" <Giulia.Martini@example.com>',
      to: CASELLA,
      subject: "Ordine #12",
      messageId: "<abc123@example.com>",
      inReplyTo: "<crm.a1@ishtar.example>",
      references: ["<crm.a0@ishtar.example>", "<crm.a1@ishtar.example>"],
      text: "Va bene, grazie!\n\nIl giorno lun 13 nov 2026 alle ore 10:00 Negozio <negozio@ishtar.example>\nha scritto:\n> Il pacco parte domani.",
      attachments: [{ filename: "foto.jpg", content: Buffer.alloc(2048, 1) }],
    })
    const t = await traduciEmail(grezzo, meta)
    expect(t.tipo).toBe("messaggio")
    if (t.tipo !== "messaggio") return
    const { inArrivo } = t
    expect(inArrivo).toMatchObject({
      canale: "email",
      account: CASELLA,
      id_contatto: "giulia.martini@example.com",
      recapito: "giulia.martini@example.com",
      nome: "Giulia Martini",
      id_messaggio: "<abc123@example.com>",
      oggetto: "Ordine #12",
      quando: meta.internaldate,
    })
    expect(inArrivo.testo).toBe("Va bene, grazie!\n\n[Attachment: foto.jpg, 2 KB]")
    expect(inArrivo.dettagli).toMatchObject({
      message_id: "<abc123@example.com>",
      in_reply_to: "<crm.a1@ishtar.example>",
      references: ["<crm.a0@ishtar.example>", "<crm.a1@ishtar.example>"],
      oggetto: "Ordine #12",
      reply_to: null,
      allegati: [{ nome: "foto.jpg", byte: 2048 }],
    })
    expect(inArrivo.dettagli.testo_completo).toContain("Il pacco parte domani.")
  })

  it("email solo HTML: testo ricavato, niente tag né script", async () => {
    const grezzo = await componi({
      from: "cliente@example.com",
      to: CASELLA,
      subject: "Info",
      html: "<html><head><style>p{}</style></head><body><p>Ciao&nbsp;Reda,</p><p>avete la taglia <b>M</b>?<br>Grazie &amp; buona giornata</p><script>alert(1)</script></body></html>",
    })
    const t = await traduciEmail(grezzo, meta)
    if (t.tipo !== "messaggio") throw new Error(t.tipo)
    expect(t.inArrivo.testo).toBe("Ciao Reda,\navete la taglia M?\nGrazie & buona giornata")
  })

  it("Reply-To diverso dal mittente: conservato come avviso, il contatto resta il mittente", async () => {
    const grezzo = await componi({ from: "cliente@example.com", replyTo: "altro@example.net", to: CASELLA, subject: "x", text: "Ciao" })
    const t = await traduciEmail(grezzo, meta)
    if (t.tipo !== "messaggio") throw new Error(t.tipo)
    expect(t.inArrivo.id_contatto).toBe("cliente@example.com")
    expect(t.inArrivo.dettagli.reply_to).toBe("altro@example.net")
  })

  it("risposta automatica, newsletter e mittenti di sistema: non aprono conversazioni", async () => {
    const fuoriSede = await componi({ from: "cliente@example.com", to: CASELLA, subject: "Fuori sede", text: "Torno lunedì", headers: { "Auto-Submitted": "auto-replied" } })
    expect(await traduciEmail(fuoriSede, meta)).toMatchObject({ tipo: "automatico" })
    const newsletter = await componi({ from: "news@shop.example", to: CASELLA, subject: "Offerte", text: "…", headers: { "List-Unsubscribe": "<mailto:u@shop.example>" } })
    expect(await traduciEmail(newsletter, meta)).toMatchObject({ tipo: "automatico" })
    const noreply = await componi({ from: "no-reply@corriere.example", to: CASELLA, subject: "Spedizione", text: "…" })
    expect(await traduciEmail(noreply, meta)).toMatchObject({ tipo: "automatico" })
  })

  it("email spedita dalla casella stessa: non entra come messaggio di un cliente", async () => {
    const nostra = await componi({ from: `Negozio <${CASELLA.toUpperCase()}>`, to: "cliente@example.com", subject: "Re: x", text: "Ciao" })
    expect(await traduciEmail(nostra, meta)).toEqual({ tipo: "nostro" })
  })

  it("rapporto di mancata consegna (RFC 3464): rimbalzo con il Message-ID della nostra risposta", async () => {
    const dsn = [
      "From: Mail Delivery System <MAILER-DAEMON@mx.ishtar.example>",
      `To: ${CASELLA}`,
      "Subject: Undelivered Mail Returned to Sender",
      "Message-ID: <dsn1@mx.ishtar.example>",
      "MIME-Version: 1.0",
      'Content-Type: multipart/report; report-type=delivery-status; boundary="B"',
      "",
      "--B",
      "Content-Type: text/plain",
      "",
      "Il messaggio non è stato consegnato.",
      "--B",
      "Content-Type: message/delivery-status",
      "",
      "Reporting-MTA: dns; mx.ishtar.example",
      "",
      "Final-Recipient: rfc822; sbagliato@example.com",
      "Action: failed",
      "Status: 5.1.1",
      "Diagnostic-Code: smtp; 550 5.1.1 User unknown",
      "--B",
      "Content-Type: text/rfc822-headers",
      "",
      `From: Negozio <${CASELLA}>`,
      "To: sbagliato@example.com",
      "Subject: Re: Ordine",
      "Message-ID: <crm.abc123@ishtar.example>",
      "--B--",
      "",
    ].join("\r\n")
    const t = await traduciEmail(Buffer.from(dsn), meta)
    expect(t).toMatchObject({ tipo: "rimbalzo", message_id_originale: "<crm.abc123@ishtar.example>" })
    if (t.tipo === "rimbalzo") expect(t.motivo).toContain("5.1.1")
  })

  it("MIME rotto: segnaposto leggibile con il mittente della busta IMAP, senza lanciare", async () => {
    const rotto = Buffer.from("questo non è un messaggio MIME\x00\x01\x02")
    const t = await traduciEmail(rotto, { ...meta, busta: { mittente: "cliente@example.com", nome: "Cliente", oggetto: "Aiuto" } })
    expect(t.tipo).toBe("messaggio")
    if (t.tipo === "messaggio") {
      expect(t.inArrivo.id_contatto).toBe("cliente@example.com")
      expect(t.inArrivo.testo).toBeTruthy()
    }
  })

  it("email troppo grande (contenuto non scaricato): segnaposto con i dati della busta", async () => {
    const t = await traduciEmail(null, { ...meta, busta: { mittente: "cliente@example.com", nome: null, oggetto: "Foto", message_id: "<grande@example.com>" } })
    expect(t).toMatchObject({ tipo: "messaggio", inArrivo: { id_contatto: "cliente@example.com", oggetto: "Foto", id_messaggio: "<grande@example.com>" } })
    if (t.tipo === "messaggio") expect(t.inArrivo.testo).toMatch(/too large/)
  })

  it("segnaposto per le email che non si leggono: testo fisso", () => {
    expect(ILLEGGIBILE).toBe("[This email could not be read: open it in your mail app]")
  })
})

describe("testo e citazioni", () => {
  it("HTML con entità, elenchi e commenti", () => {
    expect(testoDaHtml("<!-- x --><ul><li>Uno</li><li>Due &euro; 3</li></ul><div>Fine &#233; &#x2014;</div>")).toBe("• Uno\n• Due € 3\nFine é —")
  })

  it("citazioni di Gmail (su due righe), Outlook in italiano e righe «>»", () => {
    expect(senzaCitazioni("Grazie!\n\nIl giorno lun 13 nov 2026 alle ore 10:00 Negozio <n@x.it>\nha scritto:\n> vecchio")).toEqual({ nuovo: "Grazie!", citato: true })
    expect(senzaCitazioni("Perfetto\n\nOn Mon, Nov 13, 2026 at 10:00 AM Shop <s@x.com> wrote:\n> old")).toEqual({ nuovo: "Perfetto", citato: true })
    expect(senzaCitazioni("Ok\r\n\r\nDa: Negozio <n@x.it>\r\nInviato: lunedì 13 novembre 2026 10:00\r\nA: Cliente\r\nOggetto: Ordine\r\n\r\nvecchio")).toEqual({ nuovo: "Ok", citato: true })
    expect(senzaCitazioni("Sì\n\n-----Messaggio originale-----\nvecchio")).toEqual({ nuovo: "Sì", citato: true })
    expect(senzaCitazioni("Nuovo\n> citato\n> ancora")).toEqual({ nuovo: "Nuovo", citato: true })
    expect(senzaCitazioni("Solo testo\ncon due righe")).toEqual({ nuovo: "Solo testo\ncon due righe", citato: false })
    // Un'email fatta solo di citazione (un inoltro) resta intera.
    expect(senzaCitazioni("> tutto citato")).toEqual({ nuovo: "> tutto citato", citato: false })
  })
})

describe("filtri, verifica del mittente e intestazioni della risposta", () => {
  it("messaggi automatici riconosciuti dalle intestazioni", () => {
    expect(automatico(intestazioni([["auto-submitted", "no"]]), "c@example.com")).toBeNull()
    expect(automatico(intestazioni([["auto-submitted", "auto-generated"]]), "c@example.com")).toBeTruthy()
    expect(automatico(intestazioni([["precedence", "bulk"]]), "c@example.com")).toBeTruthy()
    expect(automatico(intestazioni([["x-autoreply", "yes"]]), "c@example.com")).toBeTruthy()
    expect(automatico(intestazioni([["list-id", "<news.shop.example>"]]), "c@example.com")).toBeTruthy()
    expect(automatico([], "postmaster@example.com")).toBeTruthy()
    expect(automatico([], "noreply@example.com")).toBeTruthy()
    expect(automatico([], "mario@example.com")).toBeNull()
  })

  it("verifica: vale solo il primo Authentication-Results, quello del server della casella", () => {
    const vero = ["authentication-results", "mx.google.com; dkim=pass header.i=@example.com; spf=pass; dmarc=pass (p=REJECT) header.from=example.com"] as [string, string]
    const falso = ["authentication-results", "mx.google.com; dmarc=pass header.from=example.com"] as [string, string]
    const fallito = ["authentication-results", "mx.google.com; dmarc=fail (p=NONE) header.from=example.com"] as [string, string]
    expect(verificaMittente(intestazioni([vero]), "example.com")).toBe("verificato")
    expect(verificaMittente(intestazioni([fallito, falso]), "example.com")).toBe("non_verificato")
    expect(verificaMittente(intestazioni([vero]), "altro.com")).toBe("non_verificato")
    expect(verificaMittente([], "example.com")).toBe("sconosciuto")
  })

  it("risposta nello stesso filo: In-Reply-To, References accumulate e un solo «Re:»", () => {
    expect(intestazioniRisposta({ message_id: "<m3@x>", references: ["<m1@x>", "<m2@x>"], oggetto: "RE: R: Re: Ordine 12" }, null)).toEqual({
      inReplyTo: "<m3@x>",
      references: ["<m1@x>", "<m2@x>", "<m3@x>"],
      oggetto: "Re: Ordine 12",
    })
    const lunghe = Array.from({ length: 30 }, (_, i) => `<r${i}@x>`)
    expect(intestazioniRisposta({ message_id: "<ultimo@x>", references: lunghe, oggetto: "x" }, null).references).toHaveLength(20)
    expect(intestazioniRisposta(null, "Ordine 12")).toEqual({ inReplyTo: undefined, references: [], oggetto: "Re: Ordine 12" })
    expect(oggettoRisposta("")).toBe("Re: Your message")
    expect(oggettoRisposta("AW: Sv: RIF: Spedizione")).toBe("Re: Spedizione")
  })

  it("Message-ID delle risposte e chiave dei messaggi", () => {
    expect(messageIdNostro("a".repeat(32), "Negozio@Ishtar.Example")).toBe(`<crm.${"a".repeat(32)}@ishtar.example>`)
    expect(idMessaggioEmail("<abc@x>", "1", 2)).toBe("<abc@x>")
    expect(idMessaggioEmail(null, "1700000000", 42)).toBe("uid:1700000000:42")
    const lungo = idMessaggioEmail(`<${"x".repeat(500)}@x>`, "1", 2)
    expect(lungo).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
})
