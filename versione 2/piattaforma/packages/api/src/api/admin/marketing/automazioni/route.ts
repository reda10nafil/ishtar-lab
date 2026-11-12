import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CHIAVI_AUTOMAZIONE } from "../../../../modules/marketing/service"
import { descriviAutomazione } from "../lib/automazioni"
import { leggiDemo } from "../../analisi/lib/demo"
import { servizioMarketing } from "../lib/campagne"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioMarketing(req)
  const [regole, consegne, demo] = await Promise.all([servizio.assicuraAutomazioni(), servizio.listConsegnas({ origine: "automazione:benvenuto" }), leggiDemo(req.scope)])
  const inviate = consegne.filter((c) => c.stato === "inviato").length
  res.json({
    guadagno: demo?.automazioni ? Object.values(demo.automazioni).reduce((s, a) => s + (a.incasso ?? 0), 0) : null,
    automazioni: [...regole].sort((a, b) => CHIAVI_AUTOMAZIONE.indexOf(a.chiave as never) - CHIAVI_AUTOMAZIONE.indexOf(b.chiave as never)).map((r) => ({ ...r, ...descriviAutomazione(r.chiave), inviate: (r.chiave === "benvenuto" ? inviate : 0) + (demo?.automazioni?.[r.chiave]?.inviate ?? 0), incasso: demo?.automazioni?.[r.chiave]?.incasso ?? null })),
  })
}
