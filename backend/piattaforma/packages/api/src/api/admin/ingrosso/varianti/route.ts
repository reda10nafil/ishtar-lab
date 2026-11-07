import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { interroga } from "../../../utili"

const MASSIMO = 20

type Prodotto = {
  title: string
  variants?: { id: string; title: string; sku: string | null; prices?: { amount: number; currency_code: string }[] }[]
}

/** Articoli del catalogo per le righe dell'ordine, con il prezzo in euro se esiste. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const { data } = await interroga(req).graph({
    entity: "product",
    fields: ["title", "variants.id", "variants.title", "variants.sku", "variants.prices.amount", "variants.prices.currency_code"],
    filters: q ? ({ q } as object) : {},
    pagination: { take: MASSIMO },
  })
  const varianti = (data as unknown as Prodotto[]).flatMap((prodotto) =>
    (prodotto.variants ?? []).map((v) => {
      const prezzi = (v.prices ?? []).filter((p) => p.currency_code === "eur").map((p) => Number(p.amount))
      return { id: v.id, titolo: `${prodotto.title}, ${v.title}`, sku: v.sku, prezzo: prezzi.length ? Math.min(...prezzi) : null }
    })
  )
  res.json({ varianti })
}
