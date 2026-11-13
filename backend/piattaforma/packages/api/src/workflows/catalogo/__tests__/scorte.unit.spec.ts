/*
 * Workflow «ishtar-scorte» e «ishtar-aggiorna-variante» veri (motore dei workflow di Medusa, con dentro il vero
 * updateProductVariantsWorkflow) su moduli finti in memoria: magazzino, lucchetti, prodotti, log. Si verifica ciò che le
 * rotte ricevono: esito, errore serializzato e risposta HTTP che ne ricava l'errorHandler di Medusa.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
// I workflow di Mercur non servono qui e richiederebbero l'intera piattaforma: al loro posto, workflow vuoti.
jest.mock("@mercurjs/core/workflows", () => {
  const { createWorkflow, WorkflowResponse } = require("@medusajs/framework/workflows-sdk")
  const vuoto = (nome: string) => createWorkflow(nome, (input: unknown) => new WorkflowResponse(input))
  return {
    createOffersWorkflow: vuoto("prova-create-offers"),
    createProductsWorkflow: vuoto("prova-create-products"),
    createSellerStockLocationsWorkflow: vuoto("prova-create-locations"),
    updateOffersWorkflow: vuoto("prova-update-offers"),
  }
})
const { createMedusaContainer, MedusaError, Modules, ContainerRegistrationKeys } = require("@medusajs/framework/utils")
const { asValue } = require("@medusajs/framework/awilix")
const { getHttpResponseFromError } = require("@medusajs/framework/http")
const { esegui, scorteWorkflow, aggiornaVarianteWorkflow } = require("../salvataggio-prodotto")
const { erroreScorte, ConflittoHttp } = require("../../../api/admin/magazzino/lib/scrittura")

type Livello = { id: string; inventory_item_id: string; location_id: string; stocked_quantity: number; incoming_quantity: number; reserved_quantity: number; metadata: Record<string, unknown> }
type Guasto = (dati: { inventory_item_id: string; stocked_quantity: number }, scrittura: number) => Error | null

/** Magazzino in memoria (chiave voce@deposito), con un guasto facoltativo sulle scritture e il log degli errori. */
function ambiente(iniziali: Record<string, number>, prodotti?: object) {
  const livelli = new Map<string, Livello>()
  let n = 0
  for (const [chiave, quantita] of Object.entries(iniziali)) {
    const [voce, deposito] = chiave.split("@")
    livelli.set(chiave, { id: `ilev_${++n}`, inventory_item_id: voce, location_id: deposito, stocked_quantity: quantita, incoming_quantity: 0, reserved_quantity: 0, metadata: {} })
  }
  const stato = { guasto: null as Guasto | null, scritture: 0 }
  const magazzino = {
    listInventoryLevels: async (f: { inventory_item_id: string; location_id: string }) => {
      const livello = livelli.get(`${f.inventory_item_id}@${f.location_id}`)
      return livello ? [structuredClone(livello)] : []
    },
    updateInventoryLevels: async (dati: Livello[]) => {
      for (const d of dati) {
        const errore = stato.guasto?.(d, ++stato.scritture)
        if (errore) throw errore
        const livello = livelli.get(`${d.inventory_item_id}@${d.location_id}`)!
        Object.assign(livello, { stocked_quantity: d.stocked_quantity, incoming_quantity: d.incoming_quantity, metadata: { ...livello.metadata, ...d.metadata } })
      }
    },
    createInventoryLevels: async (dati: Livello[]) => {
      for (const d of dati) livelli.set(`${d.inventory_item_id}@${d.location_id}`, { ...d, id: `ilev_${++n}`, reserved_quantity: 0 })
    },
    deleteInventoryLevels: async (ids: string[]) => {
      for (const [chiave, l] of livelli) if (ids.includes(l.id)) livelli.delete(chiave)
    },
  }
  const log: string[] = []
  const nulla = async () => {}
  const container = createMedusaContainer()
  container.register({
    [Modules.LOCKING]: asValue({ execute: async (_chiavi: string[], lavoro: () => Promise<unknown>) => lavoro() }),
    [Modules.INVENTORY]: asValue(magazzino),
    [Modules.PRODUCT]: asValue(prodotti ?? {}),
    [Modules.PRICING]: asValue({}),
    [Modules.EVENT_BUS]: asValue({ emit: nulla, releaseGroupedEvents: nulla, clearGroupedEvents: nulla }),
    [ContainerRegistrationKeys.QUERY]: asValue({ graph: async () => ({ data: [] }) }),
    [ContainerRegistrationKeys.LINK]: asValue({}),
    [ContainerRegistrationKeys.LOGGER]: asValue({ error: (m: unknown) => log.push(String(m)), info: nulla, warn: nulla, debug: nulla }),
  })
  const giacenza = (chiave: string) => livelli.get(chiave)?.stocked_quantity
  return { container, stato, log, giacenza }
}

const conteggio = (voce: string, prima: number, dopo: number) => ({
  voce, deposito: "sloc_1", azienda: "sel_1", nome_deposito: "", movimenti: [],
  conteggio: { id: `cnt-${voce}`, prima: [prima], dopo, tipo: "conteggio", motivo: "rettifica", nota: null },
  chi: "magazzino@prova.it", quando: "2026-11-13T10:00:00.000Z",
})
const variazione = (voce: string, differenza: number, id = `mov-${voce}`) => ({
  voce, deposito: "sloc_1", azienda: "sel_1", nome_deposito: "", movimenti: [{ id, differenza, in_arrivo: 0, motivo: "danneggiato", nota: null }],
  chi: "magazzino@prova.it", quando: "2026-11-13T10:00:00.000Z",
})

/** Modulo prodotti il cui aggiornamento delle varianti fallisce come con uno SKU già usato (indice unico di Medusa). */
const prodottiConSkuOccupato = {
  listProductVariants: async () => [{ id: "variant_1", sku: "SKU-1" }],
  updateProductVariants: async () => {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Product variant with sku: SKU-2, already exists.")
  },
  upsertProductVariants: async () => [],
}

describe("conflitto dentro il workflow", () => {
  it("la voce rifiutata è nell'errore, le altre tornano com'erano e la rotta riceve un 412 con articolo e deposito", async () => {
    const amb = ambiente({ "iitem_1@sloc_1": 10, "iitem_2@sloc_1": 5 })
    const esito = await esegui(scorteWorkflow, amb.container, { operazioni: [conteggio("iitem_1", 10, 8), conteggio("iitem_2", 4, 3)] })
    expect(esito.esito).toBe("annullato")
    expect(amb.giacenza("iitem_1@sloc_1")).toBe(10)
    expect(esito.errore).toMatchObject({ name: "ConflittoScorte", campo: "stock", attuale: 5, voce: "iitem_2", deposito: "sloc_1" })
    const errore = erroreScorte(esito.errore, false)
    expect(errore).toBeInstanceOf(ConflittoHttp)
    expect(errore.conflitti).toEqual([{ campo: "stock", attuale: 5, articolo_id: "iitem_2", deposito_id: "sloc_1" }])
  })
})

describe("annullamento non riuscito", () => {
  it("dentro il passo: esito a metà e nel log la voce rimasta cambiata", async () => {
    const amb = ambiente({ "iitem_1@sloc_1": 10, "iitem_2@sloc_1": 5 })
    // Seconda scrittura della prima voce, cioè il suo annullamento: il database non risponde.
    amb.stato.guasto = (d, scrittura) => (d.inventory_item_id === "iitem_1" && scrittura === 2 ? new Error("connessione persa") : null)
    const esito = await esegui(scorteWorkflow, amb.container, { operazioni: [conteggio("iitem_1", 10, 8), conteggio("iitem_2", 4, 3)] })
    expect(amb.giacenza("iitem_1@sloc_1")).toBe(8)
    expect(esito.esito).toBe("a-meta")
    expect(amb.log.join("\n")).toMatch(/iitem_1@sloc_1: connessione persa/)
  })

  it("nella compensazione: un annullamento fallito non ferma gli altri, e finisce nel log", async () => {
    const amb = ambiente({ "iitem_1@sloc_1": 10, "iitem_2@sloc_1": 4 }, prodottiConSkuOccupato)
    // Annullamento della seconda voce (da 6 torna a 4): lucchetto non ottenuto in tempo.
    amb.stato.guasto = (d) => (d.inventory_item_id === "iitem_2" && d.stocked_quantity === 4 ? new Error("Timed-out acquiring lock.") : null)
    const esito = await esegui(aggiornaVarianteWorkflow, amb.container, {
      variante: { id: "variant_1", campi: { sku: "SKU-2" } },
      scorte: [conteggio("iitem_1", 10, 12), conteggio("iitem_2", 4, 6)],
      offerte: [],
      updated_by: "user_1",
    })
    expect(esito.esito).toBe("a-meta")
    expect(amb.giacenza("iitem_1@sloc_1")).toBe(10)
    expect(amb.giacenza("iitem_2@sloc_1")).toBe(6)
    expect(amb.log.join("\n")).toMatch(/iitem_2@sloc_1: Timed-out acquiring lock\./)
  })

  it("la risposta è un 500 con il proprio codice, che la console riconosce e mostra", () => {
    const { statusCode, body } = getHttpResponseFromError(erroreScorte(new Error("qualsiasi"), true))
    expect(statusCode).toBe(500)
    expect(body.code).toBe("salvataggio_a_meta")
    expect(body.message).toMatch(/could not be fully undone/)
  })
})

describe("errori che non riguardano le scorte", () => {
  it("uno SKU già usato esce dal workflow con il suo tipo: 400 con il messaggio di Medusa, come prima della PR", async () => {
    const amb = ambiente({ "iitem_1@sloc_1": 10 }, prodottiConSkuOccupato)
    const esito = await esegui(aggiornaVarianteWorkflow, amb.container, {
      variante: { id: "variant_1", campi: { sku: "SKU-2" } },
      scorte: [conteggio("iitem_1", 10, 12)],
      offerte: [],
      updated_by: "user_1",
    })
    expect(esito.esito).toBe("annullato")
    expect(amb.giacenza("iitem_1@sloc_1")).toBe(10)
    const { statusCode, body } = getHttpResponseFromError(erroreScorte(esito.errore, false))
    expect(statusCode).toBe(400)
    expect(body.message).toBe("Product variant with sku: SKU-2, already exists.")
  })

  it("lucchetto non ottenuto: resta un 409, non diventa un 500", () => {
    const serializzato = { name: "conflict", type: MedusaError.Types.CONFLICT, message: "Timed-out acquiring lock." }
    expect(getHttpResponseFromError(erroreScorte(serializzato, false)).statusCode).toBe(409)
  })
})

describe("scorte sotto zero", () => {
  it("una variazione che porterebbe la giacenza sotto zero è rifiutata nel workflow con un 400", async () => {
    const amb = ambiente({ "iitem_1@sloc_1": 3 })
    const esito = await esegui(scorteWorkflow, amb.container, { operazioni: [variazione("iitem_1", -4)] })
    expect(esito.esito).toBe("annullato")
    expect(amb.giacenza("iitem_1@sloc_1")).toBe(3)
    const { statusCode, body } = getHttpResponseFromError(erroreScorte(esito.errore, false))
    expect(statusCode).toBe(400)
    expect(body.message).toBe("Stock cannot go below zero")
  })

  it("la stessa variazione rimandata dopo una risposta persa non conta due volte e non è un errore", async () => {
    const amb = ambiente({ "iitem_1@sloc_1": 3 })
    const prima = await esegui(scorteWorkflow, amb.container, { operazioni: [variazione("iitem_1", -3, "mov-ripetuto")] })
    expect(prima.esito).toBe("fatto")
    const ripetuta = await esegui(scorteWorkflow, amb.container, { operazioni: [variazione("iitem_1", -3, "mov-ripetuto")] })
    expect(ripetuta.esito).toBe("fatto")
    expect(amb.giacenza("iitem_1@sloc_1")).toBe(0)
  })
})
