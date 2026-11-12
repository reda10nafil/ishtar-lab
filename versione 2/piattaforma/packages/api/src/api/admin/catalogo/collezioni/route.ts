import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { tintaDa } from "../comune/prodotti"
import { venditePerProdotto } from "../comune/vendite"

type RigaCollezione = {
  id: string
  title: string
  handle: string
  created_at: string
  metadata: { descrizione?: string | null; visibile?: boolean | null } | null
  products?: ({ id: string; title: string; thumbnail: string | null; metadata: { tinta?: number | null } | null } | null)[]
}

/** Elenco per le carte: prodotti contenuti e incasso vero degli ultimi 30 giorni. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data }, vendite] = await Promise.all([
    query.graph({
      entity: "product_collection",
      fields: ["id", "title", "handle", "created_at", "metadata", "products.id", "products.title", "products.thumbnail", "products.metadata"],
    }),
    venditePerProdotto(req.scope),
  ])
  const righe = [...(data as RigaCollezione[])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  res.json({
    collezioni: righe.map((c) => {
      const prodotti = (c.products ?? []).filter((p): p is NonNullable<typeof p> => Boolean(p))
      return {
        id: c.id,
        titolo: c.title,
        indirizzo: c.handle,
        creata_il: c.created_at,
        descrizione: c.metadata?.descrizione ?? null,
        visibile: c.metadata?.visibile !== false,
        prodotti: prodotti.map((p) => ({ id: p.id, titolo: p.title, foto: p.thumbnail, tinta: tintaDa(p.metadata) })),
        incasso: prodotti.reduce((somma, p) => somma + (vendite.get(p.id)?.incasso ?? 0), 0),
      }
    }),
  })
}
