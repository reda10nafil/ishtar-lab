import { SellerRole, type PermissionMap } from "@mercurjs/types"

export type Ruolo = { id: string; etichetta: string; descrizione: string; permessi: PermissionMap | "tutto" }

/** Letture che servono a chiunque lavori nel pannello. */
const BASE_ADMIN: PermissionMap = {
  sellers: "view",
  products: "view",
  product_categories: "view",
  offers: "view",
  store: "view",
  assistenza: "edit",
}

export const RUOLI_ADMIN: Ruolo[] = [
  {
    id: "proprietario",
    etichetta: "Owner",
    descrizione: "Sees and manages everything, including connectors and security.",
    permessi: "tutto",
  },
  {
    id: "catalogo",
    etichetta: "Catalogue manager",
    descrizione: "Approves products and discounts, manages companies and outfits, sees margins.",
    permessi: {
      ...BASE_ADMIN,
      sellers: "edit",
      "sellers.approval": "edit",
      products: "manage",
      "products.review": "edit",
      product_changes: "edit",
      product_categories: "manage",
      product_collections: "manage",
      offers: "edit",
      analisi: "view",
      outfit: "manage",
      sconti: "manage",
      margini: "view",
      magazzino: "view",
      inventory_items: "view",
      stock_locations: "view",
    },
  },
  {
    id: "ordini",
    etichetta: "Orders operator",
    descrizione: "Handles orders, fulfilment and inventory. Does not see margins.",
    permessi: {
      ...BASE_ADMIN,
      orders: "manage",
      "orders.returns": "manage",
      "orders.refunds": "manage",
      customers: "edit",
      customer_groups: "view",
      evasioni: "manage",
      magazzino: "manage",
      inventory_items: "edit",
      stock_locations: "view",
      reservations: "edit",
      cassa: "edit",
      ingrosso: "edit",
    },
  },
  {
    id: "marketing",
    etichetta: "Marketing",
    descrizione: "Creates outfits and campaigns, looks after the online shop. Does not see margins.",
    permessi: {
      ...BASE_ADMIN,
      outfit: "edit",
      sconti: "view",
      analisi: "view",
      marketing: "manage",
      negozio_online: "manage",
      customers: "view",
      customer_groups: "view",
    },
  },
  {
    id: "contabilita",
    etichetta: "Accounting",
    descrizione: "Reads orders, margins and payouts without changing anything.",
    permessi: {
      ...BASE_ADMIN,
      orders: "view",
      customers: "view",
      evasioni: "view",
      margini: "view",
      payouts: "view",
      outfit: "view",
      sconti: "view",
      analisi: "view",
      ingrosso: "view",
    },
  },
  {
    id: "lettura",
    etichetta: "Read only",
    descrizione: "Browses companies, catalogue and outfits, without margins.",
    permessi: {
      ...BASE_ADMIN,
      outfit: "view",
      sconti: "view",
      evasioni: "view",
      magazzino: "view",
      analisi: "view",
      marketing: "view",
      negozio_online: "view",
      ingrosso: "view",
    },
  },
]

/** Letture che servono a chiunque lavori per un'azienda. */
const BASE_AZIENDA: PermissionMap = {
  products: "view",
  product_categories: "view",
  offers: "view",
  orders: "view",
  store: "view",
  regions: "view",
  stock_locations: "view",
  assistenza: "edit",
}

/**
 * Nessun ruolo aziendale ha `offers:edit`, `price_lists`, `promotions` o `customers`:
 * i prezzi di vendita restano a Multi Outfit. Gli ordini sono in sola lettura, perché
 * la pagina Ordini del portale li mostra; le richieste di evasione arriveranno dopo.
 */
export const RUOLI_AZIENDA: Ruolo[] = [
  {
    id: SellerRole.SELLER_ADMINISTRATION,
    etichetta: "Company owner",
    descrizione: "Manages the company's products, discounts, inventory, shipping and team.",
    permessi: {
      ...BASE_AZIENDA,
      products: "manage",
      product_changes: "edit",
      inventory_items: "manage",
      stock_locations: "manage",
      reservations: "view",
      members: "manage",
      "members.invites": "manage",
      roles: "view",
      store: "edit",
      evasioni: "manage",
      magazzino: "manage",
      sconti: "edit",
      outfit: "view",
      payouts: "view",
    },
  },
  {
    id: SellerRole.ORDER_MANAGEMENT,
    etichetta: "Staff",
    descrizione: "Uploads products, proposes discounts and prepares shipments.",
    permessi: {
      ...BASE_AZIENDA,
      products: "edit",
      product_changes: "edit",
      inventory_items: "edit",
      evasioni: "edit",
      magazzino: "edit",
      sconti: "edit",
      outfit: "view",
    },
  },
  {
    id: SellerRole.INVENTORY_MANAGEMENT,
    etichetta: "Warehouse staff",
    descrizione: "Updates stock and prepares shipments. Products are read only.",
    permessi: { ...BASE_AZIENDA, inventory_items: "edit", evasioni: "edit", magazzino: "edit" },
  },
  {
    id: SellerRole.ACCOUNTING,
    etichetta: "Accounting",
    descrizione: "Reads the company's products, requests and payouts.",
    permessi: { ...BASE_AZIENDA, evasioni: "view", payouts: "view", outfit: "view" },
  },
]

export const RUOLO_PROPRIETARIO = "proprietario"

export const trovaRuolo = (elenco: Ruolo[], id: string | null | undefined) => elenco.find((r) => r.id === id)

const SPENTO = "spento:"

/**
 * Un collaboratore spento conserva il ruolo dietro un prefisso: `trovaRuolo` non lo riconosce più,
 * quindi sul server perde ogni permesso finché non viene riacceso.
 */
export const ruoloSpento = (ruolo: string) => `${SPENTO}${ruolo}`

export const leggiRuolo = (valore: string) =>
  valore.startsWith(SPENTO) ? { ruolo: valore.slice(SPENTO.length), attivo: false } : { ruolo: valore, attivo: true }

type Area = { id: string; etichetta: string; permessi: string[] }

/** Righe della tabella «What each role can do»: ogni cella si ricava dai permessi veri del ruolo. */
export const AREE_ADMIN: Area[] = [
  { id: "ordini", etichetta: "Orders & till", permessi: ["orders", "evasioni", "cassa", "ingrosso"] },
  { id: "prodotti", etichetta: "Products & stock", permessi: ["products", "magazzino"] },
  { id: "clienti", etichetta: "Customers", permessi: ["customers"] },
  { id: "sconti", etichetta: "Discounts & marketing", permessi: ["sconti", "marketing"] },
  { id: "analisi", etichetta: "Analytics & money", permessi: ["analisi", "margini"] },
  { id: "impostazioni", etichetta: "Settings & team", permessi: ["impostazioni", "users", "connettori", "registro"] },
]

const RANGO: Record<string, number> = { view: 1, edit: 2, manage: 3 }

/** Il diritto più alto del ruolo su un'area, oppure null se non ne ha. */
export function livelloArea(ruolo: Ruolo, area: Area): string | null {
  if (ruolo.permessi === "tutto") return "manage"
  const permessi = ruolo.permessi as Record<string, string | undefined>
  return area.permessi.reduce<string | null>((migliore, chiave) => {
    const diritto = permessi[chiave]
    return diritto && (RANGO[diritto] ?? 0) > (RANGO[migliore ?? ""] ?? 0) ? diritto : migliore
  }, null)
}
