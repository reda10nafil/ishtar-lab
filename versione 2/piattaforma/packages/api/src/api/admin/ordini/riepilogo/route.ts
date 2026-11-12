import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { contaBozze } from "../lib/bozze"
import { contaAperti } from "../lib/resi"
import { STATI_APERTI } from "../lib/richieste"
import { leggiUnici } from "../lib/unico"

/** I numeri sulle schede di Orders e nella frase sotto il titolo. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const [bozze, resi, unici] = await Promise.all([contaBozze(req), contaAperti(req.scope), leggiUnici(req.scope)])
  const trenta = Date.now() - 30 * 86_400_000
  res.json({
    bozze,
    resi,
    evasioni: unici.flatMap((u) => u.richieste).filter((r) => STATI_APERTI.includes(r.stato)).length,
    ultimi_trenta: unici.filter((u) => new Date(u.creato_il).getTime() >= trenta).length,
  })
}
