import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ambitoStaff, dettaglioRichiesta, eliminaRichiesta } from "../../logica"

export const GET = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => dettaglioRichiesta(req, res, ambitoStaff())

export const DELETE = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => eliminaRichiesta(req, res, ambitoStaff())
