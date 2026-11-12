import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valida } from "../../../utili"
import { controllaPercorso, DatiPagina, servizioNegozio } from "../comune"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(DatiPagina, req.body)
  await controllaPercorso(req, dati.percorso)
  res.status(201).json({ pagina: await servizioNegozio(req).createPaginas(dati) })
}
