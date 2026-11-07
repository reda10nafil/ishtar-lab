import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invalido, valida } from "../../../../utili"
import { aggiornaPromozione, codiceOccupato, controllaCodice, DatiCodice, eliminaPromozione, leggiPromozione, scheda } from "../../promozioni"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ codice: scheda(await leggiPromozione(req.scope, req.params.id)) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const attuale = await leggiPromozione(req.scope, req.params.id)
  const dati = valida(DatiCodice, req.body)
  controllaCodice(dati)
  if (await codiceOccupato(req.scope, dati.codice, attuale.id)) throw invalido("A discount with this code already exists")
  if (typeof dati.limite_usi === "number" && dati.limite_usi < attuale.used) {
    throw invalido(`The use limit can't be lower than the uses already recorded (${attuale.used})`)
  }
  if (scheda(attuale).prodotti && dati.tipo === "spedizione") throw invalido("This discount applies to specific products: it can't become free shipping")
  await aggiornaPromozione(req.scope, attuale, dati)
  res.json({ codice: scheda(await leggiPromozione(req.scope, attuale.id)) })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const promozione = await leggiPromozione(req.scope, req.params.id)
  await eliminaPromozione(req.scope, promozione)
  res.json({ id: promozione.id, eliminato: true })
}
