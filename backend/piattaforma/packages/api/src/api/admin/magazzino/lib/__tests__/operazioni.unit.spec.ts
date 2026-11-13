import { conflittoInConteggio, messaggioConteggio, pianoConteggio, pianoCorrezione, RICARICA } from "../operazioni"

const riga = (articolo: string, giacenza: number, sku = "SKU-1") =>
  ({ articolo_id: articolo, deposito_id: "sloc_1", deposito: "Deposito", azienda_id: "sel_1", azienda: "Azienda", sku, prodotto: "Borsa", giacenza }) as any
const contatore = () => { let n = 0; return () => `op-${++n}` }

describe("correzione del Magazzino delle aziende", () => {
  it("variazione (+/− unità): movimento relativo con motivo e nota, e l'id mandato dalla console", () => {
    expect(pianoCorrezione({ variazione: -2, motivo: "danneggiato", nota: "bagnata", id: "cor-abc12345" }, riga("iitem_1", 10), contatore()))
      .toEqual({ voce: "iitem_1", deposito: "sloc_1", azienda: "sel_1", nome_deposito: "Deposito",
        movimenti: [{ id: "cor-abc12345", differenza: -2, in_arrivo: 0, motivo: "danneggiato", nota: "bagnata" }] })
  })
  it("quantità nuova: correzione con il valore da cui la console è partita", () => {
    expect(pianoCorrezione({ quantita: 12, prima: 10, motivo: "reso" }, riga("iitem_1", 10), contatore()).conteggio)
      .toEqual({ id: "op-1", prima: [10], dopo: 12, tipo: "correzione", motivo: "reso", nota: null })
  })
  it("quantità nuova senza valore di partenza (finestra con il codice di prima): invito a ricaricare", () => {
    expect(() => pianoCorrezione({ quantita: 12, motivo: "reso" }, riga("iitem_1", 10), contatore())).toThrow(RICARICA)
  })
  it("nessun cambiamento: rifiutato come prima", () => {
    expect(() => pianoCorrezione({ quantita: 10, prima: 10, motivo: "reso" }, riga("iitem_1", 10), contatore())).toThrow(/already at this quantity/)
    expect(() => pianoCorrezione({ variazione: 0, motivo: "reso" }, riga("iitem_1", 10), contatore())).toThrow(/already at this quantity/)
  })
  it("giacenza attuale già uguale alla quantità scritta, anche se diversa da quella mostrata: rifiutato, è già così", () => {
    expect(() => pianoCorrezione({ quantita: 9, prima: 10, motivo: "reso" }, riga("iitem_1", 9), contatore())).toThrow(/already at this quantity/)
  })
  it("quantità scritta uguale a quella mostrata ma giacenza cambiata intanto: va al workflow, che risponde con il valore attuale", () => {
    expect(pianoCorrezione({ quantita: 10, prima: 10, motivo: "reso" }, riga("iitem_1", 9), contatore()).conteggio)
      .toEqual({ id: "op-1", prima: [10], dopo: 10, tipo: "correzione", motivo: "reso", nota: null })
  })
  it("variazione che porterebbe sotto zero: la controlla il workflow, dopo aver riconosciuto un invio ripetuto", () => {
    // Giacenza 3, «Change −3» applicato e risposta persa: rimandato con lo stesso id trova 0 e non deve dare «below zero».
    expect(pianoCorrezione({ variazione: -3, motivo: "danneggiato", id: "cor-ripetuta1" }, riga("iitem_1", 0), contatore()).movimenti)
      .toEqual([{ id: "cor-ripetuta1", differenza: -3, in_arrivo: 0, motivo: "danneggiato", nota: null }])
    expect(pianoCorrezione({ variazione: 1, motivo: "rettifica" }, riga("iitem_1", -3), contatore()).movimenti[0].differenza).toBe(1)
  })
})

describe("conteggio del Magazzino delle aziende", () => {
  const righe = [riga("iitem_1", 10, "SKU-1"), riga("iitem_2", 4, "SKU-2")]
  it("ogni riga contata diventa un conteggio con la giacenza mostrata quando si è iniziato a contare", () => {
    const piano = pianoConteggio({ righe: [{ articolo_id: "iitem_1", deposito_id: "sloc_1", contata: 8, prima: 10 }], nota: "inventario" }, righe, contatore())
    expect(piano.conflitti).toEqual([])
    expect(piano.operazioni[0].conteggio).toEqual({ id: "op-1", prima: [10], dopo: 8, tipo: "conteggio", motivo: "rettifica", nota: "inventario" })
  })
  it("giacenza cambiata dopo l'inizio del conteggio (per esempio una vendita): conflitto con il valore attuale, niente da scrivere", () => {
    const piano = pianoConteggio({ righe: [{ articolo_id: "iitem_1", deposito_id: "sloc_1", contata: 8, prima: 11 }, { articolo_id: "iitem_2", deposito_id: "sloc_1", contata: 4, prima: 4 }] }, righe, contatore())
    expect(piano.conflitti).toEqual([{ articolo_id: "iitem_1", deposito_id: "sloc_1", sku: "SKU-1", prodotto: "Borsa", attuale: 10, prima: 11 }])
  })
  it("giacenza già uguale a quella contata: nessun conflitto (anche un nuovo invio dopo una risposta persa)", () => {
    expect(pianoConteggio({ righe: [{ articolo_id: "iitem_1", deposito_id: "sloc_1", contata: 10, prima: 12 }] }, righe, contatore()).conflitti).toEqual([])
  })
  it("righe senza giacenza di partenza (pagina con il codice di prima): invito a ricaricare", () => {
    expect(() => pianoConteggio({ righe: [{ articolo_id: "iitem_1", deposito_id: "sloc_1", contata: 8 }] } as any, righe, contatore())).toThrow(RICARICA)
  })
  it("conflitto uscito dal workflow (vendita fra la lettura e il lucchetto): la riga con SKU, partenza e valore attuale", () => {
    const corpo = { righe: [{ articolo_id: "iitem_1", deposito_id: "sloc_1", contata: 8, prima: 10 }, { articolo_id: "iitem_2", deposito_id: "sloc_1", contata: 3, prima: 4 }] }
    expect(conflittoInConteggio({ attuale: 2, articolo_id: "iitem_2", deposito_id: "sloc_1" }, corpo, righe))
      .toEqual({ articolo_id: "iitem_2", deposito_id: "sloc_1", sku: "SKU-2", prodotto: "Borsa", attuale: 2, prima: 4 })
    expect(conflittoInConteggio({ attuale: 2 }, corpo, righe)).toBeNull()
  })
  it("messaggio: quante righe sono cambiate e quali, con il valore attuale", () => {
    expect(messaggioConteggio([{ articolo_id: "a", deposito_id: "d", sku: "SKU-1", prodotto: "Borsa", attuale: 10, prima: 11 }]))
      .toBe("Count not recorded: stock changed for 1 item since you started counting (SKU-1 now 10). Check it and record the count again.")
  })
})
