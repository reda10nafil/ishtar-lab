import { filtriElenco, rigaConversazione, vistaMessaggio } from "../lib/elenco"

describe("filtri dell'elenco delle conversazioni", () => {
  it("valori predefiniti", () => {
    expect(filtriElenco({})).toEqual({ stato: "aperte", canale: null, q: null, limit: 50, offset: 0 })
  })

  it("limiti di pagina, ricerca, stato e canale", () => {
    expect(filtriElenco({ limit: "500" }).limit).toBe(200)
    expect(filtriElenco({ limit: "0" }).limit).toBe(1)
    expect(filtriElenco({ offset: "-3" }).offset).toBe(0)
    expect(filtriElenco({ q: "  mario " }).q).toBe("mario")
    expect(filtriElenco({ q: "   " }).q).toBeNull()
    expect(filtriElenco({ stato: "chiuse", canale: "telegram" })).toMatchObject({ stato: "chiuse", canale: "telegram" })
  })

  it("canale o stato sconosciuti: errore 400", () => {
    expect(() => filtriElenco({ canale: "fax" })).toThrow("Unknown channel")
    expect(() => filtriElenco({ stato: "tutte" })).toThrow(/status/)
  })
})

describe("vista dei messaggi", () => {
  const base = { id: "msgc_1", testo: "Ciao", quando: "2026-11-13T10:00:00Z", stato_consegna: "inviato", errore: null, autore_nome: "Reda" }

  it("id della risposta solo per i messaggi in uscita", () => {
    expect(vistaMessaggio({ ...base, direzione: "uscita", chiave_unica: "uscita:abc12345" }).id_client).toBe("abc12345")
    expect(vistaMessaggio({ ...base, direzione: "entrata", chiave_unica: "telegram:bot:42" }).id_client).toBeNull()
    expect(vistaMessaggio({ ...base, direzione: "uscita", chiave_unica: null }).id_client).toBeNull()
  })

  it("email del cliente: oggetto, Reply-To, verifica, allegati e testo intero; mai le intestazioni del filo", () => {
    const dettagli = {
      message_id: "<abc@example.com>", in_reply_to: "<crm.x1@ishtar.example>", references: ["<crm.x0@ishtar.example>", "<crm.x1@ishtar.example>"],
      oggetto: "Ordine 12", reply_to: "altro@example.com", verifica: "verificato",
      allegati: [{ nome: "foto.jpg", byte: 2048 }], testo_completo: "Va bene\n> citazione",
    }
    const vista = vistaMessaggio({ ...base, direzione: "entrata", dettagli })
    expect(vista.email).toEqual({ oggetto: "Ordine 12", reply_to: "altro@example.com", verifica: "verificato", allegati: [{ nome: "foto.jpg", byte: 2048 }], testo_completo: "Va bene\n> citazione" })
    expect(JSON.stringify(vista)).not.toMatch(/message_id|in_reply_to|references|abc@example|crm\.x/)
  })

  it("senza dettagli (Telegram) nessun campo email; dettagli rovinati letti solo nei campi con il tipo giusto", () => {
    expect(vistaMessaggio({ ...base, direzione: "entrata", dettagli: null })).not.toHaveProperty("email")
    expect(vistaMessaggio({ ...base, direzione: "entrata" })).not.toHaveProperty("email")
    const rovinati = { oggetto: 3, reply_to: ["x"], verifica: "boh", allegati: [{ nome: 1 }, "x", { nome: "a.pdf", byte: 10 }, { nome: "b", byte: -1 }], testo_completo: {} }
    expect(vistaMessaggio({ ...base, direzione: "entrata", dettagli: rovinati }).email).toEqual({ oggetto: null, reply_to: null, verifica: null, allegati: [{ nome: "a.pdf", byte: 10 }], testo_completo: null })
  })

  it("risposta del team via email: solo l'oggetto usato", () => {
    const dettagli = { message_id: "<crm.abc12345@ishtar.example>", in_reply_to: "<abc@example.com>", references: ["<abc@example.com>"], oggetto: "Re: Ordine 12" }
    expect(vistaMessaggio({ ...base, direzione: "uscita", chiave_unica: "uscita:abc12345", dettagli }).email).toEqual({ oggetto: "Re: Ordine 12", reply_to: null, verifica: null, allegati: [], testo_completo: null })
  })

  it("chat del sito: solo la pagina d'origine (http o https), mai i campi dell'email", () => {
    const sito = (dettagli: unknown, direzione = "entrata") => vistaMessaggio({ ...base, direzione, dettagli }, "sito")
    const vista = sito({ pagina: "https://negozio.example/abiti", dichiarato: true })
    expect(vista.sito).toEqual({ pagina: "https://negozio.example/abiti" })
    expect(vista).not.toHaveProperty("email")
    expect(sito({ pagina: "javascript:alert(1)", dichiarato: true }).sito).toEqual({ pagina: null })
    expect(sito({ pagina: 42 }).sito).toEqual({ pagina: null })
    expect(sito(null)).not.toHaveProperty("sito")
    expect(sito(null)).not.toHaveProperty("email")
    // Senza canale (o per gli altri canali) resta la vista dell'email di prima.
    expect(vistaMessaggio({ ...base, direzione: "entrata", dettagli: { oggetto: "Ordine 12" } }, "email").email?.oggetto).toBe("Ordine 12")
    expect(vistaMessaggio({ ...base, direzione: "entrata", dettagli: { oggetto: "Ordine 12" } }, "email")).not.toHaveProperty("sito")
  })
})

describe("righe dell'elenco", () => {
  it("con l'id dell'identità, da cui il pannello ricava «Visitor XXXX» uguale in elenco e in chat", () => {
    const riga = rigaConversazione({
      id: "conv_1", canale: "sito", stato: "aperta", oggetto: null, ultimo_estratto: "Ciao", non_letti: 1, ultimo_messaggio_il: "2026-11-14T10:00:00Z",
      identita: { id: "idco_01JD8XW4M3T7KQ2", canale: "sito", nome: null, recapito: null, cliente_id: null },
    })
    expect(riga.identita_id).toBe("idco_01JD8XW4M3T7KQ2")
    expect(rigaConversazione({ id: "conv_2", canale: "telegram", stato: "aperta", oggetto: null, ultimo_estratto: "x", non_letti: 0, ultimo_messaggio_il: "2026-11-14T10:00:00Z" }).identita_id).toBeNull()
  })
})
