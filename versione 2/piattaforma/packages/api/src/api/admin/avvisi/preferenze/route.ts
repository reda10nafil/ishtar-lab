import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { ASSISTENZA_MODULE } from "../../../../modules/assistenza"
import type AssistenzaModuleService from "../../../../modules/assistenza/service"
import { invalido, valida } from "../../../utili"
import { fontiPermesse, spentePer } from "../calcola"

const Preferenze = z.object({ disattivate: z.array(z.string(), { error: "Invalid preferences" }) })

const attoreDi = (req: AuthenticatedMedusaRequest) => ({ tipo: req.auth_context.actor_type, id: req.auth_context.actor_id })

/** Le prime voci sono nello stesso ordine del pannello; le altre, proprie di Ishtar Lab, seguono. */
const IN_TESTA = ["ordini", "scorte", "resi", "recensioni", "riepilogo"]
const posto = (id: string) => (IN_TESTA.includes(id) ? IN_TESTA.indexOf(id) : IN_TESTA.length)

async function vista(req: AuthenticatedMedusaRequest) {
  const spente = await spentePer(req, attoreDi(req))
  return fontiPermesse(req, "admin")
    .sort((a, b) => posto(a.id) - posto(b.id))
    .map(({ id, etichetta, descrizione }) => ({ id, etichetta, descrizione, attiva: !spente.has(id) }))
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ fonti: await vista(req) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { disattivate } = valida(Preferenze, req.body)
  const note = new Set(fontiPermesse(req, "admin").map((f) => f.id))
  if (disattivate.some((id) => !note.has(id))) throw invalido("Unknown alert")
  await req.scope.resolve<AssistenzaModuleService>(ASSISTENZA_MODULE).salvaFontiSpente(attoreDi(req), [...new Set(disattivate)])
  res.json({ fonti: await vista(req) })
}
