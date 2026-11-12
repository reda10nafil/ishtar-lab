import { calcolaOutfit, motivoBloccoPubblicazione, valutaScheda, type Riga, type Scheda } from "../calcolo"

const scheda = (varianti: Partial<Scheda["varianti"][number]>[], altro: Partial<Scheda> = {}): Scheda => ({
  product_id: "p",
  azienda_id: "a",
  titolo: "Capo",
  foto: null,
  azienda_nome: "Azienda",
  in_vendita: true,
  azienda_attiva: true,
  con_offerta: true,
  varianti: varianti.map((v, i) => ({ id: `v${i}`, titolo: `T${i}`, sku: null, prezzo: 100, costo: 60, quantita: 5, disponibile: true, ...v })),
  ...altro,
})

const riga = (titolo: string, s: Scheda | undefined, alt?: Scheda): Riga => ({
  titolo,
  principale: valutaScheda(s),
  alternativa: alt ? valutaScheda(alt) : null,
})

const somma = { modalita_prezzo: "somma", prezzo_fisso: null, sconto_a_carico: "negozio", quota_negozio: 100 } as const
const fisso = (prezzo: number, sconto_a_carico: "negozio" | "aziende" | "ripartito", quota_negozio = 100) =>
  ({ modalita_prezzo: "fisso", prezzo_fisso: prezzo, sconto_a_carico, quota_negozio }) as const

describe("valutazione di un capo", () => {
  it("usa come riferimento la variante disponibile meno cara", () => {
    const v = valutaScheda(scheda([{ prezzo: 90, quantita: 0, disponibile: false }, { prezzo: 120 }, { prezzo: 110 }]))
    expect(v).toMatchObject({ acquistabile: true, prezzo: 110, prezzo_varia: true })
  })

  it("segnala il capo esaurito senza inventare disponibilità", () => {
    expect(valutaScheda(scheda([{ quantita: 0, disponibile: false }]))).toMatchObject({ acquistabile: false, problema: "Sold out", prezzo: 100 })
  })

  it("distingue prodotto assente, ritirato, azienda sospesa e offerta mancante", () => {
    expect(valutaScheda(undefined).problema).toBe("Product no longer in the catalogue")
    expect(valutaScheda(scheda([{}], { in_vendita: false })).problema).toBe("Product is not on sale")
    expect(valutaScheda(scheda([{}], { azienda_attiva: false })).problema).toBe("Company is not active")
    expect(valutaScheda(scheda([{ prezzo: null, disponibile: false }], { con_offerta: false })).problema).toBe("The company has no offer for this product")
  })
})

describe("disponibilità dell'outfit", () => {
  it("è acquistabile solo se ogni capo lo è", () => {
    const ok = calcolaOutfit(somma, [riga("A", scheda([{}])), riga("B", scheda([{}]))])
    expect(ok.disponibilita).toEqual({ acquistabile: true, motivi: [], capi_sostituiti: 0 })
    const ko = calcolaOutfit(somma, [riga("A", scheda([{}])), riga("B", scheda([{ quantita: 0, disponibile: false }]))])
    expect(ko.disponibilita.acquistabile).toBe(false)
    expect(ko.disponibilita.motivi).toEqual(["B: Sold out"])
  })

  it("passa all'alternativa quando il capo finisce, con il suo prezzo", () => {
    const esaurito = scheda([{ prezzo: 100, quantita: 0, disponibile: false }])
    const r = calcolaOutfit(somma, [riga("A", scheda([{}])), riga("B", esaurito, scheda([{ prezzo: 80, costo: 40 }]))])
    expect(r.disponibilita).toMatchObject({ acquistabile: true, capi_sostituiti: 1 })
    expect(r.sostituzioni).toEqual([false, true])
    expect(r.prezzo.somma).toBe(180)
    expect(r.economia.costo_capi).toBe(100)
  })

  it("nomina l'alternativa, non il capo sostituito, se a lei manca il costo", () => {
    const esaurito = scheda([{ quantita: 0, disponibile: false }])
    const r = calcolaOutfit(somma, [{ ...riga("B", esaurito, scheda([{ costo: null }])), titolo_alternativa: "C" }])
    expect(r.economia.mancanti).toEqual(["C"])
  })

  it("non è acquistabile se anche l'alternativa è finita", () => {
    const esaurito = scheda([{ quantita: 0, disponibile: false }])
    const r = calcolaOutfit(somma, [riga("B", esaurito, esaurito)])
    expect(r.disponibilita.acquistabile).toBe(false)
    expect(r.sostituzioni).toEqual([false])
  })

  it("un outfit senza capi o senza prezzo fisso non è acquistabile", () => {
    expect(calcolaOutfit(somma, []).disponibilita.motivi).toEqual(["The outfit has no pieces"])
    const senzaPrezzo = { ...somma, modalita_prezzo: "fisso" } as const
    expect(calcolaOutfit(senzaPrezzo, [riga("A", scheda([{}]))]).disponibilita.motivi).toEqual(["Outfit price is missing"])
  })
})

describe("prezzo e chi sostiene lo sconto", () => {
  const capi = () => [riga("A", scheda([{ prezzo: 100, costo: 60 }])), riga("B", scheda([{ prezzo: 300, costo: 180 }]))]

  it("in modalità somma non c'è sconto", () => {
    const r = calcolaOutfit(somma, capi())
    expect(r.prezzo).toMatchObject({ somma: 400, finale: 400, sconto: 0 })
    expect(r.economia).toMatchObject({ costo_capi: 240, costo_netto: 240, margine: 160, margine_percentuale: 0.4 })
  })

  it("sconto a carico del negozio: il costo non cambia e il margine scende", () => {
    const r = calcolaOutfit(fisso(320, "negozio"), capi())
    expect(r.prezzo).toMatchObject({ finale: 320, sconto: 80, sconto_negozio: 80, sconto_aziende: 0 })
    expect(r.economia).toMatchObject({ costo_netto: 240, margine: 80 })
    expect(r.scontiCapo).toEqual([0, 0])
  })

  it("sconto a carico delle aziende: si divide in proporzione al prezzo dei capi", () => {
    const r = calcolaOutfit(fisso(320, "aziende"), capi())
    expect(r.prezzo).toMatchObject({ sconto_negozio: 0, sconto_aziende: 80 })
    expect(r.scontiCapo).toEqual([20, 60])
    expect(r.economia).toMatchObject({ costo_netto: 160, margine: 160 })
  })

  it("sconto ripartito secondo la quota del negozio", () => {
    const r = calcolaOutfit(fisso(320, "ripartito", 25), capi())
    expect(r.prezzo).toMatchObject({ sconto_negozio: 20, sconto_aziende: 60 })
    expect(r.scontiCapo).toEqual([15, 45])
    expect(r.economia.margine).toBe(140)
  })

  it("un prezzo outfit sopra la somma non è uno sconto e viene segnalato", () => {
    const r = calcolaOutfit(fisso(500, "aziende"), capi())
    expect(r.prezzo).toMatchObject({ sconto: 0, sopra_somma: true })
  })
})

describe("dati di costo", () => {
  it("non stima: se manca un costo, costo e margine restano vuoti e il capo viene nominato", () => {
    const r = calcolaOutfit(somma, [riga("A", scheda([{ costo: 60 }])), riga("B", scheda([{ costo: null }]))])
    expect(r.economia).toMatchObject({ costo_capi: null, costo_netto: null, margine: null, margine_percentuale: null, mancanti: ["B"] })
    expect(r.prezzo.finale).toBe(200)
  })
})

describe("pubblicazione", () => {
  it("chiede almeno due capi e nessun problema aperto", () => {
    expect(motivoBloccoPubblicazione(1, [])).toContain("at least two pieces")
    expect(motivoBloccoPubblicazione(2, ["B: Sold out"])).toBe("Cannot publish: B: Sold out")
    expect(motivoBloccoPubblicazione(2, [])).toBeNull()
  })
})
