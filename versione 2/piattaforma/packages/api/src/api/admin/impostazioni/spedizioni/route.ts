import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { valida } from "../../../utili"
import { impostazioniDi, leggiStore, metadatiCon } from "../lettura"
import { impostaSoglia, leggiOpzioni, sogliaComune, vistaOpzione } from "./tariffe"

const MASSIMO_IMPORTO = 1_000_000

/** Ogni riga della pagina si salva da sola: arriva solo il valore cambiato. */
const Regole = z.object({
  giorni_max_evasione: z
    .number({ error: "Enter the number of days" })
    .int("Days must be a whole number")
    .min(1, "At least 1 day")
    .max(60, "60 days at most")
    .nullable()
    .optional(),
  soglia_gratuita: z
    .number({ error: "The threshold must be an amount" })
    .positive("The threshold must be above zero")
    .max(MASSIMO_IMPORTO, "The threshold is too high")
    .nullable()
    .optional(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const [store, opzioni] = await Promise.all([leggiStore(req.scope), leggiOpzioni(req.scope)])
  const viste = opzioni.map(vistaOpzione)
  res.json({ regole: { ...impostazioniDi(store).spedizioni, soglia_gratuita: sogliaComune(viste) }, opzioni: viste })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { giorni_max_evasione, soglia_gratuita } = valida(Regole, req.body)
  if (giorni_max_evasione !== undefined) {
    const store = await leggiStore(req.scope)
    await updateStoresWorkflow(req.scope).run({
      input: { selector: { id: store.id }, update: { metadata: metadatiCon(store, { spedizioni: { giorni_max_evasione } }) } },
    })
  }
  if (soglia_gratuita !== undefined) await impostaSoglia(req.scope, soglia_gratuita)
  res.json({ ok: true })
}
