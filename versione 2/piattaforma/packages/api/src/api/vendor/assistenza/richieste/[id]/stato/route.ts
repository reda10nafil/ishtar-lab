import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ambitoAzienda, cambiaStato } from "../../../../../admin/assistenza/logica"

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => cambiaStato(req, res, ambitoAzienda(req))
