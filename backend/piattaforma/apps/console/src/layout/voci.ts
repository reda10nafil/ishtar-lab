import {
  BadgePercent,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Package,
  Plug,
  Settings,
  Shirt,
  ShoppingBag,
  Store,
  Truck,
  Users,
  UsersRound,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Permesso } from "../permessi"

/** `anche`: altre rotte che appartengono alla stessa voce, come le schede di una sezione. */
export type Voce = { a: string; etichetta: string; icona: LucideIcon; permesso?: Permesso; anche?: string[] }
export type Gruppo = { titolo: string; voci: Voce[] }

export const MENU_ADMIN: Gruppo[] = [
  {
    titolo: "Store",
    voci: [
      { a: "/", etichetta: "Overview", icona: LayoutDashboard },
      { a: "/ordini", etichetta: "Orders", icona: ShoppingBag, permesso: ["orders", "view"], anche: ["/evasioni"] },
      { a: "/prodotti", etichetta: "Products", icona: Package, permesso: ["products", "view"], anche: ["/magazzino"] },
      { a: "/revisione", etichetta: "Review", icona: ClipboardCheck, permesso: ["products.review", "edit"] },
      { a: "/outfit", etichetta: "Outfit Studio", icona: Shirt, permesso: ["outfit", "view"] },
      { a: "/clienti", etichetta: "Customers", icona: UsersRound, permesso: ["customers", "view"] },
      { a: "/analisi", etichetta: "Analytics", icona: BarChart3, permesso: ["analisi", "view"] },
      { a: "/marketing", etichetta: "Marketing", icona: Megaphone, permesso: ["marketing", "view"] },
      { a: "/sconti", etichetta: "Discounts", icona: BadgePercent, permesso: ["sconti", "view"] },
    ],
  },
  {
    titolo: "Sell on",
    voci: [
      { a: "/negozio-online", etichetta: "Online shop", icona: Store, permesso: ["negozio_online", "view"] },
      { a: "/cassa", etichetta: "Shop till", icona: CreditCard, permesso: ["cassa", "view"] },
      { a: "/ingrosso", etichetta: "Wholesale", icona: Boxes, permesso: ["ingrosso", "view"] },
      { a: "/aziende", etichetta: "Companies", icona: Building2, permesso: ["sellers", "view"] },
    ],
  },
  {
    titolo: "Extend",
    voci: [
      { a: "/connettori", etichetta: "Apps", icona: Plug, permesso: ["connettori", "view"] },
      { a: "/impostazioni", etichetta: "Settings", icona: Settings, permesso: ["impostazioni", "view"], anche: ["/team", "/registro"] },
      { a: "/assistenza", etichetta: "Help", icona: LifeBuoy, permesso: ["assistenza", "view"] },
    ],
  },
]

export const MENU_AZIENDA: Gruppo[] = [
  {
    titolo: "My company",
    voci: [
      { a: "/", etichetta: "Overview", icona: LayoutDashboard },
      { a: "/prodotti", etichetta: "My products", icona: Package, permesso: ["products", "view"] },
      { a: "/magazzino", etichetta: "Inventory", icona: Warehouse, permesso: ["magazzino", "view"] },
      { a: "/ordini", etichetta: "Orders", icona: ShoppingBag, permesso: ["orders", "view"] },
      { a: "/evasioni", etichetta: "Fulfilment", icona: Truck, permesso: ["evasioni", "view"] },
      { a: "/outfit", etichetta: "Outfits", icona: Shirt, permesso: ["outfit", "view"] },
      { a: "/sconti", etichetta: "Discounts", icona: BadgePercent, permesso: ["sconti", "view"] },
      { a: "/team", etichetta: "Team", icona: Users, permesso: ["members", "view"] },
      { a: "/assistenza", etichetta: "Help", icona: LifeBuoy, permesso: ["assistenza", "view"] },
    ],
  },
]

/** Voci della barra in basso su telefono: la quinta è sempre «More». */
export const BASSO_ADMIN = ["/", "/ordini", "/prodotti", "/analisi"]
export const BASSO_AZIENDA = ["/", "/prodotti", "/ordini", "/evasioni"]

export const appartiene = (voce: Voce, percorso: string) =>
  [voce.a, ...(voce.anche ?? [])].some((a) => (a === "/" ? percorso === "/" : percorso === a || percorso.startsWith(`${a}/`)))
