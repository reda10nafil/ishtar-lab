import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { puo } from "../lib/contesto"
import { panoramicaAdmin } from "../lib/panoramica"

/** Overview è la prima schermata di ogni ruolo: la rotta è aperta a tutti, le parti seguono i permessi. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(
    await panoramicaAdmin(req.scope, {
      vendite: puo(req, "analisi", "orders"),
      clienti: puo(req, "orders", "customers"),
      coda: puo(req, "orders", "evasioni"),
      registro: puo(req, "registro"),
    })
  )
}
