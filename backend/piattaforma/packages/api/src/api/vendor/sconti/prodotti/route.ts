import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi, interroga } from "../../../utili"
import { prodottiDellAzienda } from "../../../admin/sconti/proposte/comune"

/**
 * I prodotti su cui l'azienda può proporre sconti: solo titoli, mai prezzi.
 * `/vendor/products` mostra anche quelli senza azienda: qui vale lo stesso legame controllato dalla proposta.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const ids = await prodottiDellAzienda(req.scope, aziendaDi(req))
  if (!ids.length) {
    res.json({ prodotti: [] })
    return
  }
  const { data } = await interroga(req).graph({ entity: "product", fields: ["id", "title"], filters: { id: ids } })
  res.json({ prodotti: data.map((p) => ({ id: p.id, titolo: p.title })).sort((a, b) => a.titolo.localeCompare(b.titolo, "it")) })
}
