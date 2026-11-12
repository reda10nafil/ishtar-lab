import { filtroRicerca } from "../ricerca"

describe("ricerca delle carte regalo", () => {
  it("chi può vedere i codici cerca anche per codice", () => {
    expect(filtroRicerca("K7QM", true)).toEqual({ q: "K7QM" })
  })

  it("con la sola lettura si cerca per destinatario: il codice non è usabile come oracolo", () => {
    const filtro = filtroRicerca("K7QM", false)
    expect(filtro).toEqual({ $or: [{ destinatario_nome: { $ilike: "%K7QM%" } }, { destinatario_email: { $ilike: "%K7QM%" } }] })
    expect(JSON.stringify(filtro)).not.toContain("codice")
    expect(filtro).not.toHaveProperty("q")
  })

  it("i caratteri jolly della ricerca restano testo", () => {
    expect(filtroRicerca("50%_a\\b", false)).toEqual({
      $or: [{ destinatario_nome: { $ilike: "%50\\%\\_a\\\\b%" } }, { destinatario_email: { $ilike: "%50\\%\\_a\\\\b%" } }],
    })
  })

  it("senza testo nessun filtro", () => {
    expect(filtroRicerca("", false)).toEqual({})
    expect(filtroRicerca("", true)).toEqual({})
  })
})
