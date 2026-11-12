import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { inviaRiepilogo } from "../invio-riepilogo"

/** Invia subito il riepilogo all'account che chiama: è lo stesso che parte ogni mattina. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await inviaRiepilogo(req))
}
