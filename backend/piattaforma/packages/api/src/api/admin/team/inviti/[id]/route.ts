import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteInvitesWorkflow, refreshInviteTokensWorkflow } from "@medusajs/medusa/core-flows"
import { PERMESSI_MODULE } from "../../../../../modules/permessi"
import type PermessiModuleService from "../../../../../modules/permessi/service"
import { interroga, nonTrovato } from "../../../../utili"

async function invito(req: AuthenticatedMedusaRequest) {
  const { data } = await interroga(req).graph({ entity: "invite", fields: ["id", "email"], filters: { id: req.params.id } })
  if (!data[0]) throw nonTrovato("Invitation")
  return data[0]
}

/** Invia di nuovo l'email con un codice nuovo. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = await invito(req)
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
