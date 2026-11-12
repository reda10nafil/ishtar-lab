import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, toHandle } from "@medusajs/framework/utils"
import { createProductsWorkflow, productEditDeleteProductWorkflow } from "@mercurjs/core/workflows"
import { invalido } from "../../../utili"
import { creaOfferte } from "./offerte"
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
}

export async function controllaCodici(scope: MedusaContainer, codici: string[]) {
  const doppio = codici.find((codice, indice) => codici.indexOf(codice) !== indice)
  if (doppio) throw invalido(`The code ${doppio} is repeated: every variant needs its own`)
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "variant", fields: ["sku"], filters: { sku: codici } })
  const usato = (data as { sku: string }[])[0]?.sku
  if (usato) throw invalido(`The code ${usato} is already used by another item`)
}

/** Lo stesso nome può tornare in stagioni diverse: l'indirizzo del prodotto deve restare unico. */
async function indirizzoLibero(scope: MedusaContainer, titolo: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const base = toHandle(titolo)
  const { data } = await query.graph({ entity: "product", fields: ["id"], filters: { handle: base } })
  return data.length ? `${base}-${Date.now().toString(36)}` : base
}

/** Crea prodotto e varianti; con un'azienda crea anche le offerte. Se le offerte falliscono non resta nulla a metà. */
export async function creaProdotto(scope: MedusaContainer, nuovo: NuovoProdotto) {
  const { scheda, varianti, aziendaId } = nuovo
  await controllaCodici(scope, varianti.map((v) => v.sku))
  const { metadata, ...campi } = versoMedusa(scheda)
  const { result } = await createProductsWorkflow(scope).run({
    input: {
      products: [
        {
          ...campi,
          handle: await indirizzoLibero(scope, scheda.titolo),
          status: nuovo.stato,
          collection_id: scheda.collezione_id || undefined,
          metadata,
          ...(aziendaId && nuovo.legaSubito ? { seller_ids: [aziendaId] } : {}),
          variants: varianti.map((v, indice) => ({ title: v.titolo, sku: v.sku, ean: v.ean || undefined, variant_rank: indice })),
        },
      ],
      created_by: nuovo.autore,
    },
  } as never)
  const id = (result as unknown as { id: string }[])[0].id
  if (!aziendaId) return id

  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "variant", fields: ["id", "sku"], filters: { product_id: id } })
    const perCodice = new Map((data as { id: string; sku: string }[]).map((v) => [v.sku, v.id]))
    await creaOfferte(
      scope,
      aziendaId,
      nuovo.firma,
      varianti.map((v) => ({
        variante_id: perCodice.get(v.sku) ?? "",
        sku: v.sku,
        ean: v.ean,
        quantita: v.quantita,
        prezzo: nuovo.prezzoVendita,
        prezzo_cessione: scheda.prezzo_cessione,
        prezzo_consigliato: scheda.prezzo_consigliato,
      }))
    )
  } catch (errore) {
    await productEditDeleteProductWorkflow(scope).run({ input: { product_id: id, created_by: nuovo.autore, auto_confirm: true } })
    throw errore
  }
  return id
}
