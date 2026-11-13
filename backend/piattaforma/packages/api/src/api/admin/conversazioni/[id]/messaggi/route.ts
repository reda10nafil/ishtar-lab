import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { inviaRisposta } from "../../../../../modules/conversazioni/invio"
import { valida } from "../../../../utili"
import { chi } from "../../../carte-regalo/comune"
import { vistaMessaggio } from "../../lib/elenco"
import { Risposta } from "../../lib/schemi"

/**
 * Risposta del team al cliente. `id` lo genera il pannello: rimandata con lo stesso id (doppio clic, risposta persa) non
 * parte due volte. Risponde 200 anche se la consegna non è riuscita: lo dice `stato_consegna` (fallito: si può ritentare;
 * incerto: forse arrivato, si ripete solo come risposta nuova), con il motivo.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { testo, id, ultimo_visto } = valida(Risposta, req.body)
  const autore = { id: req.auth_context.actor_id, nome: await chi(req) }
  const messaggio = await inviaRisposta(req.scope, req.params.id, { testo, id_client: id, autore, ultimo_visto })
  res.json({ messaggio: vistaMessaggio(messaggio) })
}
