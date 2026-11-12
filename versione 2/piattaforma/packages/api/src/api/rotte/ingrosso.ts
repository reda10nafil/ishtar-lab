import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const ID = "[^/]+"

aggiungiRegole([
  ["POST", /^\/admin\/ingrosso\/rivenditori$/, "Stockist created"],
  ["POST", new RegExp(`^/admin/ingrosso/rivenditori/${ID}$`), "Stockist edited"],
  ["DELETE", new RegExp(`^/admin/ingrosso/rivenditori/${ID}$`), "Stockist deleted"],
  ["POST", /^\/admin\/ingrosso\/trattative$/, "Deal created"],
  ["POST", new RegExp(`^/admin/ingrosso/trattative/${ID}$`), "Deal edited"],
  ["DELETE", new RegExp(`^/admin/ingrosso/trattative/${ID}$`), "Deal deleted"],
  ["POST", new RegExp(`^/admin/ingrosso/trattative/${ID}/sposta$`), "Deal moved on the board"],
  ["POST", new RegExp(`^/admin/ingrosso/trattative/${ID}/note$`), "Note added to a deal"],
  ["POST", new RegExp(`^/admin/ingrosso/trattative/${ID}/ordine$`), "Draft order created from a deal"],
])

const leggere = [permesso("ingrosso", "view")]
const scrivere = [permesso("ingrosso", "edit")]
const eliminare = [permesso("ingrosso", "manage")]

/** La bozza d'ordine è un ordine vero: oltre a `ingrosso` serve lo stesso permesso di `/admin/draft-orders`. */
export const rotteIngrosso: RottaProtetta[] = [
  { matcher: "/admin/ingrosso/rivenditori", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/ingrosso/rivenditori", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ingrosso/rivenditori/:id", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/ingrosso/rivenditori/:id", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ingrosso/rivenditori/:id", method: ["DELETE"], middlewares: eliminare },

  { matcher: "/admin/ingrosso/trattative", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/ingrosso/trattative", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ingrosso/trattative/:id", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/ingrosso/trattative/:id", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ingrosso/trattative/:id", method: ["DELETE"], middlewares: eliminare },
  { matcher: "/admin/ingrosso/trattative/:id/sposta", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ingrosso/trattative/:id/note", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ingrosso/trattative/:id/ordine", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/ingrosso/trattative/:id/ordine", method: ["POST"], middlewares: [...scrivere, permesso("orders", "edit")] },

  { matcher: "/admin/ingrosso/varianti", method: ["GET"], middlewares: scrivere },
]
