import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invalido, valida } from "../../../../utili"
import { DatiRivenditore, pulisci, schedaRivenditore, servizioIngrosso } from "../../comune"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const rivenditore = await servizioIngrosso(req).retrieveRivenditore(req.params.id, { relations: ["trattative"] })
  res.json({ rivenditore: schedaRivenditore(rivenditore as never) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioIngrosso(req)
  await servizio.retrieveRivenditore(req.params.id)
  const dati = pulisci(valida(DatiRivenditore, req.body))
  const rivenditore = await servizio.updateRivenditores({ id: req.params.id, ...dati } as never)
  res.json({ rivenditore: schedaRivenditore(rivenditore as never) })
}

/** Le trattative sono storia commerciale: non spariscono insieme al rivenditore. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioIngrosso(req)
  const rivenditore = await servizio.retrieveRivenditore(req.params.id, { relations: ["trattative"] })
  if (rivenditore.trattative.length) throw invalido("This stockist has deals: delete them first")
  await servizio.softDeleteRivenditores(rivenditore.id)
  res.json({ id: rivenditore.id, eliminato: true })
}
