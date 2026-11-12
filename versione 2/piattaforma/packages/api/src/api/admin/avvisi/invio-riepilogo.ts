import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ASSISTENZA_MODULE } from "../../../modules/assistenza"
import type AssistenzaModuleService from "../../../modules/assistenza/service"
import { avvisiAccesi, spentePer } from "./calcola"

const FONTE_RIEPILOGO = "riepilogo"
const MASSIMO_VOCI = 20

const sicuro = (testo: string) => testo.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string)

/** Email con gli avvisi non letti di un account. Se l'account l'ha spenta, o non c'è nulla, non parte. */
export async function inviaRiepilogo(req: AuthenticatedMedusaRequest) {
  const attore = { tipo: req.auth_context.actor_type, id: req.auth_context.actor_id }
  if ((await spentePer(req, attore)).has(FONTE_RIEPILOGO)) return { inviato: false, voci: 0 }

  const assistenza = req.scope.resolve<AssistenzaModuleService>(ASSISTENZA_MODULE)
  const avvisi = await avvisiAccesi(req, "admin")
  const lette = await assistenza.chiaviLette(attore, avvisi.map((a) => a.chiave))
  const voci = avvisi.filter((a) => !lette.has(a.chiave)).slice(0, MASSIMO_VOCI)
  if (!voci.length) return { inviato: false, voci: 0 }

  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "user", fields: ["email"], filters: { id: attore.id } })
  const email = data[0]?.email
  if (!email) return { inviato: false, voci: 0 }

  const righe = voci.map((v) => (v.dettaglio ? `${v.titolo}: ${v.dettaglio}` : v.titolo))
  await req.scope.resolve(Modules.NOTIFICATION).createNotifications({
    to: email,
    channel: "email",
    template: "riepilogo-avvisi",
    content: {
      subject: "Your morning digest from Ishtar Lab",
      text: `Here is what is waiting for you:\n\n${righe.map((r) => `- ${r}`).join("\n")}\n`,
      html: `<p>Here is what is waiting for you:</p><ul>${righe.map((r) => `<li>${sicuro(r)}</li>`).join("")}</ul>`,
    },
  })
  return { inviato: true, voci: voci.length }
}
