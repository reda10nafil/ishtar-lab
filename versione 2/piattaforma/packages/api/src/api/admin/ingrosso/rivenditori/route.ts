import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valida } from "../../../utili"
import { DatiRivenditore, pulisci, schedaRivenditore, servizioIngrosso } from "../comune"

const MASSIMO = 500

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const limite = Math.min(Number(req.query.limit) || MASSIMO, MASSIMO)
  const salto = Number(req.query.offset) || 0
  const [rivenditori, conteggio] = await servizioIngrosso(req).listAndCountRivenditores(q ? ({ q } as object) : {}, {
    relations: ["trattative"],
    order: { nome: "ASC" },
    take: limite,
    skip: salto,
  })
  res.json({ rivenditori: rivenditori.map((r) => schedaRivenditore(r as never)), conteggio })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = pulisci(valida(DatiRivenditore, req.body))
  const rivenditore = await servizioIngrosso(req).createRivenditores(dati as never)
  res.status(201).json({ rivenditore: schedaRivenditore(rivenditore as never) })
}
