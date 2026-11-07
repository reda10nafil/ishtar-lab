import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ambitoStaff, apriRichiesta, elencoRichieste } from "../logica"

export const GET = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => elencoRichieste(req, res, ambitoStaff())

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => apriRichiesta(req, res, ambitoStaff())
