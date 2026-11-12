import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { invalido, rifiutato, valida } from "../../../utili"
import { creaProdotto } from "../comune/creazione"
import { puo, vedeMargini } from "../comune/permessi"
import { elencaProdotti, STATI } from "../comune/prodotti"
import { CampiScheda, NuovaVariante } from "../comune/scheda"

const Filtri = z.object({
  stato: z.enum(STATI).optional(),
  categoria: z.string().optional(),
  azienda: z.string().optional(),
  collezione: z.string().optional(),
  q: z.string().trim().optional(),
  ordine: z.enum(["recenti", "nome", "nome_z"]).default("recenti"),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(24),
})

const Corpo = CampiScheda.extend({
  stato: z.enum(["draft", "published"]).default("draft"),
  azienda_id: z.string().nullish(),
  collezione_id: z.string().nullish(),
  seo_titolo: z.string().trim().max(200, "This search title is too long").nullish(),
  seo_descrizione: z.string().trim().max(500, "This search description is too long").nullish(),
  prezzo_vendita: z.number({ message: "Enter a valid price" }).min(0, "The price cannot be negative").nullish(),
  varianti: z.array(NuovaVariante).min(1, "Add at least one variant").max(100, "Up to 100 variants"),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { prodotti, offerte, totale, conteggi, categorie } = await elencaProdotti(req.scope, { ...valida(Filtri, req.query), faccette: true })
  const conMargini = vedeMargini(req)
  res.json({
    prodotti: prodotti.map((p) => {
      const proprie = offerte.get(p.id) ?? []
      const consigliato = proprie.find((o) => o.prezzo_consigliato !== null)?.prezzo_consigliato ?? null
      const cessione = proprie.find((o) => o.prezzo_cessione !== null)?.prezzo_cessione ?? null
      return { ...p, prezzo_consigliato: consigliato, ...(conMargini ? { prezzo_cessione: cessione } : {}) }
    }),
    totale,
    conteggi,
    categorie,
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { stato, azienda_id, prezzo_vendita, varianti, ...scheda } = valida(Corpo, req.body)
  if (scheda.prezzo_cessione != null && !vedeMargini(req)) throw rifiutato("Supply prices need the margins permission")
  if (varianti.some((v) => v.quantita) && !puo(req, "inventory_items", "edit")) throw rifiutato("You do not have permission to change stock")
  if (!azienda_id && (prezzo_vendita != null || varianti.some((v) => v.quantita))) throw invalido("Price and stock belong to a company: choose one")
  const id = await creaProdotto(req.scope, {
    scheda,
    varianti,
    stato,
    aziendaId: azienda_id,
    autore: req.auth_context.actor_id,
    firma: req.auth_context.actor_id,
    prezzoVendita: prezzo_vendita,
    legaSubito: true,
  })
  res.status(201).json({ prodotto: { id } })
}
