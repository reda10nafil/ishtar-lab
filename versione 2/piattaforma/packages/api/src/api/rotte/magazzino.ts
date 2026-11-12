import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const ID = "[^/]+"

aggiungiRegole([
  ["POST", new RegExp(`^/vendor/magazzino/articoli/${ID}/correzione$`), "Stock quantity adjusted"],
  ["POST", new RegExp(`^/admin/magazzino/articoli/${ID}/correzione$`), "Stock quantity adjusted"],
  ["POST", new RegExp(`^/(admin|vendor)/magazzino/articoli/${ID}/rifornimento$`), "Restock requested"],
  ["POST", new RegExp(`^/(admin|vendor)/magazzino/articoli/${ID}/ricevi$`), "Restock received"],
  ["POST", /^\/vendor\/magazzino\/conteggio$/, "Stock count recorded"],
  ["POST", new RegExp(`^/vendor/magazzino/articoli/${ID}/soglia$`), "Item reorder point changed"],
  ["POST", new RegExp(`^/admin/magazzino/articoli/${ID}/soglia$`), "Item reorder point changed"],
  ["POST", /^\/vendor\/magazzino\/soglia$/, "Company reorder point changed"],
  ["POST", /^\/admin\/magazzino\/soglie$/, "Company reorder point changed"],
  ["POST", /^\/admin\/magazzino\/riserve$/, "Reservation created"],
  ["DELETE", new RegExp(`^/admin/magazzino/riserve/${ID}$`), "Reservation released"],
])

/** Permessi delle rotte proprie di questa sezione. Il limite vive sul server. */
export const rotteMagazzino: RottaProtetta[] = [
  { matcher: "/admin/magazzino", middlewares: [permesso("magazzino", "view")] },
  { matcher: "/admin/magazzino/*", middlewares: [permesso("magazzino", "view")] },
  { matcher: "/admin/magazzino/soglie", method: ["POST"], middlewares: [permesso("magazzino", "edit")] },
  { matcher: "/admin/magazzino/articoli/:id/soglia", method: ["POST"], middlewares: [permesso("magazzino", "edit")] },
  { matcher: "/admin/magazzino/articoli/:id/correzione", method: ["POST"], middlewares: [permesso("magazzino", "edit")] },
  { matcher: "/admin/magazzino/articoli/:id/rifornimento", method: ["POST"], middlewares: [permesso("magazzino", "edit")] },
  { matcher: "/admin/magazzino/articoli/:id/ricevi", method: ["POST"], middlewares: [permesso("magazzino", "edit")] },
  { matcher: "/admin/magazzino/riserve", method: ["POST"], middlewares: [permesso("reservations", "edit")] },
  { matcher: "/admin/magazzino/riserve/:id", method: ["DELETE"], middlewares: [permesso("reservations", "edit")] },

  { matcher: "/vendor/magazzino", middlewares: [permesso("magazzino", "view")] },
  { matcher: "/vendor/magazzino/*", middlewares: [permesso("magazzino", "view")] },
  { matcher: "/vendor/magazzino/*", method: ["POST"], middlewares: [permesso("magazzino", "edit")] },
]
