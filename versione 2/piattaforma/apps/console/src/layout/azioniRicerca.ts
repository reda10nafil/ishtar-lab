import { Package, Plus, ReceiptText, Shirt, Store, Tag, UserPlus, type LucideIcon } from "lucide-react"
import type { Permesso } from "../permessi"
import type { Creazione } from "./Crea"

export const ICONA_ORDINI: LucideIcon = ReceiptText

type Azione = { titolo: string; icona: LucideIcon; permesso: Permesso; crea?: Creazione; a?: string; soloAdmin?: boolean }

/** Azioni raggiungibili dalla ricerca: aprono il modulo sul posto, senza cambiare pagina. */
export const AZIONI_RICERCA: Azione[] = [
  { titolo: "New order", icona: Plus, permesso: ["orders", "edit"], crea: "ordine", soloAdmin: true },
  { titolo: "New product", icona: Package, permesso: ["products", "edit"], crea: "prodotto", soloAdmin: true },
  { titolo: "New customer", icona: UserPlus, permesso: ["customers", "edit"], crea: "cliente", soloAdmin: true },
  { titolo: "New discount code", icona: Tag, permesso: ["sconti", "edit"], crea: "sconto", soloAdmin: true },
  { titolo: "New outfit", icona: Shirt, permesso: ["outfit", "edit"], a: "/outfit?nuovo=1" },
  { titolo: "Open the shop till", icona: Store, permesso: ["cassa", "view"], a: "/cassa", soloAdmin: true },
]
