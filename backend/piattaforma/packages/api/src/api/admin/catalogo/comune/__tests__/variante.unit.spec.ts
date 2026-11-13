import { codiciNuovaOfferta, conflittoInScrittura, messaggioVariante, pianoVariante, RICARICA_CONSOLE, SchemaVariante } from "../variante"

const variante = { id: "variant_1", title: "Nera", sku: "SKU-1", ean: null }
const offerta = (extra: Record<string, unknown> = {}) => ({
  id: "offer_1", azienda: { id: "sel_1", nome: "Ishtar Lab" }, prezzo: 120, prezzo_cessione: 50, prezzo_consigliato: 150, scorte: 10,
  livelli: [{ voce_id: "iitem_1", deposito_id: "sloc_1", quantita: 10 }], voci_magazzino: ["iitem_1"], prezzi: [], metadata: {}, ...extra,
}) as any
const prima = { prezzo: 120, prezzo_cessione: 50, prezzo_consigliato: 150, quantita: 10 }
const contatore = () => { let n = 0; return () => `cnt-${++n}` }

describe("finestra varianti della console", () => {
  it("cambia solo il prezzo: si aggiorna solo il prezzo, le scorte non si toccano (anche se intanto sono cambiate)", () => {
    const piano = pianoVariante({ offerte: [{ id: "offer_1", prima, prezzo: 130 }] }, variante, [offerta({ scorte: 9 })], contatore())
    expect(piano).toEqual({ conflitti: [], campi: {}, offerte: [{ id: "offer_1", prezzo: 130 }], scorte: [] })
  })
  it("valori mandati ma uguali a quelli di partenza (finestra che manda tutto): non si scrivono", () => {
    const piano = pianoVariante({ titolo: "Nera", prima: { titolo: "Nera", sku: "SKU-1", ean: null }, offerte: [{ id: "offer_1", prima, prezzo: 120, quantita: 10 }] },
      variante, [offerta({ scorte: 9, prezzo: 125 })], contatore())
    expect(piano).toEqual({ conflitti: [], campi: {}, offerte: [], scorte: [] })
  })
  it("prezzo cambiato altrove: conflitto con il valore attuale e l'azienda", () => {
    expect(pianoVariante({ offerte: [{ id: "offer_1", prima, prezzo: 130 }] }, variante, [offerta({ prezzo: 125 })], contatore()).conflitti)
      .toEqual([{ campo: "prezzo", attuale: 125, tuo: 130, offerta: "offer_1", azienda: "Ishtar Lab" }])
  })
  it("quantità cambiata: conteggio con il valore di partenza; costo e consigliato nei metadati, solo quelli cambiati", () => {
    const piano = pianoVariante({ offerte: [{ id: "offer_1", prima, quantita: 12, prezzo_cessione: 55 }] }, variante, [offerta()], contatore())
    expect(piano.scorte).toEqual([{ offerta: "offer_1", voce: "iitem_1", deposito: "sloc_1", azienda: "sel_1", conteggio: { id: "cnt-1", prima: [10], dopo: 12, tipo: "conteggio", motivo: null, nota: null } }])
    expect(piano.offerte).toEqual([{ id: "offer_1", metadata: { prezzo_cessione: 55 } }])
  })
  it("quantità cambiata altrove (per esempio una vendita): conflitto", () => {
    expect(pianoVariante({ offerte: [{ id: "offer_1", prima, quantita: 12 }] }, variante, [offerta({ scorte: 9 })], contatore()).conflitti)
      .toEqual([{ campo: "quantita", attuale: 9, tuo: 12, offerta: "offer_1", azienda: "Ishtar Lab" }])
  })
  it("più depositi: la quantità si cambia dal Magazzino", () => {
    const due = offerta({ livelli: [{ voce_id: "iitem_1", deposito_id: "sloc_1", quantita: 6 }, { voce_id: "iitem_1", deposito_id: "sloc_2", quantita: 4 }] })
    expect(() => pianoVariante({ offerte: [{ id: "offer_1", prima, quantita: 12 }] }, variante, [due], contatore())).toThrow(/several warehouses/)
  })
  it("nome, SKU o EAN: si scrivono solo quelli cambiati; cambiati altrove sono un conflitto", () => {
    expect(pianoVariante({ titolo: "Blu", sku: "SKU-1", prima: { titolo: "Nera", sku: "SKU-1", ean: null } }, variante, [], contatore()).campi).toEqual({ title: "Blu" })
    expect(pianoVariante({ titolo: "Blu", prima: { titolo: "Rossa", sku: "SKU-1", ean: null } }, variante, [], contatore()).conflitti)
      .toEqual([{ campo: "titolo", attuale: "Nera", tuo: "Blu" }])
  })
  it("finestra con il codice di prima (nessun valore di partenza): invito a ricaricare", () => {
    expect(() => pianoVariante({ titolo: "Blu" }, variante, [], contatore())).toThrow(RICARICA_CONSOLE)
    expect(() => pianoVariante({ offerte: [{ id: "offer_1", prezzo: 130 }] }, variante, [offerta()], contatore())).toThrow(RICARICA_CONSOLE)
  })
  it("offerta di un'altra variante: rifiutata", () => {
    expect(() => pianoVariante({ offerte: [{ id: "offer_x", prima, prezzo: 1 }] }, variante, [offerta()], contatore())).toThrow(/does not belong/)
  })
  it("giacenza negativa non toccata (dopo un'evasione oltre le scorte): il corpo è valido, si salva il prezzo e la quantità no", () => {
    const corpo = { offerte: [{ id: "offer_1", prima: { ...prima, quantita: -2 }, prezzo: 130, quantita: -2 }] }
    expect(SchemaVariante.safeParse(corpo).success).toBe(true)
    const negativa = offerta({ scorte: -2, livelli: [{ voce_id: "iitem_1", deposito_id: "sloc_1", quantita: -2 }] })
    expect(pianoVariante(corpo, variante, [negativa], contatore())).toEqual({ conflitti: [], campi: {}, offerte: [{ id: "offer_1", prezzo: 130 }], scorte: [] })
  })
  it("quantità negativa scritta nella finestra: rifiutata prima di scrivere qualsiasi cosa", () => {
    expect(() => pianoVariante({ offerte: [{ id: "offer_1", prima, quantita: -1, prezzo: 130 }] }, variante, [offerta()], contatore())).toThrow("Quantity cannot be negative")
  })
  it("nuova offerta: la quantità non può essere negativa", () => {
    expect(SchemaVariante.safeParse({ nuova_offerta: { azienda_id: "sel_1", quantita: -1 } }).success).toBe(false)
    expect(SchemaVariante.safeParse({ nuova_offerta: { azienda_id: "sel_1", quantita: 3 } }).success).toBe(true)
  })
})

describe("codici della nuova offerta", () => {
  const letta = { id: "variant_1", title: "Nera", sku: "BAG-01", ean: "8001234567890" }
  it("SKU ed EAN non toccati: quelli della variante letta sotto il lucchetto, anche se cambiati intanto altrove", () => {
    expect(codiciNuovaOfferta({}, letta)).toEqual({ sku: "BAG-01", ean: "8001234567890" })
  })
  it("cambiati nella finestra: quelli appena scritti, anche un EAN svuotato", () => {
    expect(codiciNuovaOfferta({ sku: "BAG-2", ean: null }, letta)).toEqual({ sku: "BAG-2", ean: null })
  })
  it("variante senza SKU: il suo id", () => {
    expect(codiciNuovaOfferta({}, { ...letta, sku: null })).toEqual({ sku: "variant_1", ean: "8001234567890" })
  })
})

describe("conflitto sulle scorte uscito dal workflow", () => {
  it("nomina l'azienda della voce cambiata, con la quantità scritta nella finestra", () => {
    const piano = pianoVariante({ offerte: [{ id: "offer_1", prima, quantita: 12 }] }, variante, [offerta()], contatore())
    expect(conflittoInScrittura({ campo: "stock", attuale: 9, articolo_id: "iitem_1", deposito_id: "sloc_1" }, piano, [offerta()]))
      .toEqual({ campo: "quantita", attuale: 9, tuo: 12, offerta: "offer_1", azienda: "Ishtar Lab" })
  })
  it("voce che non è nel piano: conflitto sulle scorte senza azienda", () => {
    const piano = pianoVariante({ offerte: [{ id: "offer_1", prima, quantita: 12 }] }, variante, [offerta()], contatore())
    expect(conflittoInScrittura({ campo: "stock", attuale: 4 }, piano, [offerta()])).toEqual({ campo: "quantita", attuale: 4, tuo: null })
  })
})

describe("messaggio di conflitto della finestra varianti", () => {
  it("il primo conflitto per esteso con l'azienda e il valore attuale, gli altri contati", () => {
    expect(messaggioVariante([{ campo: "prezzo", attuale: 125, tuo: 130, offerta: "offer_1", azienda: "Ishtar Lab" }]))
      .toBe("Not saved: the selling price for Ishtar Lab was changed elsewhere (now 125).")
    expect(messaggioVariante([{ campo: "titolo", attuale: "", tuo: "Blu" }, { campo: "sku", attuale: "X", tuo: "Y" }]))
      .toBe("Not saved: the variant name was changed elsewhere (now empty). 1 other value was changed too.")
  })
})

