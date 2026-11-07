import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { enrichProductChangeRequests } from "@mercurjs/core/api/vendor/products/helpers"
import { creaProdotto } from "../../../admin/catalogo/comune/creazione"
import { elencaProdotti, STATI } from "../../../admin/catalogo/comune/prodotti"
import { CampiScheda, NuovaVariante } from "../../../admin/catalogo/comune/scheda"
import { aziendaDi, valida } from "../../../utili"
import { prodottiAzienda } from "../comune"

const Filtri = z.object({
  stato: z.enum(STATI).optional(),
  q: z.string().trim().optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

const Corpo = CampiScheda.extend({
  bozza: z.boolean().default(false),
  varianti: z.array(NuovaVariante).min(1, "Add at least one size").max(100, "Up to 100 sizes"),
})

type ConRichiesta = { id: string; change_request?: { message: string | null } | null }

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const azienda = aziendaDi(req)
  const filtri = valida(Filtri, req.query)
  const ids = await prodottiAzienda(req.scope, azienda)
  const { prodotti, offerte, totale, conteggi } = await elencaProdotti(req.scope, { ...filtri, ids, ordine: "recenti" })
  const richieste: ConRichiesta[] = prodotti.map((p) => ({ id: p.id }))
  await enrichProductChangeRequests(req.scope, richieste as never)
  const perId = new Map(richieste.map((r) => [r.id, r.change_request ?? null]))
  res.json({
    prodotti: prodotti.map((p) => {
      const proprie = (offerte.get(p.id) ?? []).filter((o) => o.azienda.id === azienda)
      return {
        id: p.id,
        titolo: p.titolo,
        stato: p.stato,
        foto: p.foto,
        categorie: p.categorie,
        taglie: p.taglie,
        scorte: proprie.reduce((somma, o) => somma + o.scorte, 0),
        prezzo_cessione: proprie[0]?.prezzo_cessione ?? null,
        prezzo_consigliato: proprie[0]?.prezzo_consigliato ?? null,
        proposta: Boolean(proprie[0]?.proposta),
        modifiche_richieste: Boolean(perId.get(p.id)),
      }
    }),
    totale,
    conteggi,
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const azienda = aziendaDi(req)
  const { bozza, varianti, ...scheda } = valida(Corpo, req.body)
  const id = await creaProdotto(req.scope, {
    scheda,
    varianti,
    stato: bozza ? "draft" : "proposed",
    aziendaId: azienda,
    autore: azienda,
    firma: req.auth_context.actor_id,
    legaSubito: false,
  })
  res.status(201).json({ prodotto: { id } })
}
