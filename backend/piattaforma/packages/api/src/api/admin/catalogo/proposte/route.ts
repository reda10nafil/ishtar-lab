import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { valida } from "../../../utili"
import { aggiornaOfferta, leggiOfferte, type Offerta, type Proposta } from "../comune/offerte"
import { assente, vedeMargini } from "../comune/permessi"

/** La revisione spetta a ruoli con i margini; il filtro resta nel caso un ruolo cambi. */
const senzaCessione = (proposta: Proposta | null) => proposta && { prezzo_consigliato: proposta.prezzo_consigliato, proposta_il: proposta.proposta_il }

const Esito = z.object({
  prodotto_id: z.string(),
  azienda_id: z.string(),
  esito: z.enum(["approva", "rifiuta"]),
})

/** Prezzi cambiati da un'azienda su prodotti già online: restano qui finché non li decidi. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "offer", fields: ["id", "metadata"] })
  const ids = (data as { id: string; metadata: { proposta_prezzi?: unknown } | null }[]).filter((o) => o.metadata?.proposta_prezzi).map((o) => o.id)
  const offerte = ids.length ? await leggiOfferte(req.scope, { id: ids }) : []

  const gruppi = new Map<string, Offerta>()
  for (const offerta of offerte) gruppi.set(`${offerta.prodotto_id}|${offerta.azienda.id}`, offerta)
  const prodottiId = [...new Set(offerte.map((o) => o.prodotto_id).filter(Boolean))] as string[]
  const { data: prodotti } = prodottiId.length ? await query.graph({ entity: "product", fields: ["id", "title", "thumbnail"], filters: { id: prodottiId } }) : { data: [] }
  const perId = new Map((prodotti as { id: string; title: string; thumbnail: string | null }[]).map((p) => [p.id, p]))

  const conMargini = vedeMargini(req)
  res.json({
    proposte: [...gruppi.values()].map((o) => ({
      prodotto_id: o.prodotto_id,
      azienda_id: o.azienda.id,
      azienda: o.azienda.nome,
      titolo: perId.get(o.prodotto_id ?? "")?.title ?? "Product",
      foto: perId.get(o.prodotto_id ?? "")?.thumbnail ?? null,
      attuale: { prezzo_consigliato: o.prezzo_consigliato, ...(conMargini ? { prezzo_cessione: o.prezzo_cessione } : {}) },
      proposta: conMargini ? o.proposta : senzaCessione(o.proposta),
    })),
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { prodotto_id, azienda_id, esito } = valida(Esito, req.body)
  const offerte = (await leggiOfferte(req.scope, { product_id: prodotto_id, seller_id: azienda_id })).filter((o) => o.proposta)
  if (!offerte.length) throw assente("Price proposal")
  for (const offerta of offerte) {
    const accolti = esito === "approva" && offerta.proposta ? { prezzo_cessione: offerta.proposta.prezzo_cessione, prezzo_consigliato: offerta.proposta.prezzo_consigliato } : {}
    await aggiornaOfferta(req.scope, offerta, { metadata: { ...offerta.metadata, proposta_prezzi: null, ...accolti } }, req.auth_context.actor_id)
  }
  res.json({ esito })
}
