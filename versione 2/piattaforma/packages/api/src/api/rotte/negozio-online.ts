import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const ID = "[^/]+"

aggiungiRegole([
  ["POST", /^\/admin\/negozio-online$/, "Online shop look changed"],
  ["POST", /^\/admin\/negozio-online\/pagine$/, "Online shop page created"],
  ["POST", new RegExp(`^/admin/negozio-online/pagine/${ID}$`), "Online shop page changed"],
  ["DELETE", new RegExp(`^/admin/negozio-online/pagine/${ID}$`), "Online shop page deleted"],
])

const leggere = [permesso("negozio_online", "view")]
const scrivere = [permesso("negozio_online", "edit")]

/** Permessi delle rotte proprie di questa sezione. Il limite vive sul server. */
export const rotteNegozioOnline: RottaProtetta[] = [
  { matcher: "/admin/negozio-online", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/negozio-online", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/negozio-online/vetrina", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/negozio-online/pagine", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/negozio-online/pagine/:id", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/negozio-online/pagine/:id", method: ["DELETE"], middlewares: [permesso("negozio_online", "manage")] },
]
