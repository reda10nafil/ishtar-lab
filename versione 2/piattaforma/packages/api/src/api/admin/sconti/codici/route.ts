import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invalido, valida } from "../../../utili"
import { codiceOccupato, controllaCodice, creaPromozione, DatiCodice, leggiPromozione, leggiPromozioni, scheda } from "../promozioni"

/** Le voci del filtro come nel pannello: Live comprende ciò che deve ancora partire. */
const GRUPPI: Record<string, string[]> = { vivi: ["attivo", "programmato"], fermi: ["in_pausa", "terminato"] }

/** Lo stato dipende da date e usi: si calcola qui, poi si filtra e si impagina. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : ""
  const stato = typeof req.query.stato === "string" ? req.query.stato : ""
  const tipo = typeof req.query.tipo === "string" ? req.query.tipo : ""
  const limite = Math.min(Number(req.query.limit) || 20, 100)
  const salto = Number(req.query.offset) || 0

  const tutte = (await leggiPromozioni(req.scope)).map(scheda)
  const trovate = tutte.filter((c) => {
    if (tipo && c.tipo !== tipo) return false
    return !q || c.codice.toLowerCase().includes(q) || c.descrizione?.toLowerCase().includes(q) || c.azienda?.toLowerCase().includes(q)
  })
  const conteggi = { tutti: trovate.length, attivo: 0, programmato: 0, in_pausa: 0, terminato: 0 }
  for (const codice of trovate) conteggi[codice.stato] += 1
  const scelti = GRUPPI[stato] ?? [stato]
  const filtrate = stato ? trovate.filter((c) => scelti.includes(c.stato)) : trovate

  res.json({ codici: filtrate.slice(salto, salto + limite), conteggio: filtrate.length, conteggi })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(DatiCodice, req.body)
  controllaCodice(dati)
  if (await codiceOccupato(req.scope, dati.codice)) throw invalido("A discount with this code already exists")
  const id = await creaPromozione(req.scope, { ...dati, attivo: dati.attivo ?? true })
  res.status(201).json({ codice: scheda(await leggiPromozione(req.scope, id)) })
}
