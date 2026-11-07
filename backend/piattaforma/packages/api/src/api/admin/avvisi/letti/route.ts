import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { segnaLetti } from "../calcola"

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => segnaLetti(req, res)
