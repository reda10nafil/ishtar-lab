import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rifiutato, valida } from "../../../../utili"
import { DatiCampagna, campagnaDi, servizioMarketing, soloDaInviare } from "../../lib/campagne"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ campagna: await campagnaDi(req) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const campagna = await campagnaDi(req)
  soloDaInviare(campagna.stato)
  const dati = valida(DatiCampagna, req.body)
  res.json({ campagna: await servizioMarketing(req).updateCampagnas({ id: campagna.id, ...dati }) })
}

/** Si elimina tutto tranne ciò che sta partendo adesso: con la campagna spariscono le sue consegne. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const campagna = await campagnaDi(req)
  if (campagna.stato === "in_invio") throw rifiutato("This campaign is going out right now")
  const servizio = servizioMarketing(req)
  await servizio.deleteConsegnas({ origine: `campagna:${campagna.id}` })
  await servizio.deleteCampagnas(campagna.id)
  res.json({ id: campagna.id, eliminata: true })
}
