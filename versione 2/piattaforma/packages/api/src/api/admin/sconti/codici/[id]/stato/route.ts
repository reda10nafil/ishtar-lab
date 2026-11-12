import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { invalido, valida } from "../../../../../utili"
import { cambiaStato, leggiPromozione, scheda, statoDi } from "../../../promozioni"

const CambioStato = z.object({ attivo: z.boolean({ error: "Say whether to resume or pause the discount" }) })

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { attivo } = valida(CambioStato, req.body)
  const promozione = await leggiPromozione(req.scope, req.params.id)
  if (attivo && statoDi(promozione) === "terminato") {
    throw invalido("This discount has ended: change its end date or use limit to bring it back")
  }
  await cambiaStato(req.scope, promozione.id, attivo)
  res.json({ codice: scheda(await leggiPromozione(req.scope, promozione.id)) })
}
