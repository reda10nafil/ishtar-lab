import { aggiornamentoProdotto, applicaCampi, confrontaCampi, controllaCampi, destinazioneScorte, messaggioConflitto, modificaOfferta, preparaModifica, stessiCampi } from "../salvataggio"

const livello = (voce: string, deposito: string, quantita: number) => ({ voce_id: voce, deposito_id: deposito, quantita })

describe("scorte: dove registrare i movimenti del pannello", () => {
  it("un solo deposito: voce e deposito di quel livello", () => {
    expect(destinazioneScorte({ livelli: [livello("iitem_1", "sloc_1", 7)], voci_magazzino: ["iitem_1"] })).toEqual({ voce: "iitem_1", deposito: "sloc_1" })
  })
  it("nessun livello ancora (il caso più comune): la voce, il deposito si decide al salvataggio", () => {
    expect(destinazioneScorte({ livelli: [], voci_magazzino: ["iitem_2"] })).toEqual({ voce: "iitem_2", deposito: null })
  })
  it("più depositi: rifiutato, le scorte si cambiano dal Magazzino", () => {
    expect(() => destinazioneScorte({ livelli: [livello("iitem_1", "sloc_1", 6), livello("iitem_1", "sloc_2", 4)], voci_magazzino: ["iitem_1"] })).toThrow(/più depositi/)
  })
  it("articolo senza voce di magazzino: errore esplicito", () => {
    expect(() => destinazioneScorte({ livelli: [], voci_magazzino: [] })).toThrow(/voce di magazzino/)
  })
})

describe("aggiornamento del prodotto: solo ciò che è cambiato", () => {
  const nuova = { name: "Borsa", description: "Pelle", material: "Lino", status: "active", category: "Borse", gender: "Donna", size: "M", color: "Nero",
    demo: false, photos: ["https://x/a.jpg"], custom: { fodera: "Seta" }, price: 1, cost: 1, stock: 1, sku: "S" }
  it("cambiano solo prezzo o scorte: nessuna scrittura sul prodotto", () => {
    expect(aggiornamentoProdotto(new Set(["price"]), nuova, "pcat_1", "prod_1")).toBeNull()
  })
  it("cambia il nome: solo il titolo", () => {
    expect(aggiornamentoProdotto(new Set(["name"]), nuova, "pcat_1", "prod_1")).toEqual({ title: "Borsa" })
  })
  it("cambiano stato e un campo personalizzato: stato nativo e scheda Ishtar, non il genere", () => {
    const u = aggiornamentoProdotto(new Set(["status", "custom"]), nuova, "pcat_1", "prod_1") as any
    expect(u.status).toBe("published")
    expect(u.metadata.ishtar_v1.custom).toEqual({ fodera: "Seta" })
    expect(u.metadata).not.toHaveProperty("genere")
  })
  it("scheda salvata prima della migrazione: in arrivo e riordino restano finché lo script non li sposta (mai il costo)", () => {
    const u = aggiornamentoProdotto(new Set(["status"]), nuova, null, "prod_1", { salvata: { incoming: 7, reorder: 3, cost: 99, price: 1 } }) as any
    expect(u.metadata.ishtar_v1).toMatchObject({ incoming: 7, reorder: 3, status: "active" })
    expect(u.metadata.ishtar_v1).not.toHaveProperty("cost")
    expect(u.metadata.ishtar_v1).not.toHaveProperty("price")
  })
  it("categoria cambiata dal pannello: restano le categorie della console fuori dal catalogo Ishtar", () => {
    const u = aggiornamentoProdotto(new Set(["category"]), nuova, "pcat_1", "prod_1", { categorieDaTenere: ["pcat_saldi"] }) as any
    expect(u.category_ids).toEqual(["pcat_1", "pcat_saldi"])
  })
  it("cambiano categoria, foto e genere: categoria, foto con copertina, scheda e genere", () => {
    const u = aggiornamentoProdotto(new Set(["category", "photos", "gender"]), nuova, "pcat_1", "prod_1") as any
    expect([u.category_ids, u.images, u.thumbnail, u.metadata.genere]).toEqual([["pcat_1"], [{ url: "https://x/a.jpg" }], "https://x/a.jpg", "Donna"])
  })
})

describe("messaggio di conflitto", () => {
  it("dice quale campo è cambiato altrove e il valore attuale", () => {
    expect(messaggioConflitto([{ campo: "price", attuale: 120, tuo: 130 }], [])).toBe("Modifica non salvata: il prezzo è stato cambiato altrove (ora 120).")
    expect(messaggioConflitto([{ campo: "custom.fodera", attuale: "Lino", tuo: "Seta" }], [{ id: "fodera", label: "Fodera" }]))
      .toBe("Modifica non salvata: il campo «Fodera» è stato cambiato altrove (ora Lino).")
  })
  it("campo personalizzato tolto dalla configurazione: lo dice con il suo identificatore", () => {
    expect(messaggioConflitto([{ campo: "custom.note", attuale: "x", tuo: "y", tolto: true }], []))
      .toBe("Modifica non salvata: il campo «note» è stato tolto dai campi personalizzati.")
  })
  it("accordo con il campo e valori leggibili (vuoto, stato, testi lunghi)", () => {
    expect(messaggioConflitto([{ campo: "stock", attuale: 8, tuo: 7 }], [])).toBe("Modifica non salvata: le scorte sono state cambiate altrove (ora 8).")
    expect(messaggioConflitto([{ campo: "color", attuale: "", tuo: "Nero" }], [])).toBe("Modifica non salvata: il colore è stato cambiato altrove (ora vuoto).")
    expect(messaggioConflitto([{ campo: "status", attuale: "active", tuo: "draft" }], [])).toBe("Modifica non salvata: lo stato è stato cambiato altrove (ora attivo).")
    expect(messaggioConflitto([{ campo: "description", attuale: "x".repeat(200), tuo: "y" }], [])).toBe("Modifica non salvata: la descrizione è stata cambiata altrove.")
  })
  it("più conflitti: il primo per esteso, gli altri elencati", () => {
    expect(messaggioConflitto([{ campo: "price", attuale: 120, tuo: 130 }, { campo: "status", attuale: "draft", tuo: "active" }, { campo: "photos", attuale: [], tuo: ["a"] }], []))
      .toBe("Modifica non salvata: il prezzo è stato cambiato altrove (ora 120). Cambiati altrove anche: lo stato, le foto.")
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
  it("cambia il prezzo: i metadati dell'offerta non si riscrivono (una chiave cambiata intanto dalla console resta)", () => {
    expect(modificaOfferta(offerta, 130, 65)).toEqual({ prezzo: 130 })
  })
  it("cambia solo il costo: i prezzi non si toccano e dei metadati si scrive solo il costo (Medusa unisce al primo livello)", () => {
    expect(modificaOfferta(offerta, 120, 70)).toEqual({ metadata: { prezzo_cessione: 70 } })
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

describe("conflitti: il server scrive solo se il valore attuale è quello da cui è partita la modifica", () => {
  const attuale = { name: "Borsa", price: 120, status: "draft", custom: { fodera: "Seta" } }
  it("valore attuale uguale a quello di prima: si scrive", () => {
    expect(confrontaCampi(attuale, { price: { prima: [120], dopo: 130 } })).toEqual({ scrivere: { price: 130 }, conflitti: [] })
  })
  it("valore già uguale a quello nuovo (per esempio un nuovo tentativo dopo un timeout): niente da fare, niente conflitto", () => {
    expect(confrontaCampi(attuale, { price: { prima: [110], dopo: 120 } })).toEqual({ scrivere: {}, conflitti: [] })
  })
  it("valore cambiato altrove: conflitto con il valore attuale, niente da scrivere", () => {
    expect(confrontaCampi(attuale, { price: { prima: [110], dopo: 130 } })).toEqual({ scrivere: {}, conflitti: [{ campo: "price", attuale: 120, tuo: 130 }] })
  })
  it("più valori di partenza accettati (un invio precedente non ancora confermato)", () => {
    expect(confrontaCampi(attuale, { price: { prima: [110, 120], dopo: 130 } }).scrivere).toEqual({ price: 130 })
  })
  it("campi personalizzati per chiave; vuoto e assente sono la stessa cosa", () => {
    expect(confrontaCampi(attuale, { "custom.fodera": { prima: ["Seta"], dopo: "Lino" }, "custom.taglio": { prima: [""], dopo: "Corto" } }).scrivere)
      .toEqual({ "custom.fodera": "Lino", "custom.taglio": "Corto" })
  })
  it("applicaCampi porta i valori nuovi nella scheda, anche quelli personalizzati", () => {
    expect(applicaCampi(attuale, { price: 130, "custom.taglio": "Corto" })).toEqual({ name: "Borsa", price: 130, status: "draft", custom: { fodera: "Seta", taglio: "Corto" } })
  })
})

describe("modifica dal pannello: controlli, conflitti e cosa scrivere", () => {
  const config = { categories: [{ id: "pcat_borse", name: "Borse" }, { id: "pcat_abiti", name: "Abiti" }],
    fields: [{ id: "fodera", label: "Fodera", type: "text", category: "", options: [], required: false }] }
  const attuale = { id: "prod_1", name: "Borsa", description: "Pelle", category: "Borse", gender: "Donna", size: "M", color: "Nero", material: "Pelle",
    status: "draft", demo: false, photos: [], custom: { fodera: "Lino" }, price: 120, cost: 50, stock: 4, sku: "S-1" }
  const offerta = { prezzo: 120, prezzo_cessione: 50, metadata: { prezzo_cessione: 50 } }
  const prepara = (campi: Record<string, { prima: unknown[]; dopo: unknown }>, base: Record<string, any> = attuale, cfg: any = config) =>
    preparaModifica(base, campi as any, cfg, offerta, "prod_1")

  it("campo che il pannello non può cambiare, anche con il nome di una proprietà di Object: rifiutato con 400", () => {
    expect(() => prepara({ sku: { prima: ["S-1"], dopo: "S-2" } })).toThrow(/non modificabile/)
    for (const nome of ["constructor", "toString", "hasOwnProperty"]) expect(() => prepara({ [nome]: { prima: ["x"], dopo: "y" } })).toThrow(/non modificabile/)
  })
  it("campo personalizzato tolto altrove dalla configurazione: conflitto (il pannello ricarica), non un errore", () => {
    expect(prepara({ "custom.nessuno": { prima: [""], dopo: "x" } })).toEqual({ conflitti: [{ campo: "custom.nessuno", attuale: undefined, tuo: "x", tolto: true }] })
  })
  it("valore non valido: rifiutato con il nome del campo", () => {
    expect(() => prepara({ price: { prima: [120], dopo: -1 } })).toThrow(/price/)
    expect(() => prepara({ status: { prima: ["draft"], dopo: "venduto" } })).toThrow(/status/)
  })
  it("valore cambiato altrove: nessuna scrittura, solo i conflitti", () => {
    expect(prepara({ price: { prima: [100], dopo: 130 } })).toEqual({ conflitti: [{ campo: "price", attuale: 120, tuo: 130 }] })
  })
  it("cambia solo il prezzo: offerta sì (senza metadati), prodotto no", () => {
    const piano = prepara({ price: { prima: [120], dopo: 130 } }) as any
    expect([piano.prodotto, piano.offerta]).toEqual([null, { prezzo: 130 }])
  })
  it("cambia solo il costo: prezzo non toccato, dei metadati dell'offerta solo il costo (le altre chiavi restano come sono)", () => {
    expect((prepara({ cost: { prima: [50], dopo: 55 } }) as any).offerta).toEqual({ metadata: { prezzo_cessione: 55 } })
  })
  it("nome con spazi intorno: salvato senza", () => {
    expect((prepara({ name: { prima: ["Borsa"], dopo: "  Borsa grande  " } }) as any).prodotto).toEqual({ title: "Borsa grande" })
  })
  it("categoria nuova fuori dal catalogo: rifiutata; quella messa dalla console non blocca un salvataggio del prezzo", () => {
    expect(() => prepara({ category: { prima: ["Borse"], dopo: "Saldi" } })).toThrow(/categoria del catalogo/)
    expect((prepara({ price: { prima: [120], dopo: 99 } }, { ...attuale, category: "Saldi" }) as any).conflitti).toEqual([])
  })
  it("campo obbligatorio aggiunto dopo: il prezzo di un prodotto che non lo ha si salva, svuotare il valore no", () => {
    const cfg = { ...config, fields: [{ ...config.fields[0], required: true }] }
    expect((prepara({ price: { prima: [120], dopo: 99 } }, { ...attuale, custom: {} }, cfg) as any).conflitti).toEqual([])
    expect(() => prepara({ "custom.fodera": { prima: ["Lino"], dopo: "" } }, attuale, cfg)).toThrow(/Compilare Fodera/)
  })
  it("campo personalizzato cambiato: scheda Ishtar con il valore nuovo e gli altri campi della scheda com'erano", () => {
    const piano = prepara({ "custom.fodera": { prima: ["Lino"], dopo: "Seta" } }) as any
    expect(piano.prodotto.metadata.ishtar_v1).toMatchObject({ id: "prod_1", category: "Borse", gender: "Donna", custom: { fodera: "Seta" } })
    expect(piano.offerta).toBeNull()
  })
})

describe("configurazione dei campi: cambiata altrove?", () => {
  const campo = { id: "fodera", label: "Fodera", type: "text", options: [], category: "", required: false }
  it("stessa configurazione anche con i valori predefiniti scritti o no", () => {
    expect(stessiCampi([campo], [{ id: "fodera", label: "Fodera", type: "text" }])).toBe(true)
  })
  it("un campo aggiunto, tolto, rinominato o spostato altrove: cambiata", () => {
    expect(stessiCampi([campo], [])).toBe(false)
    expect(stessiCampi([campo], [{ ...campo, label: "Interno" }])).toBe(false)
    expect(stessiCampi([campo, { ...campo, id: "b" }], [{ ...campo, id: "b" }, campo])).toBe(false)
  })
})

describe("schema della modifica", () => {
  const { Body } = require("../schema")
  it("conteggio partito da una giacenza negativa (letta dal server): accettato; il valore nuovo resta zero o più", () => {
    const corpo = (prima: number, dopo: number) => ({ modifica: { id: "prod_1", sku: "S", conteggio: { id: "conteggio-1", prima: [prima], dopo } } })
    expect(Body.safeParse(corpo(-1, 2)).success).toBe(true)
    expect(Body.safeParse(corpo(3, -1)).success).toBe(false)
  })
})

