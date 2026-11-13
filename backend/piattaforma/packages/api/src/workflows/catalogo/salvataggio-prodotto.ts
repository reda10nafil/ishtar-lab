import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { updateProductsWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { createOffersWorkflow, createProductsWorkflow, createSellerStockLocationsWorkflow, updateOffersWorkflow } from "@mercurjs/core/workflows"
import { classificaEsito, compensazioniFallite } from "./esito"
import { annullaMovimenti, applicaMovimenti, metadatiLivello, statoLivello, type Applicato, type ConteggioPannello, type MovimentoPannello } from "./movimenti"
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

/** Attesa massima del lucchetto della voce di magazzino (lo stesso di evasioni e resi di Medusa). */
const ATTESA_VOCE = 30

export type InputScorte = {
  voce: string
  /** Deposito del livello; null se la voce non ha ancora livelli: si usa quello dell'azienda o lo si crea qui. */
  deposito: string | null
  azienda: string
  nome_deposito: string
  movimenti: MovimentoPannello[]
  conteggio?: ConteggioPannello
  chi: string
  quando: string
}

type Annullamento = { voce: string; deposito: string; nuovi: Applicato[]; creato: boolean; conteggioPrima?: string | null } | null

type Magazzino = {
  listInventoryLevels: (filtri: object) => Promise<Array<{ id: string; stocked_quantity?: unknown; incoming_quantity?: unknown; reserved_quantity?: unknown; metadata?: Record<string, unknown> | null }>>
  updateInventoryLevels: (dati: object[]) => Promise<unknown>
  createInventoryLevels: (dati: object[]) => Promise<unknown>
  deleteInventoryLevels: (ids: string[]) => Promise<void>
}
type Lucchetti = { execute: <T>(chiavi: string[], lavoro: () => Promise<T>, opzioni?: { timeout?: number }) => Promise<T> }

/**
 * Variazioni e conteggi del pannello applicati al livello di magazzino sotto il lucchetto della voce, lo stesso di
 * evasioni e resi (adjustInventoryLevelsStep): la giacenza si legge e si scrive senza che un ordine passi in mezzo, e
 * l'annullamento toglie solo le variazioni di questo salvataggio, non quelle arrivate nel frattempo.
 */
const movimentiScorteStep = createStep(
  "ishtar-movimenti-scorte",
  async (s: InputScorte & { deposito: string }, { container }) => {
    const lucchetti = container.resolve(Modules.LOCKING) as unknown as Lucchetti
    const magazzino = container.resolve(Modules.INVENTORY) as unknown as Magazzino
    return await lucchetti.execute([s.voce], async () => {
      const [livello] = await magazzino.listInventoryLevels({ inventory_item_id: s.voce, location_id: s.deposito })
      const esito = applicaMovimenti(statoLivello(livello), s, s.chi, s.quando)
      if (!esito.cambiato) return new StepResponse(esito.giacenza, null as Annullamento)
      const conteggioPrima = typeof livello?.metadata?.ultimo_conteggio === "string" ? (livello.metadata.ultimo_conteggio as string) : null
      const dati = {
        inventory_item_id: s.voce,
        location_id: s.deposito,
        stocked_quantity: esito.giacenza,
        incoming_quantity: esito.in_arrivo,
        metadata: metadatiLivello(livello?.metadata, esito, esito.contato ? s.quando : undefined),
      }
      if (livello) await magazzino.updateInventoryLevels([dati])
      else await magazzino.createInventoryLevels([dati])
      return new StepResponse(esito.giacenza, { voce: s.voce, deposito: s.deposito, nuovi: esito.nuovi, creato: !livello, ...(esito.contato ? { conteggioPrima } : {}) } as Annullamento)
    }, { timeout: ATTESA_VOCE })
  },
  async (annullamento: Annullamento | undefined, { container }) => {
    if (!annullamento) return
    const lucchetti = container.resolve(Modules.LOCKING) as unknown as Lucchetti
    const magazzino = container.resolve(Modules.INVENTORY) as unknown as Magazzino
    await lucchetti.execute([annullamento.voce], async () => {
      const [livello] = await magazzino.listInventoryLevels({ inventory_item_id: annullamento.voce, location_id: annullamento.deposito })
      if (!livello) return
      const stato = annullaMovimenti(statoLivello(livello), annullamento.nuovi)
      // Livello creato da questo salvataggio e rimasto vuoto: si toglie, come faceva createInventoryLevelsWorkflow.
      const vuoto = !stato.giacenza && !stato.in_arrivo && !Number(livello.reserved_quantity ?? 0) && !stato.storico.length
      if (annullamento.creato && vuoto) {
        await magazzino.deleteInventoryLevels([livello.id])
        return
      }
      await magazzino.updateInventoryLevels([{
        inventory_item_id: annullamento.voce,
        location_id: annullamento.deposito,
        stocked_quantity: stato.giacenza,
        incoming_quantity: stato.in_arrivo,
        metadata: metadatiLivello(livello.metadata, stato, "conteggioPrima" in annullamento ? annullamento.conteggioPrima : undefined),
      }])
    }, { timeout: ATTESA_VOCE })
  }
)

export type InputModifica = {
  id: string
  /** Solo i campi cambiati del prodotto (titolo, descrizione, materiale, stato, categorie, foto, metadati), o null. */
  prodotto: Record<string, unknown> | null
  /** Variazioni e conteggio delle scorte, o null se non cambiano. */
  scorte: InputScorte | null
  /** null se prezzo e costo non cambiano; prices assente se cambia solo il costo, metadata (solo il costo) se cambia. */
  offerta: null | { id: string; prices?: unknown[]; metadata?: Record<string, unknown> }
  updated_by: string
}

/**
 * Ordine dei passi: scorte, prodotto, prezzo per ultimo. Le scorte vengono prima perché un conflitto (giacenza cambiata
 * da un ordine o da un'altra finestra) ferma il salvataggio prima che si scriva altro. La compensazione dell'offerta
 * toglie i prezzi creati ma non ripristina l'importo di un prezzo aggiornato sul posto: per ultimo, non c'è un passo
 * successivo che possa fallire dopo.
 */
export const aggiornaProdottoCatalogoWorkflow = createWorkflow("ishtar-aggiorna-prodotto", (input: InputModifica) => {
  const nuovoDeposito = when({ input }, ({ input }) => Boolean(input.scorte && !input.scorte.deposito)).then(() =>
    createSellerStockLocationsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({ seller_id: input.scorte!.azienda, locations: [{ name: input.scorte!.nome_deposito }] })),
    }))

  when({ input }, ({ input }) => Boolean(input.scorte)).then(() => {
    movimentiScorteStep(transform({ input, nuovoDeposito }, ({ input, nuovoDeposito }) => ({
      ...input.scorte!,
      deposito: input.scorte!.deposito ?? (nuovoDeposito as unknown as { id: string }[] | undefined)?.[0]?.id ?? "",
    })))
  })

  when({ input }, ({ input }) => Boolean(input.prodotto)).then(() => {
    ricordaProdottoStep(transform({ input }, ({ input }) => input.id))
    updateProductsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({ selector: { id: input.id }, update: input.prodotto }) as any),
    })
  })

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
