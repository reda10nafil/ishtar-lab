import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const RICHIESTE = "/assistenza/richieste"

/** Permessi delle rotte proprie di questa sezione. Le aziende sono limitate alle proprie richieste nella logica. */
const rottePer = (base: string): RottaProtetta[] => [
  { matcher: `${base}${RICHIESTE}`, method: ["GET"], middlewares: [permesso("assistenza", "view")] },
  { matcher: `${base}${RICHIESTE}`, method: ["POST"], middlewares: [permesso("assistenza", "edit")] },
  { matcher: `${base}${RICHIESTE}/:id`, method: ["GET"], middlewares: [permesso("assistenza", "view")] },
  { matcher: `${base}${RICHIESTE}/:id/messaggi`, method: ["POST"], middlewares: [permesso("assistenza", "edit")] },
  { matcher: `${base}${RICHIESTE}/:id/stato`, method: ["POST"], middlewares: [permesso("assistenza", "edit")] },
]

export const rotteAssistenza: RottaProtetta[] = [
  ...rottePer("/admin"),
  ...rottePer("/vendor"),
  { matcher: `/admin${RICHIESTE}/:id`, method: ["DELETE"], middlewares: [permesso("assistenza", "manage")] },
]

aggiungiRegole([
  ["POST", /^\/(admin|vendor)\/assistenza\/richieste$/, "Help request opened"],
  ["POST", /^\/(admin|vendor)\/assistenza\/richieste\/[^/]+\/messaggi$/, "Reply to a help request"],
  ["POST", /^\/(admin|vendor)\/assistenza\/richieste\/[^/]+\/stato$/, "Help request status changed"],
  ["DELETE", /^\/admin\/assistenza\/richieste\/[^/]+$/, "Help request deleted"],
])
