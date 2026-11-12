import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteInvitesWorkflow, refreshInviteTokensWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "@medusajs/framework/zod"
import { PERMESSI_MODULE } from "../../../../../modules/permessi"
import type PermessiModuleService from "../../../../../modules/permessi/service"
import { RUOLO_PROPRIETARIO } from "../../../../../modules/permessi/ruoli"
import { interroga, invalido, nonTrovato, valida } from "../../../../utili"
import { cambiaAccesso } from "../../cambia-accesso"

const Cambio = z.object({ ruolo: z.string().optional(), attivo: z.boolean().optional() })

async function invito(req: AuthenticatedMedusaRequest) {
  const { data } = await interroga(req).graph({ entity: "invite", fields: ["id", "email"], filters: { id: req.params.id } })
  if (!data[0]) throw nonTrovato("Invitation")
  return data[0]
}

/** Con `ruolo` o `attivo` cambia l'accesso dell'invitato; senza, invia di nuovo l'email con un codice nuovo. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const modifica = valida(Cambio, req.body ?? {})
  const { id, email } = await invito(req)
  if (modifica.ruolo === RUOLO_PROPRIETARIO) throw invalido("The owner role cannot be assigned by invitation")
  if (modifica.ruolo !== undefined || modifica.attivo !== undefined) {
    res.json({ id, ...(await cambiaAccesso(req, email, modifica)) })
    return
  }
  await refreshInviteTokensWorkflow(req.scope).run({ input: { invite_ids: [id] } })
  res.json({ id, inviato: true })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id, email } = await invito(req)
  await deleteInvitesWorkflow(req.scope).run({ input: { ids: [id] } })
  const permessi = req.scope.resolve<PermessiModuleService>(PERMESSI_MODULE)
  const [riga] = await permessi.listRuoloCollaboratores({ email })
  if (riga) await permessi.deleteRuoloCollaboratores(riga.id)
  res.json({ id, eliminato: true })
}
