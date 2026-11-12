import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { elencoMovimenti } from "./movimenti"
import { leggiRiserve } from "./riserve"
import { leggiScorte, pubblica, righeDiArticolo, vedeMargini } from "./scorte"

/** Scheda di un articolo: la stessa logica serve l'amministratore e, filtrata, l'azienda. */
export async function schedaArticolo(req: AuthenticatedMedusaRequest, res: MedusaResponse, aziendaId?: string) {
  const { righe } = await leggiScorte(req, aziendaId)
  const proprie = righeDiArticolo(righe, req.params.id)
  const vedeValore = vedeMargini(req)
  const soglia = proprie[0].metadata_articolo.soglia_sicurezza
  res.json({
    livelli: proprie.map((r) => pubblica(r, vedeValore)),
    soglia_articolo: typeof soglia === "number" ? soglia : null,
    riserve: await leggiRiserve(req, proprie),
    movimenti: elencoMovimenti(proprie, { limit: 200, offset: 0, tutte: "1" }).movimenti,
    vede_valore: vedeValore,
  })
}
