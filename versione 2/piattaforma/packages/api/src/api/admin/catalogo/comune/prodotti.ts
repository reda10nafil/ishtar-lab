import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { leggiOfferte, type Offerta } from "./offerte"
import { venditePerProdotto, venditeVuote } from "./vendite"

export const STATI = ["published", "draft", "archived", "proposed", "rejected"] as const

const ARCHIVIATO = "archived"
/** Un elenco vuoto significherebbe «nessun filtro»: serve un identificativo che non esiste. */
const NESSUNO = ["__nessuno__"]

type Nome = { id: string; name: string }

/** Archivio e tinta non hanno un campo in Medusa: stanno nei metadati, come brand e stagione. */
type Metadati = Partial<Record<"brand" | "stagione" | "genere" | "cura" | "seo_titolo" | "seo_descrizione", string | null>> & {
  archiviato?: boolean | null
  tinta?: number | null
}

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
  metadata: Metadati | null
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
  "variants.sku",
  "variants.variant_rank",
]

const CAMPI_SCHEDA = [...CAMPI_ELENCO, "subtitle", "handle", "weight", "material", "images.id", "images.url", "images.rank", "variants.ean"]

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

type Filtri = Record<string, unknown> & { id?: string[] }
type PartiBozze = Record<"draft" | "archived", string[]>

const interseca = (ammessi: string[] | undefined, voci: string[]) => {
  const scelti = ammessi ? ammessi.filter((id) => voci.includes(id)) : voci
  return scelti.length ? scelti : NESSUNO
}

/** Quali prodotti può vedere la richiesta: ricerca, stato e categoria si applicano dopo. */
async function filtriBase(scope: MedusaContainer, f: FiltriElenco): Promise<Filtri> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  let ammessi = f.ids
  if (f.azienda) {
    const { data } = await query.graph({ entity: "product_seller", fields: ["product_id"], filters: { seller_id: f.azienda } })
    const legati = (data as { product_id: string }[]).map((l) => l.product_id)
    ammessi = ammessi ? ammessi.filter((id) => legati.includes(id)) : legati
  }
  return ammessi ? { id: ammessi.length ? ammessi : NESSUNO } : {}
}

/** La ricerca nativa copre nome, descrizione e codici delle varianti: la composizione si aggiunge qui. */
async function idCercati(scope: MedusaContainer, q: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const leggi = (filtri: Record<string, unknown>) => query.graph({ entity: "product", fields: ["id"], filters: filtri })
  const [testo, composizione] = await Promise.all([leggi({ q }), leggi({ material: { $ilike: `%${q}%` } })])
  return [...new Set([...testo.data, ...composizione.data].map((p: { id: string }) => p.id))]
}

/** Medusa non ha lo stato «archiviato»: è una bozza con `metadata.archiviato`, tolta dalle bozze vere. */
async function partiBozze(scope: MedusaContainer): Promise<PartiBozze> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { status: "draft" } })
  const righe = data as Pick<RigaProdotto, "id" | "metadata">[]
  return {
    draft: righe.filter((r) => !r.metadata?.archiviato).map((r) => r.id),
    archived: righe.filter((r) => r.metadata?.archiviato).map((r) => r.id),
  }
}

function conStato(filtri: Filtri, stato: string | undefined, bozze: PartiBozze): Filtri {
  if (!stato) return filtri
  if (stato === "draft" || stato === ARCHIVIATO) return { ...filtri, status: "draft", id: interseca(filtri.id, bozze[stato]) }
  return { ...filtri, status: stato }
}

/** Le pillole contano lo stato scelto, non la ricerca: restano tutte, anche a zero, e nello stesso ordine. */
async function faccette(scope: MedusaContainer, filtri: Filtri, stato?: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "status", "metadata", "categories.id", "categories.name"], filters: filtri })
  const voci = new Map<string, { id: string; nome: string; conteggio: number; peso: number }>()
  let totale = 0
  for (const prodotto of data as Pick<RigaProdotto, "status" | "metadata" | "categories">[]) {
    const conta = !stato || statoDi(prodotto) === stato ? 1 : 0
    totale += conta
    for (const categoria of senzaNulli(prodotto.categories)) {
      const attuale = voci.get(categoria.id)
      voci.set(categoria.id, { id: categoria.id, nome: categoria.name, conteggio: (attuale?.conteggio ?? 0) + conta, peso: (attuale?.peso ?? 0) + 1 })
    }
  }
  const ordinate = [...voci.values()].sort((a, b) => b.peso - a.peso || a.nome.localeCompare(b.nome, "en"))
  return { totale, voci: ordinate.map(({ peso: _peso, ...voce }) => voce) }
}

async function conteggi(scope: MedusaContainer, base: Filtri, bozze: PartiBozze) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const contaStato = async (stato: string) => {
    const { metadata } = await query.graph({ entity: "product", fields: ["id"], filters: conStato(base, stato, bozze), pagination: { take: 1, skip: 0 } })
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
    scorte_basse: offerte.some((o) => o.scorte <= o.soglia),
  }
}

const aziendeDi = (riga: RigaProdotto, offerte: Offerta[]) => {
  const nomi = new Map<string, string>(senzaNulli(riga.sellers).map((s) => [s.id, s.name]))
  for (const offerta of offerte) nomi.set(offerta.azienda.id, offerta.azienda.nome)
  return [...nomi].map(([id, nome]) => ({ id, nome }))
}

const statoDi = (riga: Pick<RigaProdotto, "status" | "metadata">) => (riga.status === "draft" && riga.metadata?.archiviato ? ARCHIVIATO : riga.status)

/** Tinta scelta per la tessera senza foto; senza scelta la console la ricava dal nome. */
export const tintaDa = (metadata: { tinta?: number | null } | null | undefined) => (typeof metadata?.tinta === "number" ? metadata.tinta : null)

const categorieDi = (riga: RigaProdotto) => senzaNulli(riga.categories).map((c) => ({ id: c.id, nome: c.name }))

function sintesi(riga: RigaProdotto, offerte: Offerta[]) {
  return {
    id: riga.id,
    titolo: riga.title,
    descrizione: riga.description,
    stato: statoDi(riga),
    foto: riga.thumbnail,
    tinta: tintaDa(riga.metadata),
    brand: riga.metadata?.brand ?? null,
    categorie: categorieDi(riga),
    collezione: riga.collection ? { id: riga.collection.id, titolo: riga.collection.title } : null,
    aziende: aziendeDi(riga, offerte),
    varianti: riga.variants?.length ?? 0,
    taglie: ordinaVarianti(riga.variants ?? []).map((v) => v.title),
    sku: ordinaVarianti(riga.variants ?? [])[0]?.sku ?? null,
    creato_il: riga.created_at,
    aggiornato_il: riga.updated_at,
    ...riepilogo(offerte),
  }
}

export async function elencaProdotti(scope: MedusaContainer, f: FiltriElenco) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const [base, bozze, cercati] = await Promise.all([filtriBase(scope, f), partiBozze(scope), f.q ? idCercati(scope, f.q) : null])
  const senzaCategoria: Filtri = f.collezione ? { ...base, collection_id: f.collezione } : base
  const scelte: Filtri = f.categoria ? { ...senzaCategoria, categories: { id: f.categoria } } : senzaCategoria
  const [{ data, metadata }, conteggio] = await Promise.all([
    query.graph({
      entity: "product",
      fields: CAMPI_ELENCO,
      filters: conStato(cercati ? { ...scelte, id: interseca(scelte.id, cercati) } : scelte, f.stato, bozze),
      pagination: { take: f.limit, skip: f.offset, order: ORDINI[f.ordine] ?? ORDINI.recenti },
    }),
    conteggi(scope, base, bozze),
  ])
  const righe = data as RigaProdotto[]
  const [offerte, vendite, categorie] = await Promise.all([
    righe.length ? leggiOfferte(scope, { product_id: righe.map((r) => r.id) }) : [],
    f.faccette ? venditePerProdotto(scope) : null,
    f.faccette ? faccette(scope, senzaCategoria, f.stato) : null,
  ])
  const perProdotto = raggruppa(offerte, (o) => o.prodotto_id)
  return {
    prodotti: righe.map((riga) => ({ ...sintesi(riga, perProdotto.get(riga.id) ?? []), venduti_30: vendite?.get(riga.id)?.pezzi ?? 0 })),
    offerte: perProdotto,
    totale: metadata?.count ?? 0,
    conteggi: conteggio,
    categorie,
  }
}

export async function leggiScheda(scope: MedusaContainer, id: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: CAMPI_SCHEDA, filters: { id } })
  const riga = data[0] as RigaProdotto | undefined
  if (!riga) return null
  const [offerte, vendite, { data: modifiche }] = await Promise.all([
    leggiOfferte(scope, { product_id: id }),
    venditePerProdotto(scope),
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
    stato: statoDi(riga),
    copertina: riga.thumbnail,
    tinta: tintaDa(metadati),
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
    vendite: vendite.get(id) ?? venditeVuote(),
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
    soglia: o.soglia,
    depositi: o.livelli.length,
  }
  return conMargini ? { ...base, prezzo_cessione: o.prezzo_cessione, proposta: o.proposta, ...margine(o) } : base
}

/** Il server decide cosa parte: senza il permesso `margini` questi campi non esistono nella risposta. */
export const schedaPerAdmin = (scheda: Scheda, conMargini: boolean) => ({
  ...scheda,
  varianti: scheda.varianti.map((v) => ({ ...v, offerte: v.offerte.map((o) => offertaPerAdmin(o, conMargini)) })),
})

/** L'archivio è una scelta del negozio: per l'azienda il prodotto resta una bozza. */
export const perAzienda = (stato: string) => (stato === ARCHIVIATO ? "draft" : stato)

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
    stato: perAzienda(scheda.stato),
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
