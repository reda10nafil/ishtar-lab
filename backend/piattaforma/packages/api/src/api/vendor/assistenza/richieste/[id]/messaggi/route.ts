import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aggiungiMessaggio, ambitoAzienda } from "../../../../../admin/assistenza/logica"

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => aggiungiMessaggio(req, res, ambitoAzienda(req))
