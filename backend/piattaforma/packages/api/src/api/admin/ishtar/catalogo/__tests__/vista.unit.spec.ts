import { catalogoIshtar, ishtarPulito, metadatiIshtar, vistaProdotto } from "../vista"

const scheda = {
  id: "prod_1", name: "Borsa", sku: "SKU-1", description: "Pelle", category: "Borse", gender: "Donna", size: "Unica",
  color: "Nero", material: "Pelle", price: 420, cost: 180, stock: 4, photos: ["https://example.com/a.jpg"], demo: true,
  status: "active", incoming: 2, reorder: 3, custom: { lunghezza_cm: 30 },
}
// Prodotto salvato prima della correzione: i metadati contengono ancora costo, prezzo e scorte.
const prodotto = {
  id: "prod_1", title: "Borsa", description: "Pelle", images: [{ url: "https://example.com/a.jpg" }], variants: [{ id: "var_1", sku: "SKU-1" }],
  metadata: { ishtar_v1: { ...scheda, cost: 999, price: 1, stock: 1 } },
}
const offerta = { prezzo: 420, prezzo_cessione: 180, scorte: 4 }

describe("catalogo Ishtar: costo d'acquisto e metadati", () => {
  it("senza il permesso sui margini il costo non esce, nemmeno dai metadati di un prodotto vecchio", () => {
    const vista = vistaProdotto(prodotto, offerta, false)
    expect(vista).not.toHaveProperty("cost")
    expect(JSON.stringify(vista)).not.toContain("999")
  })

  it("con il permesso sui margini il costo arriva dall'offerta, non dai metadati", () => {
    expect(vistaProdotto(prodotto, offerta, true).cost).toBe(180)
  })

  it("prezzo, scorte, nome, foto e SKU vengono dalle loro fonti, il resto dalla scheda", () => {
    expect(vistaProdotto(prodotto, offerta, true)).toEqual({ ...scheda, price: 420, stock: 4, cost: 180 })
  })

  it("nei metadati si salvano solo i campi senza un'altra fonte: mai costo, prezzo o scorte", () => {
    const metadati = metadatiIshtar(scheda, "prod_1")
    expect(metadati).toEqual({ id: "prod_1", category: "Borse", gender: "Donna", size: "Unica", color: "Nero", material: "Pelle",
      demo: true, status: "active", incoming: 2, reorder: 3, custom: { lunghezza_cm: 30 } })
    for (const chiave of ["cost", "price", "stock", "photos", "name", "description", "sku"]) expect(metadati).not.toHaveProperty(chiave)
  })

  it("prodotti già salvati: la scheda da ripulire perde costo, prezzo e scorte e conserva il resto", () => {
    expect(ishtarPulito({ genere: "Donna", ishtar_v1: { ...scheda, id: "prod_1" } })).toEqual(metadatiIshtar(scheda, "prod_1"))
  })

  it("scheda già pulita, assente o malformata: niente da riscrivere", () => {
    expect(ishtarPulito({ ishtar_v1: metadatiIshtar(scheda, "prod_1") })).toBeNull()
    expect(ishtarPulito({ genere: "Donna" })).toBeNull()
    expect(ishtarPulito(null)).toBeNull()
    for (const malformata of ["x", 5, true, ["a"]]) expect(ishtarPulito({ ishtar_v1: malformata })).toBeNull()
  })

  it("nel pannello solo i prodotti con un'offerta di Ishtar Lab: un prodotto di un'altra azienda con ishtar_v1 resta fuori", () => {
    const altrui = { ...prodotto, id: "prod_altrui", metadata: { ishtar_v1: { category: "Borse" } } }
    const elenco = catalogoIshtar([prodotto, altrui], [{ ...offerta, prodotto_id: "prod_1" }], false)
    expect(elenco.map((p) => p.id)).toEqual(["prod_1"])
  })

  it("metadati ishtar_v1 malformati (testo, numero, elenco) non bloccano il catalogo", () => {
    const malformati = ["x", 5, true, ["a"]].map((valore, n) => ({ ...prodotto, id: `prod_m${n}`, metadata: { ishtar_v1: valore } }))
    const offerte = malformati.map((p) => ({ ...offerta, prodotto_id: p.id }))
    expect(() => catalogoIshtar(malformati as any, offerte, true)).not.toThrow()
    expect(catalogoIshtar(malformati as any, offerte, true)).toEqual([])
    expect(() => vistaProdotto({ ...prodotto, metadata: { ishtar_v1: "x" as any } }, offerta, true)).not.toThrow()
  })
})
