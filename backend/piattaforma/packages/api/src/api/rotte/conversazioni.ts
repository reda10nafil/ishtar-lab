import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const CONVERSAZIONI = "/admin/conversazioni"
const RISPOSTE = "/admin/risposte-rapide"

/** Casella dei clienti: leggere con view, rispondere e collegare con edit, scrivere le risposte rapide con manage. */
export const rotteConversazioni: RottaProtetta[] = [
  { matcher: CONVERSAZIONI, method: ["GET"], middlewares: [permesso("conversazioni", "view")] },
  { matcher: `${CONVERSAZIONI}/:id`, method: ["GET"], middlewares: [permesso("conversazioni", "view")] },
  { matcher: `${CONVERSAZIONI}/:id/messaggi`, method: ["POST"], middlewares: [permesso("conversazioni", "edit")] },
  { matcher: `${CONVERSAZIONI}/:id/stato`, method: ["POST"], middlewares: [permesso("conversazioni", "edit")] },
  { matcher: `${CONVERSAZIONI}/:id/letta`, method: ["POST"], middlewares: [permesso("conversazioni", "edit")] },
  { matcher: `${CONVERSAZIONI}/:id/cliente`, method: ["POST"], middlewares: [permesso("conversazioni", "edit"), permesso("customers", "view")] },
  { matcher: RISPOSTE, method: ["GET"], middlewares: [permesso("conversazioni", "view")] },
  { matcher: RISPOSTE, method: ["POST"], middlewares: [permesso("conversazioni", "manage")] },
  { matcher: `${RISPOSTE}/:id`, method: ["POST", "DELETE"], middlewares: [permesso("conversazioni", "manage")] },
]

aggiungiRegole([
  ["POST", /^\/admin\/conversazioni\/[^/]+\/messaggi$/, "Reply sent to a customer"],
  ["POST", /^\/admin\/conversazioni\/[^/]+\/stato$/, "Customer conversation opened or closed"],
  ["POST", /^\/admin\/conversazioni\/[^/]+\/cliente$/, "Customer conversation linked to a customer"],
  ["POST", /^\/admin\/risposte-rapide(\/[^/]+)?$/, "Quick reply saved"],
  ["DELETE", /^\/admin\/risposte-rapide\/[^/]+$/, "Quick reply deleted"],
])
