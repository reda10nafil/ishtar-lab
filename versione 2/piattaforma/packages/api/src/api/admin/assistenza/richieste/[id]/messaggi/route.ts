import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aggiungiMessaggio, ambitoStaff } from "../../../logica"

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => aggiungiMessaggio(req, res, ambitoStaff())
