import {
  Building2,
  ChartNoAxesColumn,
  CircleHelp,
  ClipboardCheck,
  Globe,
  House,
  Megaphone,
  Package,
  Puzzle,
  ReceiptText,
  Settings,
  Shirt,
  Store,
  Tag,
  Truck,
  Users,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Permesso } from "../permessi"

export type SottoVoce = { a: string; etichetta: string }

/**
 * `anche`: altre rotte che appartengono alla stessa voce, come le schede di una sezione.
 * `sotto`: sotto-voci che si aprono nel menu quando la sezione è attiva.
 */
export type Voce = {
  a: string
  etichetta: string
  icona: LucideIcon
  permesso?: Permesso
  anche?: string[]
  sotto?: SottoVoce[]
  /** Schede che non stanno nel menu ma compaiono nelle briciole e nella ricerca. */
  schede?: SottoVoce[]
  /** Canale di vendita: le briciole e la ricerca lo raccolgono sotto «Sales channels». */
  canale?: boolean
}
export type Gruppo = { titolo: string; voci: Voce[] }

export const MENU_ADMIN: Gruppo[] = [
  {
    titolo: "Store",
    voci: [
      { a: "/", etichetta: "Overview", icona: House },
      {
        a: "/ordini",
        etichetta: "Orders",
        icona: ReceiptText,
        permesso: ["orders", "view"],
        anche: ["/evasioni"],
        sotto: [
          { a: "/ordini/tutti", etichetta: "All orders" },
          { a: "/ordini/bozze", etichetta: "Drafts" },
          { a: "/ordini/resi", etichetta: "Returns" },
          { a: "/evasioni", etichetta: "Fulfilment" },
        ],
      },
      {
        a: "/prodotti",
        etichetta: "Products",
        icona: Package,
        permesso: ["products", "view"],
        anche: ["/magazzino"],
        sotto: [
          { a: "/prodotti/catalogo", etichetta: "Catalogue" },
          { a: "/magazzino", etichetta: "Inventory" },
          { a: "/prodotti/collezioni", etichetta: "Collections" },
        ],
      },
      { a: "/revisione", etichetta: "Review", icona: ClipboardCheck, permesso: ["products.review", "edit"] },
      { a: "/outfit", etichetta: "Outfit Studio", icona: Shirt, permesso: ["outfit", "view"] },
      {
        a: "/clienti",
        etichetta: "Customers",
        icona: Users,
        permesso: ["customers", "view"],
        sotto: [
          { a: "/clienti/persone", etichetta: "People" },
          { a: "/clienti/segmenti", etichetta: "Segments" },
        ],
      },
      {
        a: "/analisi",
        etichetta: "Analytics",
        icona: ChartNoAxesColumn,
        permesso: ["analisi", "view"],
        sotto: [
          { a: "/analisi/vendite", etichetta: "Sales" },
          { a: "/analisi/traffico", etichetta: "Traffic" },
          { a: "/analisi/report", etichetta: "Report builder" },
        ],
      },
      {
        a: "/marketing",
        etichetta: "Marketing",
        icona: Megaphone,
        permesso: ["marketing", "view"],
        sotto: [
          { a: "/marketing/campagne", etichetta: "Campaigns" },
          { a: "/marketing/automazioni", etichetta: "Automations" },
        ],
      },
      {
        a: "/sconti",
        etichetta: "Discounts",
        icona: Tag,
        permesso: ["sconti", "view"],
        sotto: [
          { a: "/sconti/codici", etichetta: "Codes" },
          { a: "/sconti/carte-regalo", etichetta: "Gift cards" },
        ],
      },
    ],
  },
  {
    titolo: "Sell on",
    voci: [
      { a: "/negozio-online", etichetta: "Online shop", icona: Globe, permesso: ["negozio_online", "view"], canale: true },
      { a: "/cassa", etichetta: "Shop till", icona: Store, permesso: ["cassa", "view"], canale: true },
      { a: "/ingrosso", etichetta: "Wholesale", icona: Truck, permesso: ["ingrosso", "view"], canale: true },
      { a: "/aziende", etichetta: "Companies", icona: Building2, permesso: ["sellers", "view"] },
    ],
  },
  {
    titolo: "Extend",
    voci: [
      { a: "/connettori", etichetta: "Apps", icona: Puzzle, permesso: ["connettori", "view"] },
      {
        a: "/impostazioni",
        etichetta: "Settings",
        icona: Settings,
        permesso: ["impostazioni", "view"],
        anche: ["/team", "/registro"],
        schede: [
          { a: "/impostazioni/negozio", etichetta: "Store" },
          { a: "/team", etichetta: "Team" },
          { a: "/impostazioni/spedizioni", etichetta: "Shipping" },
          { a: "/impostazioni/avvisi", etichetta: "Alerts" },
          { a: "/impostazioni/aspetto", etichetta: "Appearance" },
          { a: "/impostazioni/dati", etichetta: "Data" },
          { a: "/registro", etichetta: "Activity log" },
        ],
      },
      { a: "/assistenza", etichetta: "Help", icona: CircleHelp, permesso: ["assistenza", "view"] },
    ],
  },
]

export const MENU_AZIENDA: Gruppo[] = [
  {
    titolo: "My company",
    voci: [
      { a: "/", etichetta: "Overview", icona: House },
      { a: "/prodotti", etichetta: "My products", icona: Package, permesso: ["products", "view"] },
      { a: "/magazzino", etichetta: "Inventory", icona: Warehouse, permesso: ["magazzino", "view"] },
      { a: "/ordini", etichetta: "Orders", icona: ReceiptText, permesso: ["orders", "view"] },
      { a: "/evasioni", etichetta: "Fulfilment", icona: Truck, permesso: ["evasioni", "view"] },
      { a: "/outfit", etichetta: "Outfits", icona: Shirt, permesso: ["outfit", "view"] },
      { a: "/sconti", etichetta: "Discounts", icona: Tag, permesso: ["sconti", "view"] },
      { a: "/team", etichetta: "Team", icona: Users, permesso: ["members", "view"] },
      { a: "/assistenza", etichetta: "Help", icona: CircleHelp, permesso: ["assistenza", "view"] },
    ],
  },
]

/** Voci della barra in basso su telefono: la quinta è sempre «More». */
export const BASSO_ADMIN = ["/", "/ordini", "/prodotti", "/analisi"]
export const BASSO_AZIENDA = ["/", "/prodotti", "/ordini", "/evasioni"]

export const appartiene = (voce: Voce, percorso: string) =>
  [voce.a, ...(voce.anche ?? [])].some((a) => (a === "/" ? percorso === "/" : percorso === a || percorso.startsWith(`${a}/`)))
