import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { interroga, valida } from "../../../utili"
import { chiaveCoppia, leggiSchede, puoVedereMargini, vistaCatalogo, type Coppia } from "../lettura"
import { FiltriCatalogo } from "../schemi"

type Legame = { product_id: string; seller_id: string }

/**
 * Capi che si possono mettere in un outfit: ogni voce è un prodotto approvato con l'azienda che lo vende.
 * Lo stesso prodotto può avere più aziende. I prodotti senza offerta compaiono con il motivo, non si nascondono.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { q, azienda, limit, offset } = valida(FiltriCatalogo, req.query)
  const query = interroga(req)

  let prodottiAzienda: string[] | undefined
  if (azienda) {
    const [{ data: offerte }, { data: legami }] = await Promise.all([
      query.graph({ entity: "offer", fields: ["product_id"], filters: { seller_id: azienda } }),
      query.graph({ entity: "product_seller", fields: ["product_id"], filters: { seller_id: azienda } }),
    ])
    prodottiAzienda = [...new Set([...offerte, ...legami].map((r: { product_id: string }) => r.product_id))]
  }

  const { data: prodotti, metadata } =
    prodottiAzienda?.length === 0
      ? { data: [], metadata: { count: 0 } }
      : await query.graph({
          entity: "product",
          fields: ["id"],
          filters: { status: "published", ...(q ? { q } : {}), ...(prodottiAzienda ? { id: prodottiAzienda } : {}) },
          pagination: { take: limit, skip: offset, order: { title: "ASC" } },
        })
  const ids = (prodotti as { id: string }[]).map((p) => p.id)

  const [{ data: offerte }, { data: legami }, { data: aziende }] = await Promise.all([
    ids.length ? query.graph({ entity: "offer", fields: ["product_id", "seller_id"], filters: { product_id: ids } }) : { data: [] },
    ids.length ? query.graph({ entity: "product_seller", fields: ["product_id", "seller_id"], filters: { product_id: ids } }) : { data: [] },
    query.graph({ entity: "seller", fields: ["id", "name"], filters: { status: "open" } }),
  ])

  const coppie = new Map<string, Coppia>()
  for (const { product_id, seller_id } of [...offerte, ...legami] as Legame[]) {
    if (azienda && seller_id !== azienda) continue
    const coppia = { product_id, azienda_id: seller_id }
    coppie.set(chiaveCoppia(coppia), coppia)
  }

  const elenco = [...coppie.values()]
  const schede = await leggiSchede(query, elenco)
  const margini = puoVedereMargini(req)
  const ordine = new Map(ids.map((id, indice) => [id, indice]))

  res.json({
    capi: elenco
      .map((coppia) => vistaCatalogo(coppia, schede.get(chiaveCoppia(coppia)), margini))
      .sort((a, b) => (ordine.get(a.product_id) ?? 0) - (ordine.get(b.product_id) ?? 0) || a.azienda_nome.localeCompare(b.azienda_nome, "en")),
    aziende: (aziende as { id: string; name: string }[]).map((a) => ({ id: a.id, nome: a.name })).sort((a, b) => a.nome.localeCompare(b.nome, "en")),
    count: (metadata as { count?: number } | undefined)?.count ?? 0,
    offset,
    limit,
  })
}
