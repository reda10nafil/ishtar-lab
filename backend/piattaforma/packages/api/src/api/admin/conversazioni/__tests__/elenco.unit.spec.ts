import { filtriElenco, vistaMessaggio } from "../lib/elenco"

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
})
