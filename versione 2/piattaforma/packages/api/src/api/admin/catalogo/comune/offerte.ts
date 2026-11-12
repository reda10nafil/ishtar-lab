import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createInventoryLevelsWorkflow, deleteInventoryItemWorkflow, updateInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"
import { createOffersWorkflow, createSellerStockLocationsWorkflow, deleteOffersWorkflow, updateOffersWorkflow } from "@mercurjs/core/workflows"
import { SOGLIA_PREDEFINITA } from "../../magazzino/lib/scorte"

export const VALUTA = "eur"

export type Proposta = { prezzo_cessione: number | null; prezzo_consigliato: number | null; proposta_il: string }
export type Livello = { voce_id: string; deposito_id: string; quantita: number }

export type Offerta = {
  id: string
  variante_id: string
  prodotto_id: string | null
  azienda: { id: string; nome: string }
  sku: string
  ean: string | null
  prezzo: number | null
  prezzi: { id: string; amount: number; currency_code: string }[]
  scorte: number
  /** Punto di riordino, con la stessa precedenza del Magazzino: articolo, azienda, predefinita. */
  soglia: number
  livelli: Livello[]
  voci_magazzino: string[]
  prezzo_cessione: number | null
  prezzo_consigliato: number | null
  proposta: Proposta | null
  metadata: Record<string, unknown>
}

type RigaOfferta = {
  id: string
  seller_id: string
  variant_id: string
  product_id: string | null
  sku: string
  ean: string | null
  metadata: Record<string, unknown> | null
  seller?: { id: string; name: string; metadata?: Record<string, unknown> | null } | null
  prices?: ({ id: string; amount: number; currency_code: string } | null)[]
  inventory_item_link?: {
    inventory_item_id: string
    inventory_item?: { id: string; metadata?: Record<string, unknown> | null; location_levels?: { location_id: string; stocked_quantity: number }[] } | null
  }[]
}

const CAMPI = [
  "id",
  "seller_id",
  "variant_id",
  "product_id",
  "sku",
  "ean",
  "metadata",
  "seller.id",
  "seller.name",
  "seller.metadata",
  "prices.id",
  "prices.amount",
  "prices.currency_code",
  "inventory_item_link.inventory_item_id",
  "inventory_item_link.inventory_item.id",
  "inventory_item_link.inventory_item.metadata",
  "inventory_item_link.inventory_item.location_levels.location_id",
  "inventory_item_link.inventory_item.location_levels.stocked_quantity",
]

const numero = (valore: unknown) => (typeof valore === "number" && Number.isFinite(valore) ? valore : null)
const interoPositivo = (valore: unknown) => (typeof valore === "number" && Number.isInteger(valore) && valore >= 0 ? valore : null)

function normalizza(riga: RigaOfferta): Offerta {
  const prezzi = (riga.prices ?? []).filter((p): p is NonNullable<typeof p> => Boolean(p?.id)).map((p) => ({ ...p, amount: Number(p.amount) }))
  const voci = riga.inventory_item_link ?? []
  const livelli = voci.flatMap((voce) =>
    (voce.inventory_item?.location_levels ?? []).map((l) => ({ voce_id: voce.inventory_item_id, deposito_id: l.location_id, quantita: Number(l.stocked_quantity) }))
  )
  const metadata = riga.metadata ?? {}
  const sogliaArticolo = voci.map((v) => interoPositivo(v.inventory_item?.metadata?.soglia_sicurezza)).find((s) => s !== null)
  return {
    id: riga.id,
    variante_id: riga.variant_id,
    prodotto_id: riga.product_id,
    azienda: { id: riga.seller_id, nome: riga.seller?.name ?? "Company" },
    sku: riga.sku,
    ean: riga.ean,
    prezzo: prezzi.find((p) => p.currency_code === VALUTA)?.amount ?? null,
    prezzi,
    scorte: livelli.reduce((totale, l) => totale + l.quantita, 0),
    soglia: sogliaArticolo ?? interoPositivo(riga.seller?.metadata?.soglia_sicurezza) ?? SOGLIA_PREDEFINITA,
    livelli,
    voci_magazzino: voci.map((v) => v.inventory_item_id),
    prezzo_cessione: numero(metadata.prezzo_cessione),
    prezzo_consigliato: numero(metadata.prezzo_consigliato),
    proposta: (metadata.proposta_prezzi as Proposta | undefined) ?? null,
    metadata,
  }
}

export async function leggiOfferte(scope: MedusaContainer, filtri: Record<string, unknown>) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "offer", fields: CAMPI, filters: filtri })
  return (data as RigaOfferta[]).map(normalizza)
}

/** Le aziende invitate non hanno ancora un deposito: il primo nasce quando serve una quantità. */
export async function depositoAzienda(scope: MedusaContainer, aziendaId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "seller", fields: ["id", "name", "stock_locations.id"], filters: { id: aziendaId } })
  const azienda = data[0] as { name: string; stock_locations?: ({ id: string } | null)[] } | undefined
  const esistente = azienda?.stock_locations?.find(Boolean)?.id
  if (esistente) return esistente
  const { result } = await createSellerStockLocationsWorkflow(scope).run({
    input: { seller_id: aziendaId, locations: [{ name: `${azienda?.name ?? "Company"} warehouse` }] },
  })
  return result[0].id
}

/** Il profilo di spedizione è obbligatorio: si riusa quello dell'azienda, poi quello del negozio. */
async function profiloSpedizione(scope: MedusaContainer, aziendaId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const unaSola = { take: 1, skip: 0 }
  const leggi = (filtri: Record<string, unknown>) => query.graph({ entity: "offer", fields: ["shipping_profile_id"], filters: filtri, pagination: unaSola })
  const [{ data: proprie }, { data: altre }] = await Promise.all([leggi({ seller_id: aziendaId }), leggi({})])
  const trovato = (proprie[0] ?? altre[0]) as { shipping_profile_id?: string } | undefined
  if (trovato?.shipping_profile_id) return trovato.shipping_profile_id
  const { data: profili } = await query.graph({ entity: "shipping_profile", fields: ["id"], pagination: unaSola })
  return (profili[0] as { id: string } | undefined)?.id ?? ""
}

export type NuovaOfferta = {
  variante_id: string
  sku: string
  ean?: string | null
  prezzo?: number | null
  prezzo_cessione?: number | null
  prezzo_consigliato?: number | null
  quantita?: number | null
}

const metadatiPrezzi = (o: Pick<NuovaOfferta, "prezzo_cessione" | "prezzo_consigliato">) =>
  Object.fromEntries(Object.entries({ prezzo_cessione: o.prezzo_cessione, prezzo_consigliato: o.prezzo_consigliato }).filter(([, valore]) => valore !== null && valore !== undefined))

export async function creaOfferte(scope: MedusaContainer, aziendaId: string, creataDa: string, righe: NuovaOfferta[]) {
  if (!righe.length) return
  const profilo = await profiloSpedizione(scope, aziendaId)
  const conQuantita = righe.some((r) => (r.quantita ?? 0) > 0)
  const deposito = conQuantita ? await depositoAzienda(scope, aziendaId) : null
  await createOffersWorkflow(scope).run({
    input: {
      offers: righe.map((r) => ({
        seller_id: aziendaId,
        created_by: creataDa,
        variant_id: r.variante_id,
        sku: r.sku,
        ean: r.ean || null,
        upc: null,
        shipping_profile_id: profilo,
        leadtime_to_ship: null,
        condition_id: null,
        metadata: metadatiPrezzi(r),
        prices: r.prezzo === null || r.prezzo === undefined ? [] : [{ amount: r.prezzo, currency_code: VALUTA }],
        inventory_items: [
          {
            sku: r.sku,
            required_quantity: 1,
            stock_levels: deposito && (r.quantita ?? 0) > 0 ? [{ location_id: deposito, stocked_quantity: r.quantita ?? 0 }] : [],
          },
        ],
      })),
    },
  })
}

/** Sostituisce solo il prezzo in euro: gli altri prezzi dell'offerta restano com'erano. */
function prezziAggiornati(offerta: Offerta, prezzo: number | null) {
  const inEuro = offerta.prezzi.find((p) => p.currency_code === VALUTA)
  const altri = offerta.prezzi.filter((p) => p.currency_code !== VALUTA).map(({ id, amount, currency_code }) => ({ id, amount, currency_code }))
  if (prezzo === null) return altri
  return [...altri, { ...(inEuro ? { id: inEuro.id } : {}), amount: prezzo, currency_code: VALUTA }]
}

export type ModificaOfferta = { prezzo?: number | null; metadata?: Record<string, unknown> }

export async function aggiornaOfferta(scope: MedusaContainer, offerta: Offerta, modifica: ModificaOfferta, autore: string) {
  await updateOffersWorkflow(scope).run({
    input: {
      offers: [
        {
          id: offerta.id,
          ...(modifica.metadata ? { metadata: modifica.metadata } : {}),
          ...(modifica.prezzo !== undefined ? { prices: prezziAggiornati(offerta, modifica.prezzo) } : {}),
        },
      ],
      updated_by: autore,
    },
  })
}

/** Imposta la quantità nel deposito dell'offerta, creando il livello se manca. */
export async function impostaScorte(scope: MedusaContainer, offerta: Offerta, quantita: number) {
  const [livello] = offerta.livelli
  if (livello) {
    await updateInventoryLevelsWorkflow(scope).run({
      input: { updates: [{ inventory_item_id: livello.voce_id, location_id: livello.deposito_id, stocked_quantity: quantita }] },
    })
    return
  }
  const [voce] = offerta.voci_magazzino
  if (!voce) return
  const deposito = await depositoAzienda(scope, offerta.azienda.id)
  await createInventoryLevelsWorkflow(scope).run({
    input: { inventory_levels: [{ inventory_item_id: voce, location_id: deposito, stocked_quantity: quantita }] },
  })
}

/** Toglie le offerte e le loro voci di magazzino, che altrimenti resterebbero orfane. */
export async function rimuoviOfferte(scope: MedusaContainer, offerte: Offerta[]) {
  if (!offerte.length) return
  await deleteOffersWorkflow(scope).run({ input: { ids: offerte.map((o) => o.id) } })
  const voci = [...new Set(offerte.flatMap((o) => o.voci_magazzino))]
  if (voci.length) await deleteInventoryItemWorkflow(scope).run({ input: voci })
}
