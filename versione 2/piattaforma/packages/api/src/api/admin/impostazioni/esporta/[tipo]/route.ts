import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invalido } from "../../../../utili"
import { preparaTabella, TIPI, type TipoEsportazione } from "../tabelle"

/** È un POST perché così ogni esportazione, compresi i dati dei clienti, resta nel Registro. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const tipo = req.params.tipo as TipoEsportazione
  if (!TIPI.includes(tipo)) throw invalido("Unknown export type")
  res.json(await preparaTabella(req, tipo))
}
