import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { interroga } from "../../utili"
import { leggiImpostazioni } from "../impostazioni/lettura"
import { contestoCassa } from "./lib/contesto"
import { prodottiInVendita } from "./lib/in-vendita"
import { CANALE_CASSA } from "./lib/vendita"

const MASSIMO_ORDINI = 2000

type OrdineDelGiorno = { total: unknown; status: string; metadata: Record<string, unknown> | null }

const mezzanotte = () => {
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  return oggi
}

async function incassoDiOggi(req: AuthenticatedMedusaRequest) {
  const { data } = await interroga(req).graph({
    entity: "order",
    fields: ["total", "status", "metadata"],
    filters: { created_at: { $gte: mezzanotte() }, is_draft_order: false },
    pagination: { take: MASSIMO_ORDINI },
  })
  const vendite = (data as unknown as OrdineDelGiorno[]).filter((o) => o.metadata?.canale === CANALE_CASSA && o.status !== "canceled")
  return { vendite: vendite.length, incassato: vendite.reduce((totale, o) => totale + Number(o.total), 0) }
}

/** Quello che serve per aprire la cassa, compreso ciò che manca per vendere. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const contesto = await contestoCassa(req.scope)
  const [prodotti, oggi, impostazioni] = await Promise.all([prodottiInVendita(req.scope, contesto.valuta), incassoDiOggi(req), leggiImpostazioni(req.scope)])
  res.json({ mancanti: contesto.mancanti, prodotti, oggi, indirizzo: impostazioni.negozio.indirizzo })
}
