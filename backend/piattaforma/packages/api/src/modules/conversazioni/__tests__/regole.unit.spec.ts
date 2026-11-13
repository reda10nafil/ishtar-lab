import { chiaveInArrivo, chiaveUscita, decidiInvio, estratto, ID_CLIENT, statoDopo, statoDopoFallimento } from "../regole"

describe("regole della casella", () => {
  it("estratto: spazi compressi e taglio con i puntini", () => {
    expect(estratto("Ciao\n\n  come   va?")).toBe("Ciao come va?")
    const lungo = estratto("a".repeat(200))
    expect(lungo).toHaveLength(140)
    expect(lungo.endsWith("…")).toBe(true)
  })

  it("estratto: non spezza un'emoji a metà", () => {
    expect(estratto("a".repeat(138) + "😀😀😀")).toBe("a".repeat(138) + "😀…")
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

  it("decisione d'invio: si rimanda solo ciò che certamente non è partito", () => {
    expect(decidiInvio(null)).toBe("invia")
    expect(decidiInvio({ stato_consegna: "fallito", tentato_il: new Date() })).toBe("invia")
    expect(decidiInvio({ stato_consegna: "inviato", tentato_il: new Date() })).toBe("gia_inviato")
    expect(decidiInvio({ stato_consegna: "incerto", tentato_il: new Date() })).toBe("incerto")
    // In coda sotto il lucchetto dello stesso id: il tentativo precedente si è interrotto.
    expect(decidiInvio({ stato_consegna: "in_coda", tentato_il: null })).toBe("invia")
    expect(decidiInvio({ stato_consegna: "in_coda", tentato_il: new Date() })).toBe("incerto")
  })

  it("dopo una risposta non consegnata la conversazione torna al team, se non è chiusa", () => {
    expect(statoDopoFallimento("in_attesa")).toBe("aperta")
    expect(statoDopoFallimento("aperta")).toBe("aperta")
    expect(statoDopoFallimento("chiusa")).toBe("chiusa")
  })

  it("identificativo di una risposta", () => {
    expect(ID_CLIENT.test("a1B2c3D4")).toBe(true)
    expect(ID_CLIENT.test("abc")).toBe(false)
    expect(ID_CLIENT.test("a b c d e f g h")).toBe(false)
  })
})
