import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

/** Permessi delle rotte proprie di questa sezione. Il limite vive sul server. */
export const rotteImpostazioni: RottaProtetta[] = [
  { matcher: "/admin/impostazioni", method: ["GET"], middlewares: [permesso("impostazioni", "view")] },
  { matcher: "/admin/impostazioni/spedizioni", method: ["GET"], middlewares: [permesso("impostazioni", "view")] },
  { matcher: "/admin/impostazioni/esporta", method: ["GET"], middlewares: [permesso("impostazioni", "view")] },
  { matcher: "/admin/impostazioni/*", method: ["POST"], middlewares: [permesso("impostazioni", "manage")] },
  // La valuta serve a tutti per mostrare gli importi: `store: view` è nella base di ogni ruolo.
  { matcher: "/admin/impostazioni/valuta", method: ["GET"], middlewares: [permesso("store", "view")] },
  { matcher: "/vendor/impostazioni/valuta", method: ["GET"], middlewares: [permesso("store", "view")] },
]

aggiungiRegole([
  ["POST", /^\/admin\/impostazioni\/negozio$/, "Store details updated"],
  ["POST", /^\/admin\/impostazioni\/spedizioni$/, "Fulfilment deadline updated"],
  ["POST", /^\/admin\/impostazioni\/spedizioni\/opzioni\/[^/]+$/, "Shipping option updated"],
  ["POST", /^\/admin\/impostazioni\/esporta\/prodotti$/, "Products exported"],
  ["POST", /^\/admin\/impostazioni\/esporta\/aziende$/, "Companies exported"],
  ["POST", /^\/admin\/impostazioni\/esporta\/clienti$/, "Customers exported"],
])
