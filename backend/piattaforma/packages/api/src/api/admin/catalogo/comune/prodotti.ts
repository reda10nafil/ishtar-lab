import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { leggiOfferte, type Offerta } from "./offerte"

export const STATI = ["published", "draft", "proposed", "rejected"] as const

type Nome = { id: string; name: string }

type RigaProdotto = {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  handle: string
  status: string
  thumbnail: string | null
  weight: number | null
  material: string | null
  metadata: Record<string, string | null> | null
  created_at: string
  updated_at: string
  collection?: { id: string; title: string } | null
  categories?: (Nome | null)[]
  sellers?: (Nome | null)[]
  images?: { id: string; url: string; rank: number }[]
  variants?: { id: string; title: string; sku: string | null; ean: string | null; variant_rank: number | null }[]
}

const CAMPI_ELENCO = [
  "id",
  "title",
  "description",
  "status",
  "thumbnail",
  "metadata",
  "created_at",
  "updated_at",
  "collection.id",
  "collection.title",
  "categories.id",
  "categories.name",
  "sellers.id",
  "sellers.name",
  "variants.id",
  "variants.title",
  "variants.variant_rank",
]

const CAMPI_SCHEDA = [...CAMPI_ELENCO, "subtitle", "handle", "weight", "material", "images.id", "images.url", "images.rank", "variants.sku", "variants.ean"]

const ORDINI: Record<string, Record<string, "ASC" | "DESC">> = {
  recenti: { created_at: "DESC" },
  nome: { title: "ASC" },
  nome_z: { title: "DESC" },
}

export type FiltriElenco = {
  stato?: string
  categoria?: string
  azienda?: string
  collezione?: string
  q?: string
  ordine: string
  offset: number
  limit: number
  ids?: string[]
  /** Conteggi per le pillole di categoria: servono solo al catalogo dell'amministratore. */
  faccette?: boolean
}

const senzaNulli = <T,>(voci: (T | null)[] | undefined) => (voci ?? []).filter((v): v is T => v !== null)

const ordinaVarianti = <T extends { title: string; variant_rank: number | null }>(voci: T[]) =>
  [...voci].sort((a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0) || a.title.localeCompare(b.title, "en", { numeric: true }))

async function filtriProdotto(scope: MedusaContainer, f: FiltriElenco) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const filtri: Record<string, unknown> = {}
  if (f.q) filtri.q = f.q
  if (f.categoria) filtri.categories = { id: f.categoria }
  if (f.collezione) filtri.collection_id = f.collezione
  let ammessi = f.ids
  if (f.azienda) {
    const { data } = await query.graph({ entity: "product_seller", fields: ["product_id"], filters: { seller_id: f.azienda } })
    const legati = (data as { product_id: string }[]).map((l) => l.product_id)
    ammessi = ammessi ? ammessi.filter((id) => legati.includes(id)) : legati
  }
  // Un elenco vuoto significherebbe «nessun filtro»: serve un identificativo che non esiste.
  if (ammessi) filtri.id = ammessi.length ? ammessi : ["__nessuno__"]
  return filtri
}

/** Le pillole contano i prodotti con gli altri filtri attivi, ignorando la categoria scelta. */
async function faccette(scope: MedusaContainer, filtri: Record<string, unknown>, stato?: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { categories: _ignorata, ...altri } = filtri
  const senzaCategoria: Record<string, unknown> = stato ? { ...altri, status: stato } : altri
  const { data } = await query.graph({ entity: "product", fields: ["id", "categories.id", "categories.name"], filters: senzaCategoria })
  const voci = new Map<string, { id: string; nome: string; conteggio: number }>()
  for (const prodotto of data as Pick<RigaProdotto, "categories">[]) {
    for (const categoria of senzaNulli(prodotto.categories)) {
      const attuale = voci.get(categoria.id)
      voci.set(categoria.id, { id: categoria.id, nome: categoria.name, conteggio: (attuale?.conteggio ?? 0) + 1 })
    }
  }
  return { totale: data.length, voci: [...voci.values()].sort((a, b) => b.conteggio - a.conteggio || a.nome.localeCompare(b.nome, "en")) }
}

async function conteggi(scope: MedusaContainer, filtri: Record<string, unknown>) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const contaStato = async (stato: string) => {
    const filtriStato: Record<string, unknown> = { ...filtri, status: stato }
    const { metadata } = await query.graph({ entity: "product", fields: ["id"], filters: filtriStato, pagination: { take: 1, skip: 0 } })
    return [stato, metadata?.count ?? 0] as const
  }
  const voci = await Promise.all(STATI.map(contaStato))
  return { ...Object.fromEntries(voci), tutti: voci.reduce((totale, [, numero]) => totale + numero, 0) } as Record<string, number>
}

const raggruppa = (offerte: Offerta[], chiave: (o: Offerta) => string | null) => {
  const gruppi = new Map<string, Offerta[]>()
  for (const offerta of offerte) {
    const valore = chiave(offerta)
    if (valore) gruppi.set(valore, [...(gruppi.get(valore) ?? []), offerta])
  }
  return gruppi
}

function riepilogo(offerte: Offerta[]) {
  const prezzi = offerte.map((o) => o.prezzo).filter((p): p is number => p !== null)
  return {
    prezzo_min: prezzi.length ? Math.min(...prezzi) : null,
    prezzo_max: prezzi.length ? Math.max(...prezzi) : null,
    scorte: offerte.reduce((totale, o) => totale + o.scorte, 0),
  }
}

const aziendeDi = (riga: RigaProdotto, offerte: Offerta[]) => {
  const nomi = new Map<string, string>(senzaNulli(riga.sellers).map((s) => [s.id, s.name]))
  for (const offerta of offerte) nomi.set(offerta.azienda.id, offerta.azienda.nome)
  return [...nomi].map(([id, nome]) => ({ id, nome }))
}

const categorieDi = (riga: RigaProdotto) => senzaNulli(riga.categories).map((c) => ({ id: c.id, nome: c.name }))

function sintesi(riga: RigaProdotto, offerte: Offerta[]) {
  return {
    id: riga.id,
    titolo: riga.title,
    descrizione: riga.description,
    stato: riga.status,
    foto: riga.thumbnail,
    brand: riga.metadata?.brand ?? null,
    categorie: categorieDi(riga),
    collezione: riga.collection ? { id: riga.collection.id, titolo: riga.collection.title } : null,
    aziende: aziendeDi(riga, offerte),
    varianti: riga.variants?.length ?? 0,
    taglie: ordinaVarianti(riga.variants ?? []).map((v) => v.title),
    creato_il: riga.created_at,
    aggiornato_il: riga.updated_at,
    ...riepilogo(offerte),
  }
}

export async function elencaProdotti(scope: MedusaContainer, f: FiltriElenco) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const filtri = await filtriProdotto(scope, f)
  const [{ data, metadata }, conteggio] = await Promise.all([
    query.graph({
      entity: "product",
      fields: CAMPI_ELENCO,
      filters: (f.stato ? { ...filtri, status: f.stato } : filtri) as Record<string, unknown>,
      pagination: { take: f.limit, skip: f.offset, order: ORDINI[f.ordine] ?? ORDINI.recenti },
    }),
    conteggi(scope, filtri),
  ])
  const righe = data as RigaProdotto[]
  const offerte = righe.length ? await leggiOfferte(scope, { product_id: righe.map((r) => r.id) }) : []
  const perProdotto = raggruppa(offerte, (o) => o.prodotto_id)
  return {
    prodotti: righe.map((riga) => sintesi(riga, perProdotto.get(riga.id) ?? [])),
    offerte: perProdotto,
    totale: metadata?.count ?? 0,
    conteggi: conteggio,
    categorie: f.faccette ? await faccette(scope, filtri, f.stato) : null,
  }
}

export async function leggiScheda(scope: MedusaContainer, id: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: CAMPI_SCHEDA, filters: { id } })
  const riga = data[0] as RigaProdotto | undefined
  if (!riga) return null
  const [offerte, { data: modifiche }] = await Promise.all([
    leggiOfferte(scope, { product_id: id }),
    query.graph({ entity: "product_change", fields: ["id", "status", "external_note", "created_at"], filters: { product_id: id } }),
  ])
  const cronologia = [...(modifiche as { status: string; external_note: string | null; created_at: string }[])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const perVariante = raggruppa(offerte, (o) => o.variante_id)
  const metadati = riga.metadata ?? {}
  return {
    id: riga.id,
    titolo: riga.title,
    sottotitolo: riga.subtitle,
    descrizione: riga.description,
    handle: riga.handle,
    stato: riga.status,
    copertina: riga.thumbnail,
    foto: [...(riga.images ?? [])].sort((a, b) => a.rank - b.rank).map(({ id: fotoId, url }) => ({ id: fotoId, url })),
    categorie: categorieDi(riga),
    collezione: riga.collection ? { id: riga.collection.id, titolo: riga.collection.title } : null,
    aziende: aziendeDi(riga, offerte),
    peso: riga.weight === null || riga.weight === undefined ? null : Number(riga.weight),
    composizione: riga.material,
    brand: metadati.brand ?? null,
    stagione: metadati.stagione ?? null,
    genere: metadati.genere ?? null,
    cura: metadati.cura ?? null,
    seo_titolo: metadati.seo_titolo ?? null,
    seo_descrizione: metadati.seo_descrizione ?? null,
    creato_il: riga.created_at,
    aggiornato_il: riga.updated_at,
    modifiche_in_attesa: cronologia.filter((c) => c.status === "pending").length,
    ultima_nota: cronologia.find((c) => c.external_note)?.external_note ?? null,
    varianti: ordinaVarianti(riga.variants ?? []).map((v) => ({ id: v.id, titolo: v.title, sku: v.sku, ean: v.ean, offerte: perVariante.get(v.id) ?? [] })),
    ...riepilogo(offerte),
  }
}

export type Scheda = NonNullable<Awaited<ReturnType<typeof leggiScheda>>>

const margine = (o: Offerta) => {
  if (o.prezzo === null || o.prezzo_cessione === null) return { margine: null, margine_percento: null }
  const valore = o.prezzo - o.prezzo_cessione
  return { margine: valore, margine_percento: o.prezzo > 0 ? valore / o.prezzo : null }
}

function offertaPerAdmin(o: Offerta, conMargini: boolean) {
  const base = {
    id: o.id,
    azienda: o.azienda,
    sku: o.sku,
    ean: o.ean,
    prezzo: o.prezzo,
    prezzo_consigliato: o.prezzo_consigliato,
    scorte: o.scorte,
    depositi: o.livelli.length,
  }
  return conMargini ? { ...base, prezzo_cessione: o.prezzo_cessione, proposta: o.proposta, ...margine(o) } : base
}

/** Il server decide cosa parte: senza il permesso `margini` questi campi non esistono nella risposta. */
export const schedaPerAdmin = (scheda: Scheda, conMargini: boolean) => ({
  ...scheda,
  varianti: scheda.varianti.map((v) => ({ ...v, offerte: v.offerte.map((o) => offertaPerAdmin(o, conMargini)) })),
})

/** Vista dell'azienda: solo le proprie offerte, mai il prezzo di vendita né altre aziende. */
export function schedaPerAzienda(scheda: Scheda, aziendaId: string, modificheRichieste: string | null) {
  const varianti = scheda.varianti.map((v) => {
    const propria = v.offerte.find((o) => o.azienda.id === aziendaId)
    return { id: v.id, titolo: v.titolo, sku: propria?.sku ?? v.sku, ean: v.ean, quantita: propria?.scorte ?? 0 }
  })
  const prima = scheda.varianti.flatMap((v) => v.offerte).find((o) => o.azienda.id === aziendaId)
  return {
    id: scheda.id,
    titolo: scheda.titolo,
    descrizione: scheda.descrizione,
    stato: scheda.stato,
    copertina: scheda.copertina,
    foto: scheda.foto,
    categorie: scheda.categorie,
    peso: scheda.peso,
    composizione: scheda.composizione,
    brand: scheda.brand,
    stagione: scheda.stagione,
    genere: scheda.genere,
    cura: scheda.cura,
    prezzo_cessione: prima?.prezzo_cessione ?? null,
    prezzo_consigliato: prima?.prezzo_consigliato ?? null,
    proposta: prima?.proposta ?? null,
    modifiche_in_attesa: scheda.modifiche_in_attesa,
    nota: modificheRichieste ?? (scheda.stato === "rejected" ? scheda.ultima_nota : null),
    varianti,
  }
}
