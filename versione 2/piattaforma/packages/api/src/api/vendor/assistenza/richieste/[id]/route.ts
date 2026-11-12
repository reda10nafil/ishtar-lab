import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ambitoAzienda, dettaglioRichiesta } from "../../../../admin/assistenza/logica"

export const GET = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => dettaglioRichiesta(req, res, ambitoAzienda(req))
