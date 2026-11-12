import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, toHandle } from "@medusajs/framework/utils"
import { creaProdottoCatalogoWorkflow, esegui } from "../../../../workflows/catalogo/salvataggio-prodotto"
import { controllaCodici, restiDeiCodici } from "./codici"
import { depositoEsistente, metadatiPrezzi, profiloSpedizione } from "./offerte"
import { versoMedusa, type DatiScheda, type DatiVariante } from "./scheda"

export type NuovoProdotto = {
  scheda: DatiScheda & { collezione_id?: string | null; seo_titolo?: string | null; seo_descrizione?: string | null }
  varianti: DatiVariante[]
  stato: "draft" | "proposed" | "published"
  aziendaId?: string | null
  /** Chi firma il prodotto: l'azienda, o l'utente se lo crea l'amministratore. */
  autore: string
  /** Chi firma le offerte: il membro dell'azienda o l'utente. */
  firma: string
  prezzoVendita?: number | null
  /** L'amministratore lega subito l'azienda; per le aziende lo fa `prodotto-esclusivo`. */
  legaSubito: boolean
  /** Metadati in più scritti già alla creazione (per esempio la scheda del primo pannello). */
  metadatiExtra?: Record<string, unknown>
}

export { controllaCodici } from "./codici"

/** Un passo è fallito e anche l'annullamento non è riuscito: il database può essere rimasto a metà. */
export class SalvataggioAMeta extends Error {
  constructor(public transazione?: string, public causa?: unknown) {
    super(`Salvataggio interrotto e annullamento non completato${transazione ? ` (transazione ${transazione})` : ""}`)
  }
}

/** Lo stesso nome può tornare in stagioni diverse: l'indirizzo del prodotto deve restare unico. */
async function indirizzoLibero(scope: MedusaContainer, titolo: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const base = toHandle(titolo)
  const { data } = await query.graph({ entity: "product", fields: ["id"], filters: { handle: base } })
  return data.length ? `${base}-${Date.now().toString(36)}` : base
}

/**
 * Crea prodotto e varianti e, con un'azienda, deposito e offerte in un solo workflow (workflows/catalogo): se un passo
 * fallisce non resta nulla a metà, nemmeno lo SKU occupato. Prima l'annullamento copriva solo le offerte.
 */
export async function creaProdotto(scope: MedusaContainer, nuovo: NuovoProdotto) {
  // Due creazioni con lo stesso SKU (doppio clic, console e pannello insieme) passano una alla volta, e così il deposito
  // di un'azienda che ancora non ce l'ha: senza lucchetto se ne creerebbero due.
  const chiavi = [...nuovo.varianti.map((v) => `ishtar-sku:${v.sku}`), ...(nuovo.aziendaId ? [`deposito:${nuovo.aziendaId}`] : [])]
  return (scope.resolve(Modules.LOCKING) as unknown as { execute: <T>(k: string[], f: () => Promise<T>, o?: object) => Promise<T> })
    .execute(chiavi, () => creaProdottoInFila(scope, nuovo), { timeout: 30 })
}

async function creaProdottoInFila(scope: MedusaContainer, nuovo: NuovoProdotto) {
  const { scheda, varianti, aziendaId } = nuovo
  await controllaCodici(scope, varianti.map((v) => v.sku))
  const { metadata, ...campi } = versoMedusa(scheda)
  const prodotto = {
    ...campi,
    handle: await indirizzoLibero(scope, scheda.titolo),
    status: nuovo.stato,
    collection_id: scheda.collezione_id || undefined,
    metadata: { ...metadata, ...(nuovo.metadatiExtra ?? {}) },
    ...(aziendaId && nuovo.legaSubito ? { seller_ids: [aziendaId] } : {}),
    variants: varianti.map((v, indice) => ({ title: v.titolo, sku: v.sku, ean: v.ean || undefined, variant_rank: indice })),
  }
  const offerte = aziendaId
    ? {
        azienda: aziendaId,
        firma: nuovo.firma,
        profilo: await profiloSpedizione(scope, aziendaId),
        ...(await depositoEsistente(scope, aziendaId)),
        righe: varianti.map((v) => ({
          sku: v.sku,
          ean: v.ean,
          prezzo: nuovo.prezzoVendita,
          metadata: metadatiPrezzi({ prezzo_cessione: scheda.prezzo_cessione, prezzo_consigliato: scheda.prezzo_consigliato }),
          quantita: v.quantita ?? 0,
        })),
      }
    : null
  const esito = await esegui(creaProdottoCatalogoWorkflow, scope, { prodotto, created_by: nuovo.autore, offerte })
  if (esito.esito === "fatto") return esito.risultato as string
  if (esito.esito === "annullato") {
    // Un workflow annidato che non riesce ad annullarsi da solo non lo segnala: si controlla che non sia rimasto nulla.
    const resti = await restiDeiCodici(scope, varianti.map((v) => v.sku))
    if (!resti.length) throw esito.errore
    scope.resolve(ContainerRegistrationKeys.LOGGER).error(
      `Creazione annullata ma rimasti varianti o voci di magazzino con i codici ${resti.join(", ")}: ${String((esito.errore as Error)?.message ?? esito.errore)}`)
    throw new SalvataggioAMeta(undefined, esito.errore)
  }
  throw new SalvataggioAMeta(esito.transazione, esito.errore)
}
