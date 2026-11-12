import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Livello = { location_id: string; stocked_quantity: number; reserved_quantity: number }
type Voce = { inventory_item_id: string; required_quantity?: number | null; inventory_item?: { location_levels?: (Livello | null)[] } | null }

type RigaOfferta = {
  id: string
  variant_id: string
  product_id: string | null
  seller_id: string
  seller?: { name: string; status: string } | null
  prices?: ({ amount: number; currency_code: string; min_quantity?: number | null } | null)[]
  inventory_item_link?: Voce[]
}

type RigaProdotto = {
  id: string
  title: string
  thumbnail: string | null
  categories?: ({ id: string; name: string } | null)[]
  variants?: { id: string; title: string; variant_rank: number | null }[]
}

export type OffertaInVendita = {
  id: string
  variante_id: string
  prodotto_id: string
  azienda_id: string
  azienda: string
  prezzo: number
  disponibili: number
  deposito_id: string | null
  voci: { voce_id: string; per_unita: number }[]
}

const CAMPI_OFFERTA = [
  "id",
  "variant_id",
  "product_id",
  "seller_id",
  "seller.name",
  "seller.status",
  "prices.amount",
  "prices.currency_code",
  "prices.min_quantity",
  "inventory_item_link.inventory_item_id",
  "inventory_item_link.required_quantity",
  "inventory_item_link.inventory_item.location_levels.location_id",
  "inventory_item_link.inventory_item.location_levels.stocked_quantity",
  "inventory_item_link.inventory_item.location_levels.reserved_quantity",
]

const MASSIMO_PRODOTTI = 500

const prezzoIn = (riga: RigaOfferta, valuta: string) => {
  const voci = (riga.prices ?? []).filter((p): p is NonNullable<typeof p> => p?.currency_code === valuta)
  const base = voci.find((p) => !p.min_quantity) ?? voci[0]
  return base ? Number(base.amount) : null
}

/**
 * Un'offerta si vende da un solo deposito: quello che può dare più unità.
 * Per i kit vale il pezzo più scarso, e tutti i pezzi devono stare in quel deposito.
 */
function depositoMigliore(voci: Voce[]) {
  const perDeposito = new Map<string, number[]>()
  for (const voce of voci) {
    const perUnita = Number(voce.required_quantity ?? 1) || 1
    for (const livello of voce.inventory_item?.location_levels ?? []) {
      if (!livello) continue
      const libere = Number(livello.stocked_quantity) - Number(livello.reserved_quantity)
      perDeposito.set(livello.location_id, [...(perDeposito.get(livello.location_id) ?? []), Math.max(0, Math.floor(libere / perUnita))])
    }
  }
  let scelto: { deposito_id: string | null; disponibili: number } = { deposito_id: null, disponibili: 0 }
  for (const [deposito_id, unita] of perDeposito) {
    const disponibili = unita.length === voci.length ? Math.min(...unita) : 0
    if (!scelto.deposito_id || disponibili > scelto.disponibili) scelto = { deposito_id, disponibili }
  }
  return scelto
}

function normalizza(riga: RigaOfferta, valuta: string): OffertaInVendita | null {
  const prezzo = prezzoIn(riga, valuta)
  if (prezzo === null || !riga.product_id || riga.seller?.status !== "open") return null
  const voci = riga.inventory_item_link ?? []
  return {
    id: riga.id,
    variante_id: riga.variant_id,
    prodotto_id: riga.product_id,
    azienda_id: riga.seller_id,
    azienda: riga.seller.name,
    prezzo,
    voci: voci.map((v) => ({ voce_id: v.inventory_item_id, per_unita: Number(v.required_quantity ?? 1) || 1 })),
    ...depositoMigliore(voci),
  }
}

/** Offerte vendibili: azienda attiva e prezzo nella valuta della cassa. */
export async function leggiOfferteInVendita(scope: MedusaContainer, filtri: Record<string, unknown>, valuta: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "offer", fields: CAMPI_OFFERTA, filters: filtri })
  return (data as unknown as RigaOfferta[]).flatMap((riga) => normalizza(riga, valuta) ?? [])
}

const ordinaTaglie = (voci: NonNullable<RigaProdotto["variants"]>) =>
  [...voci].sort((a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0) || a.title.localeCompare(b.title, "en", { numeric: true }))

/** Prodotti pubblicati con almeno un'offerta: quelli senza offerte non si possono vendere. */
export async function prodottiInVendita(scope: MedusaContainer, valuta: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "thumbnail", "categories.id", "categories.name", "variants.id", "variants.title", "variants.variant_rank"],
    filters: { status: "published" },
    pagination: { take: MASSIMO_PRODOTTI, order: { title: "ASC" } },
  })
  const righe = data as unknown as RigaProdotto[]
  if (!righe.length) return []
  const offerte = await leggiOfferteInVendita(scope, { product_id: righe.map((r) => r.id) }, valuta)
  const perVariante = new Map<string, OffertaInVendita[]>()
  for (const offerta of offerte) perVariante.set(offerta.variante_id, [...(perVariante.get(offerta.variante_id) ?? []), offerta])

  return righe.flatMap((riga) => {
    const taglie = ordinaTaglie(riga.variants ?? []).flatMap((variante) => {
      const proprie = [...(perVariante.get(variante.id) ?? [])].sort((a, b) => a.prezzo - b.prezzo)
      if (!proprie.length) return []
      return [{ id: variante.id, titolo: variante.title, offerte: proprie.map((o) => ({ id: o.id, azienda: o.azienda, prezzo: o.prezzo, disponibili: o.disponibili })) }]
    })
    if (!taglie.length) return []
    const tutte = taglie.flatMap((t) => t.offerte)
    const conScorte = tutte.filter((o) => o.disponibili > 0)
    const prezzi = (conScorte.length ? conScorte : tutte).map((o) => o.prezzo)
    return [
      {
        id: riga.id,
        titolo: riga.title,
        foto: riga.thumbnail,
        categorie: (riga.categories ?? []).flatMap((c) => (c ? [{ id: c.id, nome: c.name }] : [])),
        prezzo_min: Math.min(...prezzi),
        prezzo_max: Math.max(...prezzi),
        disponibili: tutte.reduce((totale, o) => totale + o.disponibili, 0),
        taglie,
      },
    ]
  })
}
