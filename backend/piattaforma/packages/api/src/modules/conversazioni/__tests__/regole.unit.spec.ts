import { chiaveInArrivo, chiaveUscita, conversazioneDopoNonArrivata, decidiInvio, estratto, filtroNuoviDopo, ID_CLIENT, idClientUscita, ORDINE_MESSAGGI, regolaRileggibile, statoDopo, statoDopoFallimento, tornaInAttesa } from "../regole"

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

describe("ordine dei messaggi e messaggi nuovi", () => {
  it("la conversazione si mostra nell'ordine di arrivo nella casella, lo stesso dei messaggi nuovi", () => {
    // Un messaggio registrato in ritardo (data Telegram più vecchia di una risposta già partita) va in fondo, non sopra.
    expect(ORDINE_MESSAGGI).toEqual({ created_at: "DESC", id: "DESC" })
  })

  it("nuovi dopo l'ultimo mostrato: arrivati dopo, o nello stesso istante con un id successivo", () => {
    const quando = new Date("2026-11-13T10:00:30.123Z")
    expect(filtroNuoviDopo("conv_A", null)).toEqual({ conversazione_id: "conv_A", direzione: "entrata" })
    expect(filtroNuoviDopo("conv_A", { id: "msgc_B", created_at: quando })).toEqual({
      conversazione_id: "conv_A",
      direzione: "entrata",
      $or: [{ created_at: { $gt: quando } }, { created_at: quando, id: { $gt: "msgc_B" } }],
    })
  })

  it("regolaRileggibile: risposta ritrovata → inviata; non ritrovata dopo 2 minuti dal tentativo → fallita; prima si aspetta", () => {
    const adesso = new Date("2026-11-14T12:00:00Z")
    const fa = (secondi: number) => new Date(adesso.getTime() - secondi * 1000)
    expect(regolaRileggibile("incerto", fa(5), true, adesso)).toBe("inviato")
    expect(regolaRileggibile("in_coda", fa(5), true, adesso)).toBe("inviato")
    expect(regolaRileggibile("incerto", fa(30), false, adesso)).toBeNull()
    expect(regolaRileggibile("incerto", fa(119), false, adesso)).toBeNull()
    expect(regolaRileggibile("incerto", fa(120), false, adesso)).toBe("fallito")
    expect(regolaRileggibile("in_coda", fa(600).toISOString(), false, adesso)).toBe("fallito")
    expect(regolaRileggibile("incerto", null, false, adesso)).toBe("fallito")
    // Mai tentata (in coda senza tentativo), già chiusa o ricevuta: non si tocca.
    expect(regolaRileggibile("in_coda", null, true, adesso)).toBeNull()
    for (const stato of ["inviato", "fallito", "ricevuto"] as const) expect(regolaRileggibile(stato, fa(600), true, adesso)).toBeNull()
  })

  it("idClientUscita: l'id della risposta dalla chiave unica, altrimenti l'id del messaggio", () => {
    expect(idClientUscita({ id: "msgc_1", chiave_unica: "uscita:8f14e45f-ceea-467f" })).toBe("8f14e45f-ceea-467f")
    expect(idClientUscita({ id: "msgc_1", chiave_unica: null })).toBe("msgc_1")
    expect(idClientUscita({ id: "msgc_1", chiave_unica: "telegram:bot:1" })).toBe("msgc_1")
  })

  it("risposta riconciliata come non arrivata: la conversazione torna al team, anche se chiusa, con un segno da leggere", () => {
    expect(conversazioneDopoNonArrivata({ stato: "chiusa", non_letti: 0 })).toEqual({ stato: "aperta", non_letti: 1 })
    expect(conversazioneDopoNonArrivata({ stato: "aperta", non_letti: 2 })).toEqual({ stato: "aperta", non_letti: 3 })
    expect(conversazioneDopoNonArrivata({ stato: "in_attesa", non_letti: 0 })).toEqual({ stato: "aperta", non_letti: 1 })
  })

  it("risposta ritrovata: «in attesa» solo se la chat era aperta per quel dubbio e la risposta è l'ultima del team", () => {
    const aperta = { stato: "aperta", non_letti: 0 }
    expect(tornaInAttesa(aperta, 0, "msgc_r1", "msgc_r1")).toBe(true)
    // Una risposta del team dopo (incerta o fallita) tiene la chat al team.
    expect(tornaInAttesa(aperta, 0, "msgc_r2", "msgc_r1")).toBe(false)
    expect(tornaInAttesa({ stato: "aperta", non_letti: 1 }, 0, "msgc_r1", "msgc_r1")).toBe(false)
    expect(tornaInAttesa(aperta, 1, "msgc_r1", "msgc_r1")).toBe(false)
    expect(tornaInAttesa({ stato: "chiusa", non_letti: 0 }, 0, "msgc_r1", "msgc_r1")).toBe(false)
    expect(tornaInAttesa(aperta, 0, null, "msgc_r1")).toBe(false)
  })
})
