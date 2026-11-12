import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const ID = "[^/]+"

aggiungiRegole([
  ["POST", /^\/admin\/cassa\/vendite$/, "Till sale completed"],
  ["POST", new RegExp(`^/admin/cassa/vendite/${ID}/annulla$`), "Till sale voided"],
])

const leggere = [permesso("cassa", "view")]
const scrivere = [permesso("cassa", "edit")]

/** La cassa ha il suo permesso: chi sta al banco non deve poter gestire tutti gli ordini. */
export const rotteCassa: RottaProtetta[] = [
  { matcher: "/admin/cassa", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/cassa/anteprima", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/cassa/clienti", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/cassa/vendite", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/cassa/vendite/:id/annulla", method: ["POST"], middlewares: scrivere },
]
