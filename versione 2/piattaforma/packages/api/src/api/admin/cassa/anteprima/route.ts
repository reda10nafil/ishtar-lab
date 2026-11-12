import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../utili"
import { calcolaConto } from "../lib/conto"
import { contestoCassa } from "../lib/contesto"

const VOCE = /^([^:]+):([1-9]\d{0,3})$/

const Parametri = z.object({
  riga: z.union([z.string(), z.array(z.string())]).optional(),
  codice: z.string().trim().toUpperCase().max(40).optional(),
})

const leggiRighe = (riga: string | string[] | undefined) =>
  (Array.isArray(riga) ? riga : riga ? [riga] : []).flatMap((voce) => {
    const esito = VOCE.exec(voce)
    return esito ? [{ offerta_id: esito[1], quantita: Number(esito[2]) }] : []
  })

/** È una lettura: con GET il conto non finisce nel registro delle modifiche. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { riga, codice } = valida(Parametri, req.query)
  const conto = await calcolaConto(req.scope, await contestoCassa(req.scope), leggiRighe(riga), codice || null)
  res.json({ subtotale: conto.subtotale, sconto: conto.sconto, iva: conto.iva, totale: conto.totale, codice: conto.codice })
}
