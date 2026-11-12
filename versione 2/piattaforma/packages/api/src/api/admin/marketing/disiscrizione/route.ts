import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { interroga } from "../../../utili"
import { firmaValida } from "../lib/invio"

/** Il link arriva nelle email: chi lo apre non ha un account. Lo protegge la firma nel link. */
export const AUTHENTICATE = false

const pagina = (titolo: string, corpo: string) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titolo}</title><body style="font-family:system-ui,sans-serif;max-width:440px;margin:15vh auto;padding:0 20px;line-height:1.5"><h1 style="font-size:22px">${titolo}</h1>${corpo}</body></html>`

type Parametri = { cliente?: string; firma?: string }

const valido = (req: MedusaRequest) => {
  const { cliente, firma } = req.query as Parametri
  return cliente && firma && firmaValida(req.scope, cliente, firma) ? cliente : null
}

/** Una pagina di conferma: i controlli automatici delle caselle aprono i link da soli. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { cliente, firma } = req.query as Parametri
  if (!valido(req)) return res.status(400).type("html").send(pagina("This link isn't valid", "<p>Ask the shop to take you off the list.</p>"))
  const azione = `?cliente=${encodeURIComponent(cliente as string)}&amp;firma=${encodeURIComponent(firma as string)}`
  res.type("html").send(pagina("Stop marketing emails?", `<p>You'll stop getting campaigns from this shop.</p><form method="post" action="${azione}"><button type="submit">Unsubscribe</button></form>`))
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const id = valido(req)
  if (!id) return res.status(400).type("html").send(pagina("This link isn't valid", "<p>Ask the shop to take you off the list.</p>"))
  const { data } = await interroga(req as never).graph({ entity: "customer", fields: ["id", "metadata"], filters: { id } })
  const cliente = data[0] as { id: string; metadata?: Record<string, unknown> | null } | undefined
  if (cliente) {
    const metadata = { ...cliente.metadata, newsletter: false, newsletter_data: new Date().toISOString() }
    await updateCustomersWorkflow(req.scope).run({ input: { selector: { id }, update: { metadata } } })
  }
  res.type("html").send(pagina("You're unsubscribed", "<p>You won't get any more campaigns from this shop.</p>"))
}
