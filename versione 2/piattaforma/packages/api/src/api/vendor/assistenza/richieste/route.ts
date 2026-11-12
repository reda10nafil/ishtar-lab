import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ambitoAzienda, apriRichiesta, elencoRichieste } from "../../../admin/assistenza/logica"

export const GET = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => elencoRichieste(req, res, ambitoAzienda(req))

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => apriRichiesta(req, res, ambitoAzienda(req))
