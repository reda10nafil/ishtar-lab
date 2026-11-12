import { rotteCatalogo } from "../catalogo"

/** Applica alle risposte di `/store/*` gli stessi middleware registrati per il negozio online. */
function rispostaNegozio(corpo: unknown) {
  const middleware = rotteCatalogo.filter((r) => r.matcher === "/store/*").flatMap((r) => r.middlewares ?? [])
  let inviato: unknown
  const res: any = { json: (c: unknown) => { inviato = c; return res } }
  for (const m of middleware) (m as any)({}, res, () => {})
  res.json(corpo)
  return inviato as any
}

describe("negozio online: dati interni dei prodotti", () => {
  // In Mercur `metadata` è tra i campi predefiniti di GET /store/products: arriva a chiunque legga il negozio.
  const prodotto = {
    id: "prod_1",
    title: "Borsa",
    metadata: {
      genere: "Donna",
      ishtar_v1: { id: "prod_1", category: "Borse", incoming: 2, reorder: 3, custom: { fornitore: "Pelletteria X", note: "Note interne" } },
    },
  }

  it("la scheda interna Ishtar (campi personalizzati, merce in arrivo, soglie) non esce dal negozio", () => {
    const risposta = rispostaNegozio({ products: [prodotto], count: 1 })
    expect(risposta.products[0].metadata).toEqual({ genere: "Donna" })
    expect(JSON.stringify(risposta)).not.toContain("Pelletteria X")
  })

  it("restano tolte anche le chiavi riservate delle offerte", () => {
    const risposta = rispostaNegozio({ product: { ...prodotto, offers: [{ prezzo: 420, metadata: { prezzo_cessione: 180 } }] } })
    expect(JSON.stringify(risposta)).not.toContain("prezzo_cessione")
    expect(risposta.product.offers[0].prezzo).toBe(420)
  })
})
