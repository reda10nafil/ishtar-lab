import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

/**
 * Tutti i ruoli hanno `assistenza: view`: la campanella resta visibile a chiunque lavori nel pannello.
 * Il filtro vero è su ogni fonte, in `admin/avvisi/fonti.ts`: chi non ha il permesso non riceve quegli avvisi.
 */
export const rotteAvvisi: RottaProtetta[] = [
  { matcher: "/admin/avvisi", method: ["GET"], middlewares: [permesso("assistenza", "view")] },
  { matcher: "/admin/avvisi/*", middlewares: [permesso("assistenza", "view")] },
  { matcher: "/vendor/avvisi", method: ["GET"], middlewares: [permesso("assistenza", "view")] },
  { matcher: "/vendor/avvisi/*", middlewares: [permesso("assistenza", "view")] },
]

aggiungiRegole([
  ["POST", /^\/(admin|vendor)\/avvisi\/letti$/, "Notifications marked as read"],
  ["POST", /^\/admin\/avvisi\/preferenze$/, "Alert preferences updated"],
])
