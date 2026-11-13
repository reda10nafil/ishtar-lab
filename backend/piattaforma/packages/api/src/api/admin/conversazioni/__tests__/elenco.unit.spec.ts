import { filtriElenco } from "../lib/elenco"

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
