import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ambitoStaff, cambiaStato } from "../../../logica"

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => cambiaStato(req, res, ambitoStaff())
