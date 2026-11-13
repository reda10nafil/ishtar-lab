import { chiaveInArrivo, chiaveUscita, decidiInvio, estratto, ID_CLIENT, statoDopo } from "../regole"

describe("regole della casella", () => {
  it("estratto: spazi compressi e taglio con i puntini", () => {
    expect(estratto("Ciao\n\n  come   va?")).toBe("Ciao come va?")
    const lungo = estratto("a".repeat(200))
    expect(lungo).toHaveLength(140)
    expect(lungo.endsWith("…")).toBe(true)
  })

  it("chiavi uniche di entrata e di uscita", () => {
    expect(chiaveInArrivo({ canale: "telegram", account: "negozio_bot", id_messaggio: "123:45" })).toBe("telegram:negozio_bot:123:45")
    expect(chiaveUscita("abc12345")).toBe("uscita:abc12345")
  })

  it("stato dopo un messaggio", () => {
    expect(statoDopo("chiusa", "entrata")).toBe("aperta")
    expect(statoDopo("in_attesa", "entrata")).toBe("aperta")
    expect(statoDopo("aperta", "uscita")).toBe("in_attesa")
    expect(statoDopo("in_attesa", "uscita")).toBe("in_attesa")
    expect(() => statoDopo("chiusa", "uscita")).toThrow(/closed/)
  })

  it("decisione d'invio: si manda solo ciò che non è già partito o in partenza", () => {
    expect(decidiInvio(null)).toBe("invia")
    expect(decidiInvio({ stato_consegna: "fallito" })).toBe("invia")
    expect(decidiInvio({ stato_consegna: "inviato" })).toBe("gia_inviato")
    expect(decidiInvio({ stato_consegna: "in_coda" })).toBe("in_corso")
  })

  it("identificativo di una risposta", () => {
    expect(ID_CLIENT.test("a1B2c3D4")).toBe(true)
    expect(ID_CLIENT.test("abc")).toBe(false)
    expect(ID_CLIENT.test("a b c d e f g h")).toBe(false)
  })
})
