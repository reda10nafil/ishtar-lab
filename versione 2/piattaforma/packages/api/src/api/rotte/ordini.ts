import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aggiungiRegole } from "../../modules/permessi/azioni"
import { permesso, type RottaProtetta } from "./permesso"

const ID = "[^/]+"

aggiungiRegole([
  ["POST", new RegExp(`^/admin/ordini/${ID}/annulla$`), "Order cancelled"],
  ["POST", new RegExp(`^/admin/ordini/${ID}/incassa$`), "Order marked as paid"],
  ["POST", new RegExp(`^/admin/ordini/${ID}/avanza$`), "Order moved on"],
  ["POST", new RegExp(`^/admin/ordini/${ID}/note$`), "Note added to an order"],
  ["POST", /^\/admin\/ordini\/blocco$/, "Orders changed in bulk"],
  ["POST", /^\/admin\/ordini\/bozze$/, "Draft order created"],
  ["POST", new RegExp(`^/admin/ordini/bozze/${ID}/conferma$`), "Draft turned into an order"],
  ["DELETE", new RegExp(`^/admin/draft-orders/${ID}$`), "Draft order deleted"],
  ["POST", /^\/admin\/ordini\/resi$/, "Return started"],
  ["POST", new RegExp(`^/admin/ordini/resi/${ID}/approva$`), "Return approved"],
  ["POST", new RegExp(`^/admin/ordini/resi/${ID}/ricevi$`), "Return received"],
  ["POST", new RegExp(`^/admin/ordini/resi/${ID}/rimborsa$`), "Return refunded"],
  ["POST", new RegExp(`^/admin/ordini/resi/${ID}/annulla$`), "Return cancelled"],
  ["POST", /^\/admin\/return-reasons$/, "Return reason added"],
  ["DELETE", new RegExp(`^/admin/return-reasons/${ID}$`), "Return reason deleted"],
  ["POST", /^\/(admin|vendor)\/evasioni\/.+\/conferma$/, "Fulfilment request confirmed"],
  ["POST", /^\/(admin|vendor)\/evasioni\/.+\/prepara$/, "Fulfilment request packed"],
  ["POST", /^\/(admin|vendor)\/evasioni\/.+\/spedisci$/, "Fulfilment request shipped"],
  ["POST", /^\/(admin|vendor)\/evasioni\/.+\/consegna$/, "Fulfilment request delivered"],
  ["POST", /^\/(admin|vendor)\/evasioni\/.+\/riapri$/, "Fulfilment request unpacked"],
])

const CAMPI_AZIENDA = ["id", "display_id", "status", "created_at"]

const riduci = (ordine: Record<string, unknown>) => Object.fromEntries(CAMPI_AZIENDA.filter((c) => c in ordine).map((c) => [c, ordine[c]]))

/**
 * La rotta di Mercur consegna email, prezzi e pagamenti: all'azienda restano solo numero e stato.
 * Le righe e il destinatario passano da `/vendor/ordini`, che ha il suo filtro.
 */
function soloRiassunto(_req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const invia = res.json.bind(res)
  res.json = ((corpo: { orders?: Record<string, unknown>[] }) => invia(corpo?.orders ? { ...corpo, orders: corpo.orders.map(riduci) } : corpo)) as typeof res.json
  next()
}

function soloDaOrdini(_req: MedusaRequest, res: MedusaResponse) {
  res.status(403).json({ type: "not_allowed", message: "Companies read their orders from the Orders section" })
}

const vedere = [permesso("orders", "view")]
const scrivere = [permesso("orders", "edit")]
const evasioniVedere = [permesso("evasioni", "view")]
const evasioniScrivere = [permesso("evasioni", "edit")]
const resi = [permesso("orders.returns", "edit")]

/** Permessi delle rotte proprie di questa sezione. Il limite vive sul server. */
export const rotteOrdini: RottaProtetta[] = [
  { matcher: "/admin/ordini", middlewares: vedere },
  { matcher: "/admin/ordini/*", middlewares: vedere },
  { matcher: "/admin/ordini/blocco", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ordini/bozze", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ordini/bozze/opzioni", method: ["GET"], middlewares: scrivere },
  { matcher: "/admin/ordini/bozze/:id/conferma", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ordini/resi", method: ["POST"], middlewares: resi },
  { matcher: "/admin/ordini/resi/:id/:azione", method: ["POST"], middlewares: resi },
  { matcher: "/admin/ordini/resi/:id/rimborsa", method: ["POST"], middlewares: [permesso("orders.refunds", "edit")] },
  { matcher: "/admin/ordini/:id/annulla", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ordini/:id/note", method: ["POST"], middlewares: scrivere },
  { matcher: "/admin/ordini/:id/incassa", method: ["POST"], middlewares: [permesso("payments", "edit")] },
  { matcher: "/admin/ordini/:id/avanza", method: ["POST"], middlewares: evasioniScrivere },

  { matcher: "/admin/evasioni", middlewares: evasioniVedere },
  { matcher: "/admin/evasioni/*", middlewares: evasioniVedere },
  { matcher: "/admin/evasioni/*", method: ["POST"], middlewares: evasioniScrivere },

  { matcher: "/vendor/ordini", middlewares: vedere },
  { matcher: "/vendor/ordini/*", middlewares: vedere },
  { matcher: "/vendor/evasioni", middlewares: evasioniVedere },
  { matcher: "/vendor/evasioni/*", middlewares: evasioniVedere },
  { matcher: "/vendor/evasioni/*", method: ["POST"], middlewares: evasioniScrivere },

  { matcher: "/vendor/orders", method: ["GET"], middlewares: [soloRiassunto] },
  { matcher: "/vendor/orders/*", middlewares: [soloDaOrdini] },
]
