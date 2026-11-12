import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invalido, valida } from "../../../../../utili"
import { Programmazione, campagnaDi, nelFuturo, servizioMarketing, soloDaInviare } from "../../../lib/campagne"
import { accoda } from "../../../lib/invio"
import { destinatariDi, leggiIscritti } from "../../../lib/pubblico"

/** L'attesa è un evento ritardato in Redis: sopravvive ai riavvii e, alla scadenza, l'invio controlla la data. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const campagna = await campagnaDi(req)
  soloDaInviare(campagna.stato)
  const { quando } = valida(Programmazione, req.body)
  const data = nelFuturo(quando)
  if (!destinatariDi(await leggiIscritti(req.scope), campagna.pubblico).length) throw invalido("Nobody in this audience has agreed to marketing emails")
  const aggiornata = await servizioMarketing(req).updateCampagnas({ id: campagna.id, stato: "programmata", programmata_il: data })
  await accoda(req.scope, campagna.id, data.getTime() - Date.now())
  res.json({ campagna: aggiornata })
}

/** Toglie la programmazione: la campagna torna bozza e l'evento in attesa, arrivando, non trova nulla da fare. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const campagna = await campagnaDi(req)
  soloDaInviare(campagna.stato)
  res.json({ campagna: await servizioMarketing(req).updateCampagnas({ id: campagna.id, stato: "bozza", programmata_il: null }) })
}
