import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invalido } from "../../../../../utili"
import { campagnaDi, servizioMarketing, soloDaInviare } from "../../../lib/campagne"
import { accoda } from "../../../lib/invio"
import { destinatariDi, leggiIscritti } from "../../../lib/pubblico"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const campagna = await campagnaDi(req)
  soloDaInviare(campagna.stato)
  const destinatari = destinatariDi(await leggiIscritti(req.scope), campagna.pubblico).length
  if (!destinatari) throw invalido("Nobody in this audience has agreed to marketing emails")
  const aggiornata = await servizioMarketing(req).updateCampagnas({ id: campagna.id, stato: "in_invio", programmata_il: null, avviata_il: new Date(), destinatari })
  await accoda(req.scope, campagna.id)
  res.status(202).json({ campagna: aggiornata })
}
