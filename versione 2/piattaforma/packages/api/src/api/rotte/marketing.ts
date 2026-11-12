import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const ID = "[^/]+"

aggiungiRegole([
  ["POST", /^\/admin\/marketing\/campagne$/, "Campaign created"],
  ["POST", new RegExp(`^/admin/marketing/campagne/${ID}$`), "Campaign edited"],
  ["DELETE", new RegExp(`^/admin/marketing/campagne/${ID}$`), "Campaign deleted"],
  ["POST", new RegExp(`^/admin/marketing/campagne/${ID}/duplica$`), "Campaign duplicated"],
  ["POST", new RegExp(`^/admin/marketing/campagne/${ID}/invia$`), "Campaign sent"],
  ["POST", new RegExp(`^/admin/marketing/campagne/${ID}/programma$`), "Campaign scheduled"],
  ["DELETE", new RegExp(`^/admin/marketing/campagne/${ID}/programma$`), "Campaign schedule removed"],
  ["POST", new RegExp(`^/admin/marketing/automazioni/${ID}$`), "Automation changed"],
])

const leggere = [permesso("marketing", "view")]
const scrivere = [permesso("marketing", "edit")]
const inviare = [permesso("marketing", "manage")]

/** Tutto ciò che scrive davvero ai clienti chiede `manage`. La disiscrizione è pubblica e firmata: non passa da qui. */
export const rotteMarketing: RottaProtetta[] = [
  { matcher: "/admin/marketing/campagne", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/marketing/campagne", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/marketing/campagne/:id", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/marketing/campagne/:id", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/marketing/campagne/:id", method: ["DELETE"], middlewares: inviare },
  { matcher: "/admin/marketing/campagne/:id/duplica", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/marketing/campagne/:id/invia", method: ["POST"], middlewares: inviare },
  { matcher: "/admin/marketing/campagne/:id/programma", method: ["POST", "DELETE"], middlewares: inviare },
  { matcher: "/admin/marketing/automazioni", method: ["GET"], middlewares: leggere },
  { matcher: "/admin/marketing/automazioni/:chiave", method: ["POST"], middlewares: inviare },
]
