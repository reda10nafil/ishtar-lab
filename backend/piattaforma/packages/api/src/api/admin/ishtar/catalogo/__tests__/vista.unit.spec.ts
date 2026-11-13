import { catalogoIshtar, daSpostare, ishtarPulito, metadatiIshtar, sogliaDaScrivere, vistaProdotto } from "../vista"

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
// In arrivo e soglia di sicurezza dal magazzino (livello e voce), come le scorte.
const offerta = { prezzo: 420, prezzo_cessione: 180, scorte: 4, in_arrivo: 2, soglia: 3 }

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
    expect(vistaProdotto(prodotto, offerta, true)).toEqual({ ...scheda, price: 420, stock: 4, cost: 180, stock_locked: false })
  })

  it("nei metadati si salvano solo i campi senza un'altra fonte: mai costo, prezzo o scorte", () => {
    const metadati = metadatiIshtar(scheda, "prod_1")
    expect(metadati).toEqual({ id: "prod_1", category: "Borse", gender: "Donna", size: "Unica", color: "Nero", material: "Pelle",
      demo: true, status: "active", custom: { lunghezza_cm: 30 } })
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

  it("stato, categoria, materiale e genere dai campi del prodotto, che modifica anche la console", () => {
    const p = { ...prodotto, status: "published", material: "Lino", categories: [{ name: "Altro" }, { name: "Pellicce" }],
      metadata: { genere: "Uomo", ishtar_v1: { ...scheda, status: "draft", category: "Borse", material: "Pelle", gender: "Donna" } } }
    expect(vistaProdotto(p, offerta, true, ["Borse", "Pellicce"])).toMatchObject({ status: "active", category: "Pellicce", material: "Lino", gender: "Uomo" })
  })

  it("archiviato: nel prodotto è una bozza e la scheda lo distingue; una bozza della console resta bozza", () => {
    const archiviato = { ...prodotto, status: "draft", metadata: { ishtar_v1: { ...scheda, status: "archived" } } }
    expect(vistaProdotto(archiviato, offerta, true, []).status).toBe("archived")
    const bozzaConsole = { ...prodotto, status: "draft", metadata: { ishtar_v1: { ...scheda, status: "active" } } }
    expect(vistaProdotto(bozzaConsole, offerta, true, []).status).toBe("draft")
  })

  it("categoria nativa fuori dal catalogo Ishtar: resta quella della scheda (il salvataggio successivo non viene rifiutato)", () => {
    const p = { ...prodotto, categories: [{ name: "Saldi" }], metadata: { ishtar_v1: { ...scheda, category: "Borse" } } }
    expect(vistaProdotto(p, offerta, true, ["Borse", "Pellicce"]).category).toBe("Borse")
  })

  it("genere tolto dalla console (chiave presente ma vuota): il pannello non rimette il valore vecchio", () => {
    const p = { ...prodotto, metadata: { genere: null, ishtar_v1: { ...scheda, gender: "Donna" } } }
    expect(vistaProdotto(p as any, offerta, true, []).gender).toBe("")
  })

  it("in arrivo e riordino vengono dal magazzino vero (incoming_quantity e soglia di sicurezza), non dalla scheda", () => {
    const vista = vistaProdotto(prodotto, { ...offerta, in_arrivo: 7, soglia: 3 }, true, [])
    expect([vista.incoming, vista.reorder]).toEqual([7, 3])
  })
  it("soglia mai impostata: 5, come nel Magazzino", () => {
    expect(vistaProdotto(prodotto, { prezzo: 1, prezzo_cessione: 1, scorte: 1 }, true).reorder).toBe(5)
  })
  it("più depositi: le scorte risultano bloccate nel pannello (si cambiano dal Magazzino)", () => {
    const livello = (deposito: string) => ({ voce_id: "iitem_1", deposito_id: deposito, quantita: 2 })
    expect(vistaProdotto(prodotto, { ...offerta, livelli: [livello("sloc_1"), livello("sloc_2")] }, true).stock_locked).toBe(true)
    expect(vistaProdotto(prodotto, { ...offerta, livelli: [livello("sloc_1")] }, true).stock_locked).toBe(false)
  })
  it("nei metadati non si salvano più in arrivo e riordino", () => {
    expect(metadatiIshtar(scheda, "prod_1")).not.toHaveProperty("incoming")
    expect(metadatiIshtar(scheda, "prod_1")).not.toHaveProperty("reorder")
  })
})

describe("in arrivo e riordino rimasti nella scheda di un prodotto salvato prima", () => {
  it("valori predefiniti (come nei dati dimostrativi): niente da spostare, la scheda si ripulisce", () => {
    expect(daSpostare({ incoming: 0, reorder: 5 })).toEqual({ in_arrivo: 0, riordino: null })
    expect(ishtarPulito({ ishtar_v1: { category: "Borse", incoming: 0, reorder: 5 } })).toEqual({ category: "Borse" })
  })
  it("merce in arrivo e soglia propria: da spostare nel magazzino", () => {
    expect(daSpostare({ incoming: 7, reorder: 3 })).toEqual({ in_arrivo: 7, riordino: 3 })
  })
  it("valori non validi (testo, negativi, decimali) o assenti: ignorati", () => {
    expect(daSpostare({ incoming: "7", reorder: -1 })).toEqual({ in_arrivo: 0, riordino: null })
    expect(daSpostare({ incoming: 2.5, reorder: 1.5 })).toEqual({ in_arrivo: 0, riordino: null })
    expect(daSpostare(null)).toEqual({ in_arrivo: 0, riordino: null })
  })
})

describe("riordino vecchio e soglia già presente nella voce di magazzino", () => {
  it("voce senza soglia: si scrive il riordino della scheda", () => {
    expect(sogliaDaScrivere(undefined, 3)).toEqual({ scrivi: true })
  })
  it("soglia tolta apposta dal Magazzino (null: vale quella dell'azienda): resta così", () => {
    expect(sogliaDaScrivere(null, 3)).toEqual({ scrivi: false, avviso: "soglia tolta dal Magazzino: resta quella dell'azienda" })
  })
  it("soglia valida già impostata: resta quella del Magazzino, e se è diversa lo si dice", () => {
    expect(sogliaDaScrivere(3, 3)).toEqual({ scrivi: false })
    expect(sogliaDaScrivere(8, 3)).toEqual({ scrivi: false, avviso: "soglia 8 già impostata dal Magazzino: resta quella" })
  })
  it("soglia non valida (testo, negativa, decimale), che il Magazzino ignora: sostituita, e lo si dice", () => {
    for (const valore of ["3", -1, 2.5]) expect(sogliaDaScrivere(valore, 3)).toEqual({ scrivi: true, avviso: `soglia non valida (${JSON.stringify(valore)}) sostituita` })
  })
})

