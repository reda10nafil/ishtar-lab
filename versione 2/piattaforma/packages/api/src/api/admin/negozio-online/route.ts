import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valida } from "../../utili"
import { leggiStore } from "../impostazioni/lettura"
import { DatiVetrina, MASSIMO_ANNUNCIO, servizioNegozio } from "./comune"

type CittaDemo = { nome?: unknown; visitatori?: unknown }
type VisiteDemo = { citta?: CittaDemo[]; pagine?: Record<string, unknown> }

/**
 * Visitatori e viste non hanno una fonte vera: vengono dai dati fittizi in `store.metadata.demo.visite`.
 * Forma: `{ citta: [{ nome, visitatori }], pagine: { "/percorso": viste } }`. Senza dati si torna allo stato vuoto.
 */
function visiteDa(metadata: Record<string, unknown> | null) {
  const visite = (metadata?.demo as { visite?: VisiteDemo } | undefined)?.visite
  const citta = (visite?.citta ?? []).flatMap((c) => (typeof c.nome === "string" && Number.isFinite(c.visitatori) ? [{ nome: c.nome, visitatori: Number(c.visitatori) }] : []))
  if (!citta.length) return null
  const pagine = Object.fromEntries(Object.entries(visite?.pagine ?? {}).filter(([, viste]) => Number.isFinite(viste))) as Record<string, number>
  return { adesso: citta.reduce((totale, c) => totale + c.visitatori, 0), citta, pagine }
}

/** `online` resta falso finché il sito pubblico non esiste: l'interfaccia lo dice. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const servizio = servizioNegozio(req)
  const [vetrina, pagine, store] = await Promise.all([servizio.vetrina(), servizio.listPaginas({}, { order: { created_at: "ASC" }, take: 200 }), leggiStore(req.scope)])
  res.json({ vetrina, pagine, online: false, massimo_annuncio: MASSIMO_ANNUNCIO, visite: visiteDa(store.metadata) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(DatiVetrina, req.body)
  const servizio = servizioNegozio(req)
  const { id } = await servizio.vetrina()
  res.json({ vetrina: await servizio.updateVetrinas({ id, ...dati }) })
}
