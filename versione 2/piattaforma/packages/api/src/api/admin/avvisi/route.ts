import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { elencoAvvisi } from "./calcola"

export const GET = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => elencoAvvisi(req, res, "admin")
