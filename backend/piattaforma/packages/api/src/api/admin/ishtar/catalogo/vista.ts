/**
 * Campi della scheda Ishtar salvati nei metadati del prodotto: solo quelli che non hanno un'altra fonte nel database.
 * Costo, prezzo e scorte stanno nell'offerta; nome, descrizione e foto nel prodotto; lo SKU nella variante. Copiati nei
 * metadati sarebbero leggibili da chi legge i metadati, anche da `/store/products?fields=+metadata` quando il prodotto è
 * pubblicato, e invecchierebbero a ogni modifica fatta altrove.
 */
export const CAMPI_METADATI = ["category", "gender", "size", "color", "material", "demo", "status", "incoming", "reorder", "custom"] as const

type Scheda = Record<string, unknown>
const oggetto = (valore: unknown): valore is Scheda => Boolean(valore) && typeof valore === "object" && !Array.isArray(valore)

export function metadatiIshtar(scheda: Scheda, id: string) {
  return { id, ...Object.fromEntries(CAMPI_METADATI.filter((k) => k in scheda).map((k) => [k, scheda[k]])) }
}

type Prodotto = {
  id: string
  title?: string | null
  description?: string | null
  images?: Array<{ url: string }> | null
  variants?: Array<{ sku?: string | null }> | null
  metadata?: { ishtar_v1?: Scheda } | null
}
type Offerta = { prodotto_id?: string | null; prezzo?: number | null; prezzo_cessione?: number | null; scorte?: number | null } | undefined

/**
 * Scheda per il pannello. Il costo d'acquisto esce solo verso chi ha il permesso sui margini, come nel resto del
 * catalogo (`vedeMargini`), e arriva sempre dall'offerta: un costo rimasto nei metadati di un prodotto vecchio non esce.
 */
export function vistaProdotto(prodotto: Prodotto, offerta: Offerta, conMargini: boolean) {
  const vista: Scheda = {
    ...metadatiIshtar(oggetto(prodotto.metadata?.ishtar_v1) ? prodotto.metadata.ishtar_v1 : {}, prodotto.id),
    name: prodotto.title,
    description: prodotto.description ?? "",
    sku: prodotto.variants?.[0]?.sku,
    photos: prodotto.images?.map((i) => i.url) ?? [],
    price: offerta?.prezzo ?? 0,
    stock: offerta?.scorte ?? 0,
  }
  if (conMargini) vista.cost = offerta?.prezzo_cessione ?? 0
  return vista
}

/**
 * Prodotti del pannello: scheda Ishtar nei metadati e offerta dell'azienda Ishtar Lab (le offerte arrivano già filtrate
 * per azienda). Un prodotto di un'altra azienda con una chiave `ishtar_v1` nei metadati, che un fornitore può impostare,
 * non entra nel catalogo; una scheda malformata non blocca l'intero elenco.
 */
export function catalogoIshtar(prodotti: Prodotto[], offerte: NonNullable<Offerta>[], conMargini: boolean) {
  const perProdotto = new Map<string, NonNullable<Offerta>>()
  for (const o of offerte) if (o.prodotto_id && !perProdotto.has(o.prodotto_id)) perProdotto.set(o.prodotto_id, o)
  return prodotti.flatMap((p) => {
    const offerta = perProdotto.get(p.id)
    return offerta && oggetto(p.metadata?.ishtar_v1) ? [vistaProdotto(p, offerta, conMargini)] : []
  })
}

/**
 * Scheda Ishtar di un prodotto salvato prima di questa correzione, ridotta ai campi ammessi; null se non c'è niente da
 * togliere. Usata da `src/scripts/pulisci-metadati-ishtar.ts`, che scrive solo questa chiave: Medusa unisce i metadati al
 * primo livello (`mergeMetadata`), quindi le altre chiavi del prodotto restano come sono.
 */
export function ishtarPulito(metadata: Record<string, unknown> | null | undefined) {
  const scheda = metadata?.ishtar_v1
  if (!oggetto(scheda)) return null
  const ammessi = new Set<string>(["id", ...CAMPI_METADATI])
  if (Object.keys(scheda).every((k) => ammessi.has(k))) return null
  return metadatiIshtar(scheda, scheda.id as string)
}
