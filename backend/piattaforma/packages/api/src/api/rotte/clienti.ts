import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const ID = "[^/]+"

aggiungiRegole([
  ["POST", /^\/admin\/clienti$/, "Customer created"],
  ["POST", /^\/admin\/clienti\/gruppi$/, "Customer group created"],
  ["POST", new RegExp(`^/admin/clienti/gruppi/${ID}/clienti$`), "Customer group members changed"],
  ["POST", new RegExp(`^/admin/clienti/gruppi/${ID}$`), "Customer group renamed"],
  ["DELETE", new RegExp(`^/admin/clienti/gruppi/${ID}$`), "Customer group deleted"],
  ["POST", new RegExp(`^/admin/clienti/${ID}/indirizzi$`), "Customer address added"],
  ["POST", new RegExp(`^/admin/clienti/${ID}/indirizzi/${ID}$`), "Customer address updated"],
  ["DELETE", new RegExp(`^/admin/clienti/${ID}/indirizzi/${ID}$`), "Customer address deleted"],
  ["POST", new RegExp(`^/admin/clienti/${ID}$`), "Customer updated"],
  ["DELETE", new RegExp(`^/admin/clienti/${ID}$`), "Customer deleted"],
])

/**
 * Solo amministratore: non esiste nessuna rotta `/vendor/clienti`.
 * I segmenti e le schede leggono `customers`; i gruppi hanno il permesso proprio di Mercur.
 */
export const rotteClienti: RottaProtetta[] = [
  { matcher: "/admin/clienti", method: ["GET"], middlewares: [permesso("customers", "view")] },
  { matcher: "/admin/clienti", method: ["POST"], middlewares: [permesso("customers", "edit")] },
  { matcher: "/admin/clienti/*", middlewares: [permesso("customers", "view")] },
  { matcher: "/admin/clienti/gruppi", method: ["GET"], middlewares: [permesso("customer_groups", "view")] },
  { matcher: "/admin/clienti/gruppi", method: ["POST"], middlewares: [permesso("customer_groups", "edit")] },
  { matcher: "/admin/clienti/gruppi/:id", method: ["GET"], middlewares: [permesso("customer_groups", "view")] },
  { matcher: "/admin/clienti/gruppi/:id", method: ["POST"], middlewares: [permesso("customer_groups", "edit")] },
  { matcher: "/admin/clienti/gruppi/:id", method: ["DELETE"], middlewares: [permesso("customer_groups", "manage")] },
  { matcher: "/admin/clienti/gruppi/:id/clienti", method: ["POST"], middlewares: [permesso("customer_groups", "edit")] },
  { matcher: "/admin/clienti/:id", method: ["POST"], middlewares: [permesso("customers", "edit")] },
  { matcher: "/admin/clienti/:id", method: ["DELETE"], middlewares: [permesso("customers", "manage")] },
  { matcher: "/admin/clienti/:id/indirizzi", method: ["POST"], middlewares: [permesso("customers", "edit")] },
  { matcher: "/admin/clienti/:id/indirizzi/:indirizzo", method: ["POST", "DELETE"], middlewares: [permesso("customers", "edit")] },
]
