import { controllaCampi, modificaOfferta, pianoScorte } from "../salvataggio"

const livello = (voce: string, deposito: string, quantita: number) => ({ voce_id: voce, deposito_id: deposito, quantita })

describe("scorte: cosa scrivere nel magazzino", () => {
  it("scorte invariate: nessuna scrittura (un salvataggio del solo prezzo non riscrive la giacenza)", () => {
    expect(pianoScorte({ scorte: 7, livelli: [livello("iitem_1", "sloc_1", 7)], voci_magazzino: ["iitem_1"] }, 7)).toEqual({ tipo: "invariate" })
  })
  it("un solo deposito: si aggiorna quel livello", () => {
    expect(pianoScorte({ scorte: 7, livelli: [livello("iitem_1", "sloc_1", 7)], voci_magazzino: ["iitem_1"] }, 9))
      .toEqual({ tipo: "livello", voce: "iitem_1", deposito: "sloc_1", quantita: 9 })
  })
  it("nessun livello ancora (il caso più comune): si crea dentro lo stesso salvataggio", () => {
    expect(pianoScorte({ scorte: 0, livelli: [], voci_magazzino: ["iitem_2"] }, 4)).toEqual({ tipo: "nuovo-livello", voce: "iitem_2", quantita: 4 })
  })
  it("più depositi: rifiutato, le scorte si cambiano dal Magazzino (il totale non va scritto su un solo deposito)", () => {
    const offerta = { scorte: 10, livelli: [livello("iitem_1", "sloc_1", 6), livello("iitem_1", "sloc_2", 4)], voci_magazzino: ["iitem_1"] }
    expect(() => pianoScorte(offerta, 12)).toThrow(/più depositi/)
  })
  it("articolo senza voce di magazzino: errore esplicito invece di un salvataggio che non scrive nulla", () => {
    expect(() => pianoScorte({ scorte: 0, livelli: [], voci_magazzino: [] }, 3)).toThrow(/voce di magazzino/)
  })
})

const campi = [
  { id: "fodera", label: "Fodera", type: "text", category: "", options: [], required: true },
  { id: "taglio", label: "Taglio", type: "select", category: "Pellicce", options: ["Corto", "Lungo"], required: true },
  { id: "altezza", label: "Altezza", type: "number", category: "Borse", options: [], required: false },
]

describe("campi personalizzati obbligatori", () => {
  it("creazione: un obbligatorio vuoto è rifiutato", () => {
    expect(controllaCampi({ campi, categoria: "Borse", custom: {}, precedente: null })).toBe("Compilare Fodera")
  })
  it("modifica di un prodotto già esistente senza il valore: scorte, prezzo e stato si salvano lo stesso", () => {
    expect(controllaCampi({ campi, categoria: "Borse", custom: {}, precedente: { categoria: "Borse", custom: {} } })).toBeNull()
  })
  it("un obbligatorio che aveva un valore non si può svuotare", () => {
    expect(controllaCampi({ campi, categoria: "Borse", custom: { fodera: "" }, precedente: { categoria: "Borse", custom: { fodera: "Seta" } } })).toBe("Compilare Fodera")
  })
  it("spostato nella categoria del campo senza compilarlo: rifiutato", () => {
    expect(controllaCampi({ campi, categoria: "Pellicce", custom: { fodera: "Seta" }, precedente: { categoria: "Borse", custom: { fodera: "Seta" } } })).toBe("Compilare Taglio")
  })
  it("tipo e scelte si controllano solo sui valori nuovi o cambiati", () => {
    const precedente = { categoria: "Pellicce", custom: { fodera: "Seta", taglio: "Medio" } }
    expect(controllaCampi({ campi, categoria: "Pellicce", custom: { fodera: "Seta", taglio: "Medio" }, precedente })).toBeNull()
    expect(controllaCampi({ campi, categoria: "Pellicce", custom: { fodera: "Seta", taglio: "Enorme" }, precedente })).toBe("Taglio: valore non valido")
    expect(controllaCampi({ campi, categoria: "Borse", custom: { fodera: "Seta", altezza: "alta" }, precedente: null })).toBe("Altezza: indicare un numero")
  })
})

describe("offerta: si aggiorna solo ciò che cambia", () => {
  const offerta = { prezzo: 120, prezzo_cessione: 65, metadata: { prezzo_cessione: 65, altro: "x" } }
  it("prezzo e costo invariati: nessuna scrittura", () => {
    expect(modificaOfferta(offerta, 120, 65)).toBeNull()
  })
  it("prezzo o costo assenti: lo 0 mostrato dal pannello non crea un prezzo di 0 €", () => {
    expect(modificaOfferta({ prezzo: null, prezzo_cessione: null, metadata: {} }, 0, 0)).toBeNull()
  })
  it("cambia il prezzo: costo e metadati restano", () => {
    expect(modificaOfferta(offerta, 130, 65)).toEqual({ prezzo: 130, metadata: offerta.metadata })
  })
  it("cambia solo il costo: i prezzi non si toccano", () => {
    expect(modificaOfferta(offerta, 120, 70)).toEqual({ metadata: { prezzo_cessione: 70, altro: "x" } })
  })
})

describe("campi obbligatori: casi del cambio di categoria", () => {
  it("un campo valido per tutte le categorie non diventa obbligatorio solo perché si cambia categoria", () => {
    expect(controllaCampi({ campi: [campi[0]], categoria: "Pellicce", custom: {}, precedente: { categoria: "Borse", custom: {} } })).toBeNull()
  })
  it("entrando nella categoria del campo, anche un valore già salvato viene controllato", () => {
    const precedente = { categoria: "Borse", custom: { fodera: "Seta", taglio: "Enorme" } }
    expect(controllaCampi({ campi, categoria: "Pellicce", custom: { fodera: "Seta", taglio: "Enorme" }, precedente })).toBe("Taglio: valore non valido")
  })
})
