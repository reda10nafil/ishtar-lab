import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { invalido } from "../../../utili"
import { leggiPromozioni, statoDi, tipoDi } from "../../sconti/promozioni"
import type { ContestoCassa } from "./contesto"
import { leggiOfferteInVendita, type OffertaInVendita } from "./in-vendita"

export type RigaBasket = { offerta_id: string; quantita: number }

export type RigaConto = {
  offerta: OffertaInVendita
  prodotto: string
  taglia: string
  quantita: number
  totale: number
  sconto: number
}

const arrotonda = (valore: number) => Math.round(valore * 100) / 100

const FRASI_STATO: Record<string, (codice: string) => string> = {
  in_pausa: (c) => `${c} is paused`,
  programmato: (c) => `${c} hasn't started yet`,
  terminato: (c) => `${c} has ended`,
}

/** Medusa ignora in silenzio i codici non validi: alla cassa serve il motivo. */
async function controllaCodice(scope: MedusaContainer, codice: string) {
  const [promozione] = await leggiPromozioni(scope, { code: codice })
  if (!promozione) throw invalido(`${codice} isn't live`)
  const stato = statoDi(promozione)
  if (stato !== "attivo") throw invalido(FRASI_STATO[stato]?.(codice) ?? `${codice} isn't live`)
  if (tipoDi(promozione) === "spedizione") throw invalido(`${codice} only covers shipping, and the till doesn't ship`)
}

async function descrizioni(scope: MedusaContainer, varianti: string[]) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product_variant", fields: ["id", "title", "product.title"], filters: { id: varianti } })
  return new Map((data as unknown as { id: string; title: string; product?: { title: string } }[]).map((v) => [v.id, v]))
}

/** Sconto per riga con lo stesso calcolo che Medusa usa sulla bozza d'ordine. */
async function scontiPerRiga(scope: MedusaContainer, righe: RigaConto[], codice: string | null, valuta: string) {
  const azioni = await scope.resolve(Modules.PROMOTION).computeActions(codice ? [codice] : [], {
    currency_code: valuta,
    items: righe.map((r) => ({
      id: r.offerta.id,
      quantity: r.quantita,
      subtotal: r.totale,
      original_total: r.totale,
      is_discountable: true,
      product: { id: r.offerta.prodotto_id },
      product_id: r.offerta.prodotto_id,
    })),
  } as never)
  const perRiga = new Map<string, number>()
  for (const azione of azioni as { action: string; item_id?: string; amount?: unknown }[]) {
    if (azione.action !== "addItemAdjustment" || !azione.item_id) continue
    perRiga.set(azione.item_id, (perRiga.get(azione.item_id) ?? 0) + Number(azione.amount))
  }
  return perRiga
}

/** Aliquota di ogni riga, se è configurata. Senza aliquote il conto dice che l'IVA non è impostata. */
async function aliquote(scope: MedusaContainer, righe: RigaConto[], paese: string, valuta: string) {
  try {
    const linee = await scope.resolve(Modules.TAX).getTaxLines(
      righe.map((r) => ({
        id: r.offerta.id,
        product_id: r.offerta.prodotto_id,
        quantity: r.quantita,
        unit_price: r.offerta.prezzo,
        currency_code: valuta,
      })),
      { address: { country_code: paese } }
    )
    const perRiga = new Map<string, number>()
    for (const linea of linee as { line_item_id?: string; rate?: number | null }[]) {
      if (linea.line_item_id) perRiga.set(linea.line_item_id, (perRiga.get(linea.line_item_id) ?? 0) + Number(linea.rate ?? 0))
    }
    return perRiga
  } catch {
    return new Map<string, number>()
  }
}

/** Il conto si fa sempre sul server: prezzi e scorte non arrivano mai dal browser. */
export async function calcolaConto(scope: MedusaContainer, { valuta, paese }: ContestoCassa, basket: RigaBasket[], codice: string | null) {
  if (codice) await controllaCodice(scope, codice)
  const ids = basket.map((r) => r.offerta_id)
  const offerte = ids.length ? await leggiOfferteInVendita(scope, { id: ids }, valuta) : []
  const perId = new Map(offerte.map((o) => [o.id, o]))
  const nomi = offerte.length ? await descrizioni(scope, offerte.map((o) => o.variante_id)) : new Map()

  const righe = basket.map((riga): RigaConto => {
    const offerta = perId.get(riga.offerta_id)
    if (!offerta) throw invalido("A product in the basket is no longer on sale: remove it to carry on")
    const nome = nomi.get(offerta.variante_id)
    return { offerta, prodotto: nome?.product?.title ?? "Product", taglia: nome?.title ?? "", quantita: riga.quantita, totale: arrotonda(offerta.prezzo * riga.quantita), sconto: 0 }
  })

  const sconti = await scontiPerRiga(scope, righe, codice, valuta)
  const conSconto = righe.map((r) => ({ ...r, sconto: arrotonda(sconti.get(r.offerta.id) ?? 0) }))
  const sconto = arrotonda(conSconto.reduce((totale, r) => totale + r.sconto, 0))
  if (codice && righe.length && sconto <= 0) throw invalido(`${codice} doesn't apply to these products`)

  const subtotale = arrotonda(conSconto.reduce((totale, r) => totale + r.totale, 0))
  const perAliquota = paese && righe.length ? await aliquote(scope, conSconto, paese, valuta) : new Map<string, number>()
  const iva = perAliquota.size
    ? arrotonda(
        conSconto.reduce((totale, r) => {
          const aliquota = perAliquota.get(r.offerta.id) ?? 0
          return totale + ((r.totale - r.sconto) * aliquota) / (100 + aliquota)
        }, 0)
      )
    : null

  return { righe: conSconto, subtotale, sconto, iva, totale: arrotonda(subtotale - sconto), codice }
}

export type Conto = Awaited<ReturnType<typeof calcolaConto>>
