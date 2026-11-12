import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { removeUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "@medusajs/framework/zod"
import { PERMESSI_MODULE } from "../../../../modules/permessi"
import type PermessiModuleService from "../../../../modules/permessi/service"
import { RUOLO_PROPRIETARIO } from "../../../../modules/permessi/ruoli"
import { interroga, nonTrovato, rifiutato, valida } from "../../../utili"
import { cambiaAccesso } from "../cambia-accesso"

const Cambio = z.object({ ruolo: z.string().optional(), attivo: z.boolean().optional() })

async function collaboratore(req: AuthenticatedMedusaRequest) {
  if (req.params.id === req.auth_context.actor_id) throw rifiutato("You cannot change your own profile")
  const { data } = await interroga(req).graph({ entity: "user", fields: ["id", "email"], filters: { id: req.params.id } })
  if (!data[0]) throw nonTrovato("Team member")
  return data[0]
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const modifica = valida(Cambio, req.body)
  const utente = await collaboratore(req)
  res.json({ id: utente.id, ...(await cambiaAccesso(req, utente.email, modifica)) })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const utente = await collaboratore(req)
  const permessi = req.scope.resolve<PermessiModuleService>(PERMESSI_MODULE)
  const [riga] = await permessi.listRuoloCollaboratores({ email: utente.email })
  if (riga?.ruolo === RUOLO_PROPRIETARIO) throw rifiutato("The owner cannot be removed")
  await removeUserAccountWorkflow(req.scope).run({ input: { userId: utente.id } })
  if (riga) await permessi.deleteRuoloCollaboratores(riga.id)
  res.json({ id: utente.id, rimosso: true })
}
