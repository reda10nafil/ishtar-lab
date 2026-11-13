import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createInventoryLevelsWorkflow, updateInventoryLevelsWorkflow, updateProductsWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { createOffersWorkflow, createProductsWorkflow, createSellerStockLocationsWorkflow, updateOffersWorkflow } from "@mercurjs/core/workflows"
import { classificaEsito, compensazioniFallite } from "./esito"
import { fotografiaProdotto, ripristinoProdotto, type FotografiaProdotto } from "./ripristino"

/*
 * Salvataggio di un prodotto «tutto o niente». Prima ogni passaggio (prodotto, deposito, offerte, scorte, scheda) era un
 * workflow a sé: un errore a metà lasciava un prodotto senza offerta o senza scheda Ishtar, invisibile nel pannello e con
 * lo SKU occupato, oppure prezzo nuovo con scorte vecchie. Qui i workflow di Medusa e Mercur diventano passi di un solo
 * workflow: se un passo fallisce, quelli già fatti vengono annullati in ordine inverso (compensazione).
 * Le letture (deposito esistente, profilo di spedizione, offerta attuale) si fanno prima, fuori dal workflow.
 */

const VALUTA = "eur"

export type RigaOfferta = {
  sku: string
  ean?: string | null
  prezzo?: number | null
  metadata: Record<string, unknown>
  quantita: number
}

export type InputCreazione = {
  /** Prodotto per la creazione di Mercur: campi, varianti, metadati (compresa la scheda Ishtar), aziende. */
  prodotto: Record<string, unknown>
  created_by: string
  offerte: null | {
    azienda: string
    firma: string
    profilo: string
    /** Deposito dell'azienda se esiste già; altrimenti, se serve una quantità, si crea qui. */
    deposito: string | null
    nome_deposito: string
    righe: RigaOfferta[]
  }
}

export const creaProdottoCatalogoWorkflow = createWorkflow("ishtar-crea-prodotto", (input: InputCreazione) => {
  const prodotti = createProductsWorkflow.runAsStep({
    input: transform({ input }, ({ input }) => ({ products: [input.prodotto], created_by: input.created_by }) as any),
  })
  const id = transform({ prodotti }, ({ prodotti }) => (prodotti as unknown as { id: string }[])[0].id)

  // Mercur crea le varianti in un workflow annidato e restituisce solo i prodotti: gli id si leggono per SKU.
  const { data: varianti } = useQueryGraphStep({
    entity: "variant",
    fields: ["id", "sku"],
    filters: transform({ id }, ({ id }) => ({ product_id: id })),
  }).config({ name: "ishtar-crea-prodotto-varianti" })

  const serveDeposito = transform({ input }, ({ input }) =>
    Boolean(input.offerte && !input.offerte.deposito && input.offerte.righe.some((r) => r.quantita > 0)))
  const nuovoDeposito = when({ serveDeposito }, ({ serveDeposito }) => serveDeposito).then(() =>
    createSellerStockLocationsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({ seller_id: input.offerte!.azienda, locations: [{ name: input.offerte!.nome_deposito }] })),
    }))

  const offerte = transform({ input, varianti, nuovoDeposito }, ({ input, varianti, nuovoDeposito }) => {
    const o = input.offerte
    if (!o) return null
    const deposito = o.deposito ?? (nuovoDeposito as unknown as { id: string }[] | undefined)?.[0]?.id ?? null
    const perCodice = new Map((varianti as { id: string; sku: string }[]).map((v) => [v.sku, v.id]))
    return {
      offers: o.righe.map((r) => ({
        seller_id: o.azienda,
        created_by: o.firma,
        variant_id: perCodice.get(r.sku) ?? "",
        sku: r.sku,
        ean: r.ean || null,
        upc: null,
        shipping_profile_id: o.profilo,
        leadtime_to_ship: null,
        condition_id: null,
        metadata: r.metadata,
        prices: r.prezzo === null || r.prezzo === undefined ? [] : [{ amount: r.prezzo, currency_code: VALUTA }],
        inventory_items: [{
          sku: r.sku,
          required_quantity: 1,
          stock_levels: deposito && r.quantita > 0 ? [{ location_id: deposito, stocked_quantity: r.quantita }] : [],
        }],
      })),
    }
  })
  when({ offerte }, ({ offerte }) => Boolean(offerte)).then(() => createOffersWorkflow.runAsStep({ input: offerte as any }))

  return new WorkflowResponse(id)
})

/** Chiavi dei metadati che il salvataggio del pannello scrive: le uniche da rimettere se viene annullato. */
const CHIAVI_PANNELLO = ["ishtar_v1", "genere"]

/**
 * Passo che fotografa il prodotto prima dell'aggiornamento e, se il salvataggio viene annullato, lo riscrive per intero:
 * la compensazione di updateProductsWorkflow non rimette metadati e categorie (ripristino.ts). Le compensazioni girano in
 * ordine inverso, quindi questa arriva dopo quella di updateProductsWorkflow e ha l'ultima parola.
 */
const ricordaProdottoStep = createStep(
  "ishtar-ricorda-prodotto",
  async (id: string, { container }) => {
    const servizio = container.resolve(Modules.PRODUCT) as unknown as { retrieveProduct: (id: string, opzioni: object) => Promise<any> }
    const prodotto = await servizio.retrieveProduct(id, { relations: ["categories", "images"] })
    return new StepResponse(id, fotografiaProdotto(prodotto, CHIAVI_PANNELLO))
  },
  async (fotografia: FotografiaProdotto | undefined, { container }) => {
    if (!fotografia) return
    const servizio = container.resolve(Modules.PRODUCT) as unknown as { updateProducts: (id: string, dati: object) => Promise<unknown> }
    await servizio.updateProducts(fotografia.id, ripristinoProdotto(fotografia))
  }
)

export type InputModifica = {
  id: string
  /** Aggiornamento del prodotto: titolo, descrizione, materiale, stato, categorie, foto, metadati. */
  prodotto: Record<string, unknown>
  scorte:
    | { tipo: "invariate" }
    | { tipo: "livello"; voce: string; deposito: string; quantita: number }
    | { tipo: "nuovo-livello"; voce: string; quantita: number; azienda: string; deposito: string | null; nome_deposito: string }
  /** null se prezzo e costo non cambiano; prices assente se cambia solo il costo. */
  offerta: null | { id: string; prices?: unknown[]; metadata: Record<string, unknown> }
  updated_by: string
}

/**
 * Ordine dei passi: scheda, scorte, prezzo per ultimo. La compensazione dell'offerta toglie i prezzi creati ma non
 * ripristina l'importo di un prezzo aggiornato sul posto: per ultimo, non c'è un passo successivo che possa fallire dopo.
 */
export const aggiornaProdottoCatalogoWorkflow = createWorkflow("ishtar-aggiorna-prodotto", (input: InputModifica) => {
  ricordaProdottoStep(transform({ input }, ({ input }) => input.id))
  updateProductsWorkflow.runAsStep({
    input: transform({ input }, ({ input }) => ({ selector: { id: input.id }, update: input.prodotto }) as any),
  })

  when({ input }, ({ input }) => input.scorte.tipo === "livello").then(() =>
    updateInventoryLevelsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => {
        const s = input.scorte as Extract<InputModifica["scorte"], { tipo: "livello" }>
        return { updates: [{ inventory_item_id: s.voce, location_id: s.deposito, stocked_quantity: s.quantita }] }
      }),
    }))

  const nuovoDeposito = when({ input }, ({ input }) => input.scorte.tipo === "nuovo-livello" && !input.scorte.deposito).then(() =>
    createSellerStockLocationsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => {
        const s = input.scorte as Extract<InputModifica["scorte"], { tipo: "nuovo-livello" }>
        return { seller_id: s.azienda, locations: [{ name: s.nome_deposito }] }
      }),
    }))

  when({ input }, ({ input }) => input.scorte.tipo === "nuovo-livello").then(() =>
    createInventoryLevelsWorkflow.runAsStep({
      input: transform({ input, nuovoDeposito }, ({ input, nuovoDeposito }) => {
        const s = input.scorte as Extract<InputModifica["scorte"], { tipo: "nuovo-livello" }>
        const deposito = s.deposito ?? (nuovoDeposito as unknown as { id: string }[] | undefined)?.[0]?.id
        return { inventory_levels: [{ inventory_item_id: s.voce, location_id: deposito!, stocked_quantity: s.quantita }] }
      }),
    }))

  when({ input }, ({ input }) => Boolean(input.offerta)).then(() =>
    updateOffersWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({ offers: [input.offerta!], updated_by: input.updated_by }) as any),
    }))

  return new WorkflowResponse(transform({ input }, ({ input }) => input.id))
})

/**
 * Esegue un workflow senza far sparire la differenza fra «annullato» e «annullamento non riuscito»: nel primo caso il
 * database è come prima e si restituisce l'errore originale; nel secondo può essere rimasto a metà e va detto.
 */
export async function esegui<I>(
  flusso: (scope: MedusaContainer) => any,
  scope: MedusaContainer,
  input: I
): Promise<{ esito: "fatto"; risultato: unknown } | { esito: "annullato"; errore: unknown } | { esito: "a-meta"; errore: unknown; transazione?: string }> {
  const { result, transaction, thrownError, errors } = await flusso(scope).run({ input, throwOnError: false })
  const errore = thrownError ?? errors?.[0]?.error ?? new Error("Salvataggio non riuscito")
  const tutti = transaction.getErrors?.() ?? errors ?? []
  const esito = classificaEsito(transaction.getState(), tutti)
  if (esito === "annullato") return { esito, errore }
  if (esito === "a-meta") {
    // Nel log: transazione, causa e passi che non si sono annullati, per poter sistemare il prodotto a mano.
    const transazione = transaction.transactionId as string | undefined
    scope.resolve(ContainerRegistrationKeys.LOGGER).error(
      `Salvataggio a metà (stato ${transaction.getState()}, transazione ${transazione}): ${String((errore as Error)?.message ?? errore)}; ` +
      `annullamenti non riusciti: ${compensazioniFallite(tutti).join("; ") || "nessuno registrato"}`)
    return { esito, errore, transazione }
  }
  return { esito, risultato: result }
}
