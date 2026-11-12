import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { valida } from "../../../../utili"
import { controllaPercorso, ModificaPagina, servizioNegozio } from "../../comune"

const assicura = async (req: AuthenticatedMedusaRequest) => {
  const [pagina] = await servizioNegozio(req).listPaginas({ id: req.params.id })
  if (!pagina) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Page not found")
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(ModificaPagina, req.body)
  await assicura(req)
  await controllaPercorso(req, dati.percorso, req.params.id)
  res.json({ pagina: await servizioNegozio(req).updatePaginas({ id: req.params.id, ...dati }) })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await assicura(req)
  await servizioNegozio(req).deletePaginas(req.params.id)
  res.json({ id: req.params.id, eliminata: true })
}
