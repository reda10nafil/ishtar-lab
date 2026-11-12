import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Regione = { id: string; currency_code: string; countries?: ({ iso_2: string } | null)[] }
type Negozio = { default_region_id: string | null; default_sales_channel_id: string | null }

const PAESE_PREFERITO = "it"

/** Ciò che serve per vendere. Quello che manca diventa una frase per chi sta al banco. */
export async function contestoCassa(scope: MedusaContainer) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: negozi }, { data: regioni }, { data: canali }, { data: depositi }, { data: opzioni }] = await Promise.all([
    query.graph({ entity: "store", fields: ["default_region_id", "default_sales_channel_id"], pagination: { take: 1 } }),
    query.graph({ entity: "region", fields: ["id", "currency_code", "countries.iso_2"] }),
    query.graph({ entity: "sales_channel", fields: ["id"], filters: { is_disabled: false } }),
    query.graph({ entity: "stock_location", fields: ["id"], pagination: { take: 1 } }),
    query.graph({ entity: "shipping_option", fields: ["id"], pagination: { take: 1 } }),
  ])
  const negozio = negozi[0] as unknown as Negozio | undefined
  const elenco = regioni as unknown as Regione[]
  const regione = elenco.find((r) => r.id === negozio?.default_region_id) ?? elenco[0] ?? null
  const canaleId = canali.find((c) => c.id === negozio?.default_sales_channel_id)?.id ?? canali[0]?.id ?? null
  const paesi = (regione?.countries ?? []).flatMap((c) => (c ? [c.iso_2] : []))
  const paese = paesi.includes(PAESE_PREFERITO) ? PAESE_PREFERITO : paesi[0] ?? null
  const opzioneId = (opzioni[0] as { id: string } | undefined)?.id ?? null

  const mancanti: string[] = []
  if (!regione) mancanti.push("There's no sales region: the till needs one for its currency and tax. Add it in Settings.")
  else if (!paese) mancanti.push("The sales region has no country: the till needs one to work out tax. Add it in Settings.")
  if (!canaleId) mancanti.push("There's no active sales channel to record till sales under.")
  if (!depositi.length) mancanti.push("There's no warehouse: products need one before they can be sold. Add it under Products, in Inventory.")
  if (!opzioneId) mancanti.push("There's no shipping option: a sale needs one to record the handover. Add it in Settings, under Shipping.")

  return { mancanti, regione, canaleId, paese, opzioneId, valuta: regione?.currency_code ?? "eur" }
}

export type ContestoCassa = Awaited<ReturnType<typeof contestoCassa>>

export const valutaCassa = async (scope: MedusaContainer) => (await contestoCassa(scope)).valuta
