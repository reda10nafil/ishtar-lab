/*
 * Ripristino esplicito di un prodotto quando il salvataggio viene annullato. La compensazione di updateProductsWorkflow
 * riporta i campi semplici (il titolo) ma non i metadati né le categorie: provato sul database, restavano quelli nuovi.
 * Prima dell'aggiornamento si fotografano i valori che il salvataggio può toccare; se un passo successivo fallisce, la
 * fotografia viene riscritta per intero.
 */

type ProdottoLetto = {
  id: string
  title?: string | null
  description?: string | null
  material?: string | null
  status?: string | null
  thumbnail?: string | null
  images?: Array<{ url: string; rank?: number | null }> | null
  categories?: Array<{ id: string }> | null
  metadata?: Record<string, unknown> | null
}

export type FotografiaProdotto = {
  id: string
  title: string | null
  description: string | null
  material: string | null
  status: string | null
  thumbnail: string | null
  images: { url: string }[]
  category_ids: string[]
  /** null = chiave assente prima del salvataggio. */
  metadata: Record<string, unknown>
}

export function fotografiaProdotto(p: ProdottoLetto, chiaviMetadati: string[]): FotografiaProdotto {
  return {
    id: p.id,
    title: p.title ?? null,
    description: p.description ?? null,
    material: p.material ?? null,
    status: p.status ?? null,
    thumbnail: p.thumbnail ?? null,
    images: [...(p.images ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map((i) => ({ url: i.url })),
    category_ids: (p.categories ?? []).map((c) => c.id),
    metadata: Object.fromEntries(chiaviMetadati.map((k) => [k, p.metadata?.[k] ?? null])),
  }
}

/** Aggiornamento che riporta il prodotto alla fotografia. Medusa unisce i metadati e toglie le chiavi impostate a "". */
export function ripristinoProdotto(f: FotografiaProdotto) {
  const { id: _id, metadata, ...campi } = f
  return { ...campi, metadata: Object.fromEntries(Object.entries(metadata).map(([k, v]) => [k, v === null || v === undefined ? "" : v])) }
}
