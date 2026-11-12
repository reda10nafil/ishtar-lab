import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const ID = "[^/]+"

aggiungiRegole([
  ["POST", /^\/admin\/sconti\/codici$/, "Discount created"],
  ["POST", new RegExp(`^/admin/sconti/codici/${ID}$`), "Discount edited"],
  ["DELETE", new RegExp(`^/admin/sconti/codici/${ID}$`), "Discount deleted"],
  ["POST", new RegExp(`^/admin/sconti/codici/${ID}/stato$`), "Discount paused or resumed"],
  ["POST", new RegExp(`^/admin/sconti/codici/${ID}/duplica$`), "Discount duplicated"],
  ["POST", new RegExp(`^/admin/sconti/proposte/${ID}/approva$`), "Discount proposal approved"],
  ["POST", new RegExp(`^/admin/sconti/proposte/${ID}/rifiuta$`), "Discount proposal rejected"],
  ["DELETE", new RegExp(`^/admin/sconti/proposte/${ID}$`), "Discount proposal deleted"],
  ["POST", /^\/vendor\/sconti\/proposte$/, "Discount proposed"],
  ["DELETE", new RegExp(`^/vendor/sconti/proposte/${ID}$`), "Discount proposal withdrawn"],
  ["POST", /^\/admin\/carte-regalo$/, "Gift card issued"],
  ["POST", new RegExp(`^/admin/carte-regalo/${ID}/movimenti$`), "Gift card balance adjusted"],
  ["POST", new RegExp(`^/admin/carte-regalo/${ID}/annulla$`), "Gift card cancelled"],
  ["POST", new RegExp(`^/admin/carte-regalo/${ID}/blocco$`), "Gift card frozen or unfrozen"],
  ["DELETE", new RegExp(`^/admin/carte-regalo/${ID}$`), "Gift card deleted"],
])

const leggere = [permesso("sconti", "view")]
const scrivere = [permesso("sconti", "edit")]
const decidere = [permesso("sconti", "manage")]

/**
 * Nessuna rotta usa `promotions`: i ruoli aziendali non lo hanno e l'amministrazione lavora con `sconti`.
 * Le carte regalo non hanno rotte `/vendor`: restano solo all'amministratore.
 */
export const rotteSconti: RottaProtetta[] = [
  { matcher: "/admin/sconti/codici", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/sconti/codici", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/sconti/codici/:id", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/sconti/codici/:id", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/sconti/codici/:id", method: ["DELETE"], middlewares: decidere },
  { matcher: "/admin/sconti/codici/:id/stato", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/sconti/codici/:id/duplica", method: ["POST"], middlewares: scrivere },

  { matcher: "/admin/sconti/proposte", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/sconti/proposte/:id", method: ["DELETE"], middlewares: decidere },
  { matcher: "/admin/sconti/proposte/:id/approva", method: ["POST"], middlewares: decidere },
  { matcher: "/admin/sconti/proposte/:id/rifiuta", method: ["POST"], middlewares: decidere },

  { matcher: "/admin/carte-regalo", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/carte-regalo", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/carte-regalo/clienti", method: ["GET"], middlewares: [...scrivere, permesso("customers", "view")] },
  { matcher: "/admin/carte-regalo/:id", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/carte-regalo/:id", method: ["DELETE"], middlewares: decidere },
  { matcher: "/admin/carte-regalo/:id/movimenti", method: ["POST"], middlewares: decidere },
  { matcher: "/admin/carte-regalo/:id/annulla", method: ["POST"], middlewares: decidere },
  { matcher: "/admin/carte-regalo/:id/blocco", method: ["POST"], middlewares: scrivere },

  { matcher: "/vendor/sconti/prodotti", method: ["GET"], middlewares: leggere },
  { matcher: "/vendor/sconti/proposte", method: ["GET"], middlewares: leggere },
  { matcher: "/vendor/sconti/proposte", method: ["POST"], middlewares: scrivere },
  { matcher: "/vendor/sconti/proposte/:id", method: ["DELETE"], middlewares: scrivere },
]
