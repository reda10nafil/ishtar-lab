import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const ID = "[^/]+"

aggiungiRegole([
  ["POST", /^\/admin\/outfit$/, "Outfit created"],
  ["POST", new RegExp(`^/admin/outfit/${ID}$`), "Outfit updated"],
  ["DELETE", new RegExp(`^/admin/outfit/${ID}$`), "Outfit deleted"],
  ["POST", new RegExp(`^/admin/outfit/${ID}/stato$`), "Outfit status changed"],
])

/** Permessi delle rotte proprie di questa sezione. Il limite vive sul server. */
export const rotteOutfit: RottaProtetta[] = [
  { matcher: "/admin/outfit", method: ["GET"], middlewares: [permesso("outfit", "view")] },
  { matcher: "/admin/outfit", method: ["POST"], middlewares: [permesso("outfit", "edit")] },
  { matcher: "/admin/outfit/catalogo", method: ["GET"], middlewares: [permesso("outfit", "edit")] },
  { matcher: "/admin/outfit/:id", method: ["GET"], middlewares: [permesso("outfit", "view")] },
  { matcher: "/admin/outfit/:id", method: ["POST"], middlewares: [permesso("outfit", "edit")] },
  { matcher: "/admin/outfit/:id", method: ["DELETE"], middlewares: [permesso("outfit", "manage")] },
  { matcher: "/admin/outfit/:id/stato", method: ["POST"], middlewares: [permesso("outfit", "manage")] },
  { matcher: "/vendor/outfit", method: ["GET"], middlewares: [permesso("outfit", "view")] },
  { matcher: "/vendor/outfit/:id", method: ["GET"], middlewares: [permesso("outfit", "view")] },
]
