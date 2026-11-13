import { annullaMovimenti, applicaMovimenti, ConflittoScorte, metadatiLivello, MOVIMENTI_RICORDATI, ScorteNonValide, statoLivello } from "../movimenti"

const vuoto = { giacenza: 10, in_arrivo: 0, storico: [], applicati: [] }
const quando = "2026-11-12T20:00:00.000Z"
const chi = "proprietario@esempio.invalid"

describe("movimenti di scorte del pannello", () => {
  it("una variazione si somma alla giacenza attuale e finisce nello storico del Magazzino", () => {
    const esito = applicaMovimenti(vuoto, { movimenti: [{ id: "mov-1", differenza: 3, in_arrivo: 0, motivo: "rettifica" }] }, chi, quando)
    expect(esito.giacenza).toBe(13)
    expect(esito.storico[0]).toEqual({ id: "mov-1", quando, chi, tipo: "correzione", prima: 10, dopo: 13, differenza: 3, motivo: "rettifica", nota: null })
    expect(esito.applicati).toEqual(["mov-1"])
    expect(esito.cambiato).toBe(true)
  })
  it("lo stesso movimento inviato di nuovo (dopo un timeout) non conta due volte", () => {
    const una = applicaMovimenti(vuoto, { movimenti: [{ id: "mov-1", differenza: 3, in_arrivo: 0, motivo: "rettifica" }] }, chi, quando)
    const due = applicaMovimenti(una, { movimenti: [{ id: "mov-1", differenza: 3, in_arrivo: 0, motivo: "rettifica" }] }, chi, quando)
    expect(due.giacenza).toBe(13)
    expect(due.cambiato).toBe(false)
  })
  it("«Ricevi»: la merce in arrivo passa in giacenza come rifornimento", () => {
    const esito = applicaMovimenti({ ...vuoto, in_arrivo: 5 }, { movimenti: [{ id: "mov-2", differenza: 5, in_arrivo: -5, motivo: "rifornimento" }] }, chi, quando)
    expect([esito.giacenza, esito.in_arrivo, esito.storico[0].motivo]).toEqual([15, 0, "rifornimento"])
  })
  it("«Ordina»/«Pour»: cambia solo la merce in arrivo e finisce nello storico firmata, con la merce in arrivo nella nota", () => {
    const esito = applicaMovimenti(vuoto, { movimenti: [{ id: "mov-3", differenza: 0, in_arrivo: 4, motivo: "rifornimento" }] }, chi, quando)
    expect([esito.giacenza, esito.in_arrivo, esito.applicati]).toEqual([10, 4, ["mov-3"]])
    expect(esito.storico[0]).toEqual({ id: "mov-3", quando, chi, tipo: "correzione", prima: 10, dopo: 10, differenza: 0, motivo: "rifornimento",
      nota: "In arrivo +4 (ora 4)", in_arrivo_prima: 0, in_arrivo_dopo: 4 })
  })
  it("«Ricevi»: nello storico anche le unità tolte dalla merce in arrivo", () => {
    const esito = applicaMovimenti({ ...vuoto, in_arrivo: 5 }, { movimenti: [{ id: "mov-r", differenza: 5, in_arrivo: -5, motivo: "rifornimento" }] }, chi, quando)
    expect([esito.storico[0].nota, esito.storico[0].in_arrivo_dopo]).toEqual(["In arrivo -5 (ora 0)", 0])
  })
  it("giacenza negativa (Medusa la permette dopo un'evasione): + e «Ricevi» la fanno risalire, «Pour» la lascia com'è, − la abbassa ed è rifiutato", () => {
    const sotto = { ...vuoto, giacenza: -3, in_arrivo: 2 }
    expect(applicaMovimenti(sotto, { movimenti: [{ id: "n-1", differenza: 1, in_arrivo: 0, motivo: "rettifica" }] }, chi, quando).giacenza).toBe(-2)
    expect(applicaMovimenti(sotto, { movimenti: [{ id: "n-2", differenza: 2, in_arrivo: -2, motivo: "rifornimento" }] }, chi, quando).giacenza).toBe(-1)
    expect(applicaMovimenti(sotto, { movimenti: [{ id: "n-3", differenza: 0, in_arrivo: 6, motivo: "rifornimento" }] }, chi, quando).in_arrivo).toBe(8)
    expect(() => applicaMovimenti(sotto, { movimenti: [{ id: "n-4", differenza: -1, in_arrivo: 0, motivo: "rettifica" }] }, chi, quando)).toThrow(/sotto zero/)
  })
  it("conteggio partito da una giacenza negativa: vale come le altre", () => {
    expect(applicaMovimenti({ ...vuoto, giacenza: -1 }, { conteggio: { id: "cnt-n", prima: [-1], dopo: 2 } }, chi, quando).giacenza).toBe(2)
  })
  it("conteggio dalla scheda o dal CSV: vale se la giacenza è quella letta, ed è registrato come conteggio", () => {
    const esito = applicaMovimenti(vuoto, { conteggio: { id: "cnt-1", prima: [10], dopo: 7 } }, chi, quando)
    expect([esito.giacenza, esito.storico[0].tipo, esito.storico[0].differenza]).toEqual([7, "conteggio", -3])
  })
  it("conteggio uguale alla giacenza: niente nello storico, ma vale come conteggio (data dell'ultimo conteggio, come nel Magazzino)", () => {
    const esito = applicaMovimenti({ ...vuoto, giacenza: 7 }, { conteggio: { id: "cnt-1", prima: [10], dopo: 7 } }, chi, quando)
    expect([esito.cambiato, esito.contato, esito.storico.length, esito.nuovi.length, esito.giacenza]).toEqual([true, true, 0, 0, 7])
  })
  it("variazione con motivo e nota del Magazzino (per esempio merce danneggiata): nello storico", () => {
    const esito = applicaMovimenti(vuoto, { movimenti: [{ id: "mov-d", differenza: -2, in_arrivo: 0, motivo: "danneggiato", nota: "scatola bagnata" }] }, chi, quando)
    expect([esito.giacenza, esito.storico[0].motivo, esito.storico[0].nota]).toEqual([8, "danneggiato", "scatola bagnata"])
  })
  it("quantità nuova scritta nel Magazzino: correzione con il valore di partenza, motivo e nota; non cambia la data del conteggio", () => {
    const esito = applicaMovimenti(vuoto, { conteggio: { id: "cor-1", prima: [10], dopo: 12, tipo: "correzione", motivo: "reso", nota: "cliente" } }, chi, quando)
    expect([esito.giacenza, esito.storico[0].tipo, esito.storico[0].motivo, esito.storico[0].nota, esito.contato]).toEqual([12, "correzione", "reso", "cliente", false])
    expect(() => applicaMovimenti({ ...vuoto, giacenza: 9 }, { conteggio: { id: "cor-2", prima: [10], dopo: 12, tipo: "correzione", motivo: "reso" } }, chi, quando)).toThrow(ConflittoScorte)
  })
  it("correzione che trova già la quantità richiesta: niente da scrivere", () => {
    expect(applicaMovimenti({ ...vuoto, giacenza: 12 }, { conteggio: { id: "cor-3", prima: [10], dopo: 12, tipo: "correzione", motivo: "reso" } }, chi, quando).cambiato).toBe(false)
  })
  it("conteggio su una giacenza cambiata nel frattempo (per esempio da un ordine): conflitto con il valore attuale", () => {
    expect(() => applicaMovimenti({ ...vuoto, giacenza: 8 }, { conteggio: { id: "cnt-1", prima: [10], dopo: 7 } }, chi, quando)).toThrow(ConflittoScorte)
    try { applicaMovimenti({ ...vuoto, giacenza: 8 }, { conteggio: { id: "cnt-1", prima: [10], dopo: 7 } }, chi, quando) } catch (e) {
      expect([(e as ConflittoScorte).campo, (e as ConflittoScorte).attuale]).toEqual(["stock", 8])
    }
  })
  it("conteggio registrato: lo segnala, per aggiornare la data dell'ultimo conteggio come fa il Magazzino", () => {
    expect(applicaMovimenti(vuoto, { conteggio: { id: "cnt-2", prima: [10], dopo: 9 } }, chi, quando).contato).toBe(true)
    expect(applicaMovimenti(vuoto, { movimenti: [{ id: "mov-9", differenza: 1, in_arrivo: 0, motivo: "rettifica" }] }, chi, quando).contato).toBe(false)
  })
  it("«Ricevi» già fatto in un'altra finestra: conflitto sulle unità in arrivo invece di caricarle due volte", () => {
    const ricevi = { movimenti: [{ id: "mov-7", differenza: 5, in_arrivo: -5, motivo: "rifornimento" as const }] }
    expect(() => applicaMovimenti(vuoto, ricevi, chi, quando)).toThrow(ConflittoScorte)
    try { applicaMovimenti(vuoto, ricevi, chi, quando) } catch (e) { expect([(e as ConflittoScorte).campo, (e as ConflittoScorte).attuale]).toEqual(["incoming", 0]) }
  })
  it("parte dell'arrivo già ricevuta altrove e un nuovo «Pour» nel frattempo: si riceve quanto indicato, il resto resta in arrivo", () => {
    const esito = applicaMovimenti({ ...vuoto, in_arrivo: 9 }, { movimenti: [{ id: "mov-8", differenza: 5, in_arrivo: -5, motivo: "rifornimento" }] }, chi, quando)
    expect([esito.giacenza, esito.in_arrivo]).toEqual([15, 4])
  })
  it("gli errori hanno il nome della classe: restano riconoscibili dopo il passaggio dal workflow, che li serializza", () => {
    expect(new ConflittoScorte("stock", 3).name).toBe("ConflittoScorte")
    expect(new ScorteNonValide("x").name).toBe("ScorteNonValide")
  })
  it("le scorte non scendono sotto zero", () => {
    expect(() => applicaMovimenti(vuoto, { movimenti: [{ id: "mov-4", differenza: -11, in_arrivo: 0, motivo: "rettifica" }] }, chi, quando)).toThrow(/sotto zero/)
  })
  it("annullamento: giacenza, merce in arrivo, storico e movimenti ricordati tornano come prima", () => {
    const fatto = applicaMovimenti({ ...vuoto, in_arrivo: 2 }, { movimenti: [{ id: "mov-5", differenza: 2, in_arrivo: -2, motivo: "rifornimento" }, { id: "mov-6", differenza: -1, in_arrivo: 0, motivo: "rettifica" }] }, chi, quando)
    const annullato = annullaMovimenti(fatto, fatto.nuovi)
    expect(annullato).toEqual({ giacenza: 10, in_arrivo: 2, storico: [], applicati: [] })
  })
  it("storico e movimenti ricordati hanno un limite (i più recenti restano)", () => {
    const molti = Array.from({ length: MOVIMENTI_RICORDATI + 5 }, (_, i) => ({ id: `m-${i}`, differenza: 1, in_arrivo: 0, motivo: "rettifica" as const }))
    const esito = applicaMovimenti(vuoto, { movimenti: molti }, chi, quando)
    expect(esito.storico.length).toBe(100)
    expect(esito.applicati.length).toBe(MOVIMENTI_RICORDATI)
    expect(esito.applicati[0]).toBe(`m-${MOVIMENTI_RICORDATI + 4}`)
  })
})

describe("livello di magazzino letto e riscritto dal passo del workflow", () => {
  it("livello che ancora non esiste: giacenza e arrivi a zero, nessuno storico", () => {
    expect(statoLivello(undefined)).toEqual({ giacenza: 0, in_arrivo: 0, storico: [], applicati: [] })
  })
  it("quantità e storico dal livello; valori malformati nei metadati ignorati", () => {
    const voce = { id: "a", quando, chi, tipo: "correzione", prima: 1, dopo: 2, differenza: 1, motivo: null, nota: null }
    expect(statoLivello({ stocked_quantity: 4, incoming_quantity: 2, metadata: { movimenti: [voce], ishtar_movimenti: ["m-1", 5] } }))
      .toEqual({ giacenza: 4, in_arrivo: 2, storico: [voce], applicati: ["m-1"] })
    expect(statoLivello({ stocked_quantity: 1, metadata: { movimenti: "x", ishtar_movimenti: {} } })).toEqual({ giacenza: 1, in_arrivo: 0, storico: [], applicati: [] })
  })
  it("metadati riscritti: le altre chiavi restano, storico e movimenti ricordati sostituiti, data del conteggio se c'è", () => {
    const stato = { giacenza: 1, in_arrivo: 0, storico: [], applicati: ["m-1"] }
    expect(metadatiLivello({ nota_interna: "x", movimenti: ["vecchio"] }, stato, quando))
      .toEqual({ nota_interna: "x", movimenti: [], ishtar_movimenti: ["m-1"], ultimo_conteggio: quando })
    expect(metadatiLivello({ ultimo_conteggio: "prima" }, stato)).toEqual({ ultimo_conteggio: "prima", movimenti: [], ishtar_movimenti: ["m-1"] })
  })
})
