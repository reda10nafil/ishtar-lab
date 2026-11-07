import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { segnaLetti } from "../../../admin/avvisi/calcola"

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => segnaLetti(req, res)
