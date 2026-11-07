import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { invalido, valida } from "../../utili"
import { chi, schedaCarta, servizioCarte, statoCarta } from "./comune"

const MASSIMO = 1000

const NuovaCarta = z.object({
  importo: z.number({ error: "Enter the card amount" }).positive("The amount must be more than zero").max(100000, "That amount is too high"),
  scadenza: z.string().nullable().optional(),
  destinatario_nome: z.string().trim().max(120, "That name is too long").nullable().optional(),
  destinatario_email: z.string().trim().email("That email address isn't valid").or(z.literal("")).nullable().optional(),
  nota: z.string().trim().max(500, "That note is too long").nullable().optional(),
})

/** Lo stato dipende da saldo e scadenza: si calcola qui, poi si filtra e si impagina. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const stato = typeof req.query.stato === "string" ? req.query.stato : ""
  const limite = Math.min(Number(req.query.limit) || 20, 100)
  const salto = Number(req.query.offset) || 0

  const carte = await servizioCarte(req).listCartas(q ? ({ q } as object) : {}, { order: { created_at: "DESC" }, take: MASSIMO })
  const conStato = carte.map((c) => ({ carta: c, stato: statoCarta(c) }))
  const filtrate = stato ? conStato.filter((c) => c.stato === stato) : conStato
  const conteggi = { tutte: conStato.length, attiva: 0, esaurita: 0, scaduta: 0, annullata: 0 }
  for (const voce of conStato) conteggi[voce.stato] += 1

  res.json({
    carte: filtrate.slice(salto, salto + limite).map((c) => schedaCarta(req, c.carta)),
    conteggio: filtrate.length,
    conteggi,
    saldo_attivo: conStato.filter((c) => c.stato === "attiva").reduce((somma, c) => somma + Number(c.carta.saldo), 0),
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(NuovaCarta, req.body)
  const scadenza = dati.scadenza ? new Date(dati.scadenza) : null
  if (scadenza && Number.isNaN(scadenza.getTime())) throw invalido("That expiry date isn't valid")
  if (scadenza && scadenza.getTime() <= Date.now()) throw invalido("The expiry date must be in the future")

  const carta = await servizioCarte(req).emetti(
    {
      importo_iniziale: dati.importo,
      scadenza,
      destinatario_nome: dati.destinatario_nome || null,
      destinatario_email: dati.destinatario_email || null,
      nota: dati.nota || null,
    },
    await chi(req)
  )
  res.status(201).json({ carta: schedaCarta(req, carta) })
}
