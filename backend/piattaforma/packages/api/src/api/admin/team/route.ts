import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createInvitesWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "@medusajs/framework/zod"
import { PERMESSI_MODULE } from "../../../modules/permessi"
import type PermessiModuleService from "../../../modules/permessi/service"
import { AREE_ADMIN, RUOLI_ADMIN, RUOLO_PROPRIETARIO, livelloArea, trovaRuolo } from "../../../modules/permessi/ruoli"
import { interroga, invalido, valida } from "../../utili"

const NuovoInvito = z.object({
  email: z.string().email("Invalid email address"),
  ruolo: z.string(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const permessi = req.scope.resolve<PermessiModuleService>(PERMESSI_MODULE)
  const query = interroga(req)
  const [{ data: utenti }, { data: inviti }, assegnati] = await Promise.all([
    query.graph({ entity: "user", fields: ["id", "email", "first_name", "last_name", "created_at"] }),
    query.graph({ entity: "invite", fields: ["id", "email", "accepted", "expires_at", "created_at"] }),
    permessi.listRuoloCollaboratores({}),
  ])
  const ruoloPer = new Map(assegnati.map((r) => [r.email, r.ruolo]))
  res.json({
    io: req.auth_context.actor_id,
    ruoli: RUOLI_ADMIN.map((ruolo) => ({
      id: ruolo.id,
      etichetta: ruolo.etichetta,
      descrizione: ruolo.descrizione,
      livelli: Object.fromEntries(AREE_ADMIN.map((area) => [area.id, livelloArea(ruolo, area)])),
    })),
    aree: AREE_ADMIN.map(({ id, etichetta }) => ({ id, etichetta })),
    collaboratori: utenti.map((u) => ({ ...u, ruolo: ruoloPer.get(u.email) ?? null })),
    inviti: inviti.filter((i) => !i.accepted).map((i) => ({ ...i, ruolo: ruoloPer.get(i.email) ?? null })),
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { ruolo, ...corpo } = valida(NuovoInvito, req.body)
  const email = corpo.email.trim().toLowerCase()
  if (!trovaRuolo(RUOLI_ADMIN, ruolo)) throw invalido("Unknown role")
  if (ruolo === RUOLO_PROPRIETARIO) throw invalido("The owner role cannot be assigned by invitation")

  const query = interroga(req)
  const [{ data: utenti }, { data: inviti }] = await Promise.all([
    query.graph({ entity: "user", fields: ["id"], filters: { email } }),
    query.graph({ entity: "invite", fields: ["id"], filters: { email } }),
  ])
  if (utenti.length) throw invalido("This person is already on the team")
  if (inviti.length) throw invalido("An invitation already exists for this address")

  const permessi = req.scope.resolve<PermessiModuleService>(PERMESSI_MODULE)
  const [esistente] = await permessi.listRuoloCollaboratores({ email })
  if (esistente) await permessi.updateRuoloCollaboratores({ id: esistente.id, ruolo })
  else await permessi.createRuoloCollaboratores({ email, ruolo })

  const { result } = await createInvitesWorkflow(req.scope).run({ input: { invites: [{ email }] } })
  res.status(201).json({ invito: { id: result[0].id, email, ruolo } })
}
