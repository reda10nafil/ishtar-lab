import MailComposer from "nodemailer/lib/mail-composer"
import {
  automatico,
  bustaDaTestata,
  idClientDaMessageId,
  idMessaggioEmail,
  ILLEGGIBILE,
  intestazioniRisposta,
  messageIdNostro,
  oggettoRisposta,
  pulisci,
  senzaCitazioni,
  serverFidato,
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

  it("verifica: vale solo il primo Authentication-Results del server della casella", () => {
    const vero = ["authentication-results", "mx.google.com; dkim=pass header.i=@example.com; spf=pass; dmarc=pass (p=REJECT) header.from=example.com"] as [string, string]
    const falso = ["authentication-results", "mx.google.com; dmarc=pass header.from=example.com"] as [string, string]
    const fallito = ["authentication-results", "mx.google.com; dmarc=fail (p=NONE) header.from=example.com"] as [string, string]
    const altrui = ["authentication-results", "mx.example.org; dmarc=pass header.from=example.com"] as [string, string]
    expect(verificaMittente(intestazioni([vero]), "example.com", "google.com")).toBe("verificato")
    expect(verificaMittente(intestazioni([fallito, falso]), "example.com", "google.com")).toBe("non_verificato")
    expect(verificaMittente(intestazioni([vero]), "altro.com", "google.com")).toBe("non_verificato")
    expect(verificaMittente([], "example.com", "google.com")).toBe("sconosciuto")
    // Server della casella che non aggiunge Authentication-Results: quello scritto dal mittente non conta.
    expect(verificaMittente(intestazioni([falso]), "example.com", "aruba.it")).toBe("sconosciuto")
    expect(verificaMittente(intestazioni([altrui, fallito]), "example.com", "google.com")).toBe("non_verificato")
    expect(verificaMittente(intestazioni([["authentication-results", "mx.google.com.evil.example; dmarc=pass header.from=example.com"]]), "example.com", "google.com")).toBe("sconosciuto")
    expect(verificaMittente(intestazioni([vero]), "example.com", null)).toBe("sconosciuto")
  })

  it("server fidato: dal server IMAP (Gmail: google.com) o scelto nel connettore", () => {
    expect(serverFidato({ imap_host: "imap.gmail.com" })).toBe("google.com")
    expect(serverFidato({ imap_host: "imaps.aruba.it" })).toBe("aruba.it")
    expect(serverFidato({ imap_host: "imap.mail.yahoo.co.jp" })).toBe("yahoo.co.jp")
    expect(serverFidato({ imap_host: "127.0.0.1" })).toBeNull()
    expect(serverFidato({ imap_host: "imap.gmail.com", server_verifica: " MX.Esempio.it " })).toBe("mx.esempio.it")
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

describe("email ostili: niente che il database rifiuti o che fermi la lettura", () => {
  it("caratteri NUL tolti da testo, oggetto e nome (Postgres non li accetta)", async () => {
    const grezzo = Buffer.from([
      "From: =?UTF-8?Q?Cli=00ente?= <cliente@example.com>",
      `To: ${CASELLA}`,
      "Subject: =?UTF-8?Q?Ordine=00_12?=",
      "Message-ID: <nul@example.com>",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "ciao=00mondo",
      "",
    ].join("\r\n"))
    const t = await traduciEmail(grezzo, meta)
    if (t.tipo !== "messaggio") throw new Error(t.tipo)
    expect(t.inArrivo).toMatchObject({ testo: "ciaomondo", oggetto: "Ordine 12", nome: "Cliente" })
    expect(JSON.stringify(t)).not.toContain("\\u0000")
  })

  it("tagli che non spezzano le emoji: un surrogato spaiato farebbe rifiutare i dettagli JSON", async () => {
    const t = await traduciEmail(await componi({ from: "c@example.com", to: CASELLA, subject: `${"a".repeat(298)}😀😀😀`, text: "x" }), meta)
    if (t.tipo !== "messaggio") throw new Error(t.tipo)
    expect(t.inArrivo.oggetto).toBe(`${"a".repeat(298)}…`)
    expect(t.inArrivo.dettagli.oggetto).toBe(`${"a".repeat(298)}…`)
  })

  it("entità HTML di surrogati restano testo; pulizia finale di NUL e surrogati spaiati", () => {
    expect(testoDaHtml("<p>a&#xD800;b&#xDFFF;c</p>")).toBe("a&#xD800;b&#xDFFF;c")
    expect(pulisci({ a: "x\u0000y", b: ["\ud800z", "😀"], c: new Date(0), d: null, e: 3 })).toEqual({ a: "xy", b: ["\ufffdz", "😀"], c: new Date(0), d: null, e: 3 })
  })

  it("mittente lunghissimo scartato; nome accorciato; Message-ID lunghissimi fuori dal filo", async () => {
    const lunghissimo = `${"a".repeat(300)}@example.com`
    expect(await traduciEmail(await componi({ from: lunghissimo, to: CASELLA, subject: "x", text: "x" }), meta)).toEqual({ tipo: "automatico", motivo: "invalid sender address" })
    expect(await traduciEmail(null, { ...meta, busta: { mittente: lunghissimo } })).toEqual({ tipo: "automatico", motivo: "invalid sender address" })
    const idLungo = `<${"b".repeat(300)}@example.com>`
    const t = await traduciEmail(await componi({
      from: { name: "N".repeat(500), address: "c@example.com" }, to: CASELLA, subject: "x", text: "x",
      messageId: idLungo, inReplyTo: idLungo, references: [idLungo, "<corto@example.com>"],
    }), meta)
    if (t.tipo !== "messaggio") throw new Error(t.tipo)
    expect(t.inArrivo.nome).toHaveLength(200)
    expect(t.inArrivo.id_messaggio).toMatch(/^sha256:/)
    expect(t.inArrivo.dettagli).toMatchObject({ message_id: null, in_reply_to: null, references: ["<corto@example.com>"] })
  })

  it("busta dalla testata: mittente, nome, oggetto e Message-ID, anche con parole codificate", async () => {
    const testata = Buffer.from("From: =?UTF-8?Q?Jos=C3=A9?= <Jose@Example.com>\r\nSubject: =?UTF-8?B?Q2lhbyDwn5iA?=\r\nMessage-ID: <x1@example.com>\r\n\r\nCorpo che non serve")
    expect(await bustaDaTestata(testata)).toEqual({ mittente: "Jose@Example.com", nome: "José", oggetto: "Ciao 😀", message_id: "<x1@example.com>" })
    expect(await bustaDaTestata(Buffer.from("niente intestazioni"))).toEqual({ mittente: null, nome: null, oggetto: null, message_id: null })
  })

  it("rimbalzo di una nostra risposta: l'id della risposta si ricava dal Message-ID", () => {
    expect(idClientDaMessageId(messageIdNostro("8f14e45f-ceea-467f-a8f5-1c2b3d4e5f60", CASELLA))).toBe("8f14e45f-ceea-467f-a8f5-1c2b3d4e5f60")
    expect(idClientDaMessageId("<crm.a1@ishtar.example>")).toBe("a1")
    expect(idClientDaMessageId("<abc@example.com>")).toBeNull()
    expect(idClientDaMessageId("<crm.@ishtar.example>")).toBeNull()
  })
})

describe("rapporti di consegna: solo i rimbalzi veri segnano la risposta", () => {
  const rapporto = ({ azione = "failed", stato = "5.1.1", tipo = "delivery-status", destinatario = "cliente@example.com", da = "Mail Delivery Subsystem <mailer-daemon@googlemail.com>" } = {}) => Buffer.from([
    `From: ${da}`, `To: ${CASELLA}`, "Subject: Delivery Status Notification", "Message-ID: <dsn9@mx.example>", "MIME-Version: 1.0",
    `Content-Type: multipart/report; report-type=${tipo}; boundary="R"`, "", "--R", "Content-Type: text/plain", "", "THIS IS A WARNING MESSAGE ONLY.", "",
    "--R", `Content-Type: message/${tipo}`, "", "Reporting-MTA: dns; mx.example", "",
    `Final-Recipient: rfc822; ${destinatario}`, `Action: ${azione}`, `Status: ${stato}`, "Diagnostic-Code: smtp; 452 4.2.2 Mailbox full", "",
    "--R", "Content-Type: text/rfc822-headers", "", `From: Negozio <${CASELLA}>`, "Message-ID: <crm.r1abcdefgh@ishtar.example>", "", "--R--", "",
  ].join("\r\n"))

  it("Action: failed: rimbalzo con il motivo e i destinatari non raggiunti", async () => {
    expect(await traduciEmail(rapporto({ destinatario: "Cliente@Example.com" }), meta)).toEqual({
      tipo: "rimbalzo", message_id_originale: "<crm.r1abcdefgh@ishtar.example>", motivo: "Status 5.1.1: 452 4.2.2 Mailbox full", destinatari: ["cliente@example.com"],
    })
  })

  it("avviso di ritardo, consegna confermata, inoltro: non segnano nulla e non aprono conversazioni", async () => {
    for (const azione of ["delayed", "delivered", "relayed", "expanded"]) {
      expect(await traduciEmail(rapporto({ azione, stato: "4.4.1" }), meta)).toEqual({ tipo: "automatico", motivo: "report" })
    }
  })

  it("ricevuta di lettura e altri rapporti: automatici; un rapporto da un mittente qualsiasi non è un messaggio", async () => {
    const mdn = Buffer.from([
      "From: Giulia <cliente@example.com>", `To: ${CASELLA}`, "Subject: Read: Re: Ordine", "Message-ID: <mdn1@example.com>", "MIME-Version: 1.0",
      'Content-Type: multipart/report; report-type=disposition-notification; boundary="M"', "", "--M", "Content-Type: text/plain", "", "Letta", "",
      "--M", "Content-Type: message/disposition-notification", "", "Original-Message-ID: <crm.r1abcdefgh@ishtar.example>", "Disposition: manual-action/MDN-sent-manually; displayed", "",
      "--M--", "",
    ].join("\r\n"))
    expect(await traduciEmail(mdn, meta)).toEqual({ tipo: "automatico", motivo: "report" })
    expect(await traduciEmail(rapporto({ azione: "delayed", da: "Avvisi <avvisi@hosting.example>" }), meta)).toEqual({ tipo: "automatico", motivo: "report" })
  })

  it("testo di un MAILER-DAEMON senza rapporto: automatico, nessuna risposta segnata", async () => {
    const vecchioStile = Buffer.from([
      "From: MAILER-DAEMON@mx.example", `To: ${CASELLA}`, "Subject: failure notice", "Message-ID: <q1@mx.example>", "",
      "I'm afraid I wasn't able to deliver your message. This is a temporary error, I'll keep trying.", "", "Message-ID: <crm.r1abcdefgh@ishtar.example>", "",
    ].join("\r\n"))
    expect(await traduciEmail(vecchioStile, meta)).toEqual({ tipo: "automatico", motivo: "system sender" })
  })
})

describe("email costruite per consumare tempo: elaborazione in tempo lineare", () => {
  const tempo = async (grezzo: Buffer) => {
    const inizio = Date.now()
    await traduciEmail(grezzo, meta)
    return Date.now() - inizio
  }
  const conTesto = (tipo: string, corpo: string) => Buffer.from(`From: c@example.com\r\nTo: ${CASELLA}\r\nSubject: x\r\nContent-Type: ${tipo}; charset=utf-8\r\n\r\n${corpo}`)

  it("migliaia di righe citate chiuse da una riga normale", async () => {
    expect(await tempo(conTesto("text/plain", `${"> a\r\n".repeat(25_000)}fine\r\n`))).toBeLessThan(1000)
  })

  it("HTML con «<» e «<li» senza chiusura, commenti e script mai chiusi", async () => {
    expect(await tempo(conTesto("text/html", "<".repeat(60_000)))).toBeLessThan(1000)
    expect(await tempo(conTesto("text/html", "<li".repeat(30_000)))).toBeLessThan(1000)
    expect(await tempo(conTesto("text/html", "<!--".repeat(25_000)))).toBeLessThan(1000)
    expect(await tempo(conTesto("text/html", "<script".repeat(15_000)))).toBeLessThan(1000)
  })

  it("rapporto di consegna con migliaia di Diagnostic-Code senza «;» e righe vuote prima di Message-ID", async () => {
    const lungo = Buffer.from([
      "From: MAILER-DAEMON@mx.example", `To: ${CASELLA}`, "Subject: x", "MIME-Version: 1.0", 'Content-Type: multipart/report; report-type=delivery-status; boundary="R"', "",
      "--R", "Content-Type: text/plain", "", "\r\n".repeat(40_000), "--R", "Content-Type: message/delivery-status", "",
      "Final-Recipient: rfc822; c@example.com", "Action: failed", "Diagnostic-Code: x\r\n".repeat(10_000), "--R--", "",
    ].join("\r\n"))
    expect(await tempo(lungo)).toBeLessThan(1000)
  })
})

describe("allegati e mittenti", () => {
  it("allegati di iPhone e Mac (inline con un nome) elencati; le immagini usate dall'HTML no", async () => {
    const apple = Buffer.from([
      "From: Giulia <cliente@example.com>", `To: ${CASELLA}`, "Subject: Vaso rotto", "MIME-Version: 1.0", 'Content-Type: multipart/mixed; boundary="A"', "",
      "--A", "Content-Type: text/plain; charset=utf-8", "", "Ecco la foto del vaso arrivato rotto", "",
      "--A", "Content-Type: image/jpeg; name=IMG_1234.jpeg", "Content-Disposition: inline; filename=IMG_1234.jpeg", "Content-Transfer-Encoding: base64", "", Buffer.alloc(3072, 1).toString("base64"), "",
      "--A", "Content-Type: text/plain; charset=utf-8", "", "Grazie", "", "--A--", "",
    ].join("\r\n"))
    const t = await traduciEmail(apple, meta)
    if (t.tipo !== "messaggio") throw new Error(t.tipo)
    expect(t.inArrivo.testo).toContain("[Attachment: IMG_1234.jpeg, 3 KB]")
    const conLogo = await componi({
      from: "c@example.com", to: CASELLA, subject: "x", text: "Ciao", html: '<p>Ciao</p><img src="cid:logo@negozio">',
      attachments: [{ filename: "logo.png", content: Buffer.alloc(100, 1), cid: "logo@negozio" }, { filename: "fattura.pdf", content: Buffer.alloc(2048, 1) }],
    })
    const u = await traduciEmail(conLogo, meta)
    if (u.tipo !== "messaggio") throw new Error(u.tipo)
    expect(u.inArrivo.dettagli.allegati.map((a) => a.nome)).toEqual(["fattura.pdf"])
  })

  it("From con indirizzo vuoto («\"mario@cliente.it\" <>»): nessun mittente, nessuna conversazione di Mario", async () => {
    const t = await traduciEmail(Buffer.from(`From: "mario@cliente.it" <>\r\nTo: ${CASELLA}\r\nSubject: Ordine\r\n\r\nSpedite in via X\r\n`), meta)
    expect(t).toEqual({ tipo: "automatico", motivo: "no sender" })
  })
})
