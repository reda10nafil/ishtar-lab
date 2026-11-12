import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valutaCassa } from "../../cassa/lib/contesto"
import { prodottiInVendita } from "../../cassa/lib/in-vendita"

const IN_ANTEPRIMA = 4

/** Prodotti veri in vendita per l'anteprima: prima quelli con la foto. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const prodotti = await prodottiInVendita(req.scope, await valutaCassa(req.scope))
  const conScorte = prodotti.filter((p) => p.disponibili > 0)
  const ordinati = [...conScorte].sort((a, b) => Number(Boolean(b.foto)) - Number(Boolean(a.foto)))
  res.json({
    prodotti: ordinati.slice(0, IN_ANTEPRIMA).map((p) => ({ id: p.id, titolo: p.titolo, foto: p.foto, prezzo_min: p.prezzo_min })),
    conteggio: conScorte.length,
  })
}
