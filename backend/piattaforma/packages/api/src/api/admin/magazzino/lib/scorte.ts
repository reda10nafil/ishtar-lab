import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { interroga } from "../../../utili"
import { assente } from "./assente"
import { presenti } from "./presenti"

/** Usata quando né l'articolo né l'azienda hanno una soglia propria. */
export const SOGLIA_PREDEFINITA = 5

export const STATI = ["disponibile", "esaurimento", "esaurito"] as const
export type StatoScorta = (typeof STATI)[number]
export type OrigineSoglia = "articolo" | "azienda" | "predefinita"

export type Movimento = {
  id: string
  quando: string
  chi: string
  tipo: "correzione" | "conteggio"
  prima: number
  dopo: number
  differenza: number
  motivo: string | null
  nota: string | null
}

export type Deposito = { id: string; nome: string; citta: string | null; azienda_id: string | null; azienda: string | null }

export type Riga = {
  id: string
  articolo_id: string
  deposito_id: string
  deposito: string
  azienda_id: string
  azienda: string
  sku: string | null
  prodotto: string | null
  prodotto_id: string | null
  variante: string | null
  miniatura: string | null
  giacenza: number
  riservate: number
  in_arrivo: number
  disponibili: number
  soglia: number
  origine_soglia: OrigineSoglia
  stato: StatoScorta
  ultimo_conteggio: string | null
  costo_unitario: number | null
  valore: number | null
}

/** Dati che servono al server per scrivere e che non escono nelle risposte. */
export type RigaInterna = Riga & {
  ha_livello: boolean
  movimenti: Movimento[]
  metadata_livello: Record<string, unknown>
  metadata_articolo: Record<string, unknown>
}

type Metadati = Record<string, unknown> | null | undefined
type Azienda = { id: string; name: string; metadata?: Metadati }
type Offerta = {
  seller_id?: string
  product_id?: string | null
  metadata?: Metadati
  product?: { title?: string | null; thumbnail?: string | null; metadata?: Metadati } | null
  product_variant?: { title?: string | null; metadata?: Metadati } | null
}
type Variante = { title?: string | null; metadata?: Metadati; product?: { id: string; title?: string | null; thumbnail?: string | null; metadata?: Metadati } | null }
type Livello = { id: string; location_id: string; stocked_quantity?: number; reserved_quantity?: number; incoming_quantity?: number; metadata?: Metadati }
type Articolo = {
  id: string
  sku: string | null
  title: string | null
  thumbnail: string | null
  metadata?: Metadati
  location_levels?: (Livello | null)[] | null
  offers?: (Offerta | null)[] | null
  variants?: (Variante | null)[] | null
  seller?: { id: string } | null
}
type Locazione = { id: string; name: string; address?: { city?: string | null } | null; seller?: Azienda | null }

const BLOCCO = 500

const CAMPI_ARTICOLO = [
  "id",
  "sku",
  "title",
  "thumbnail",
  "metadata",
  "location_levels.id",
  "location_levels.location_id",
  "location_levels.stocked_quantity",
  "location_levels.reserved_quantity",
  "location_levels.incoming_quantity",
  "location_levels.metadata",
  "offers.seller_id",
  "offers.product_id",
  "offers.metadata",
  "offers.product.title",
  "offers.product.thumbnail",
  "offers.product.metadata",
  "offers.product_variant.title",
  "offers.product_variant.metadata",
  "variants.title",
  "variants.metadata",
  "variants.product.id",
  "variants.product.title",
  "variants.product.thumbnail",
  "variants.product.metadata",
  "seller.id",
]

const interoPositivo = (valore: unknown): number | null =>
  typeof valore === "number" && Number.isInteger(valore) && valore >= 0 ? valore : null

/** Il costo è il prezzo di cessione scritto dall'azienda, come in Outfit Studio: se manca, niente stime. */
const costoDi = (...origini: Metadati[]): number | null => {
  for (const metadata of origini) {
    const grezzo = metadata?.prezzo_cessione
    if (grezzo === null || grezzo === undefined || grezzo === "") continue
    const costo = Number(grezzo)
    if (Number.isFinite(costo) && costo >= 0) return costo
  }
  return null
}

const statoDi = (disponibili: number, soglia: number): StatoScorta => {
  if (disponibili <= 0) return "esaurito"
  return disponibili <= soglia ? "esaurimento" : "disponibile"
}

async function leggiArticoli(req: AuthenticatedMedusaRequest): Promise<Articolo[]> {
  const query = interroga(req)
  const articoli: Articolo[] = []
  for (let skip = 0; ; skip += BLOCCO) {
    const { data } = await query.graph({
      entity: "inventory_item",
      fields: CAMPI_ARTICOLO,
      pagination: { skip, take: BLOCCO, order: { id: "ASC" } },
    })
    articoli.push(...(data as unknown as Articolo[]))
    if (data.length < BLOCCO) return articoli
  }
}

async function leggiLocazioni(req: AuthenticatedMedusaRequest): Promise<Locazione[]> {
  const { data } = await interroga(req).graph({
    entity: "stock_location",
    fields: ["id", "name", "address.city", "seller.id", "seller.name", "seller.metadata"],
  })
  return data as unknown as Locazione[]
}

function costruisciRiga(articolo: Articolo, locazione: Locazione, azienda: Azienda, livello: Livello | null): RigaInterna {
  const offerte = presenti(articolo.offers)
  const offerta = offerte.find((o) => o.seller_id === azienda.id) ?? offerte[0]
  const variante = presenti(articolo.variants)[0]
  const giacenza = Number(livello?.stocked_quantity ?? 0)
  const riservate = Number(livello?.reserved_quantity ?? 0)
  const disponibili = giacenza - riservate
  const sogliaArticolo = interoPositivo(articolo.metadata?.soglia_sicurezza)
  const sogliaAzienda = interoPositivo(azienda.metadata?.soglia_sicurezza)
  const soglia = sogliaArticolo ?? sogliaAzienda ?? SOGLIA_PREDEFINITA
  const costo = costoDi(
    offerta?.metadata,
    offerta?.product_variant?.metadata,
    variante?.metadata,
    offerta?.product?.metadata,
    variante?.product?.metadata,
    articolo.metadata
  )
  const metadataLivello = (livello?.metadata ?? {}) as Record<string, unknown>
  return {
    id: `${articolo.id}@${locazione.id}`,
    articolo_id: articolo.id,
    deposito_id: locazione.id,
    deposito: locazione.name,
    azienda_id: azienda.id,
    azienda: azienda.name,
    sku: articolo.sku,
    prodotto: offerta?.product?.title ?? variante?.product?.title ?? articolo.title,
    prodotto_id: offerta?.product_id ?? variante?.product?.id ?? null,
    variante: offerta?.product_variant?.title ?? variante?.title ?? null,
    miniatura: offerta?.product?.thumbnail ?? variante?.product?.thumbnail ?? articolo.thumbnail,
    giacenza,
    riservate,
    in_arrivo: Number(livello?.incoming_quantity ?? 0),
    disponibili,
    soglia,
    origine_soglia: sogliaArticolo !== null ? "articolo" : sogliaAzienda !== null ? "azienda" : "predefinita",
    stato: statoDi(disponibili, soglia),
    ultimo_conteggio: typeof metadataLivello.ultimo_conteggio === "string" ? metadataLivello.ultimo_conteggio : null,
    costo_unitario: costo,
    valore: costo === null ? null : costo * giacenza,
    ha_livello: Boolean(livello),
    movimenti: Array.isArray(metadataLivello.movimenti) ? (metadataLivello.movimenti as Movimento[]) : [],
    metadata_livello: metadataLivello,
    metadata_articolo: (articolo.metadata ?? {}) as Record<string, unknown>,
  }
}

const ordina = (a: Riga, b: Riga) =>
  (a.prodotto ?? "").localeCompare(b.prodotto ?? "", "it") || (a.sku ?? "").localeCompare(b.sku ?? "", "it")

/** Prima gli articoli più scarsi, come nell'elenco delle scorte basse. */
const perUrgenza = (a: Riga, b: Riga) => a.disponibili - b.disponibili || ordina(a, b)

/**
 * Una riga per ogni articolo in ogni deposito. L'azienda si ricava dal deposito, che le appartiene
 * davvero: nei dati dimostrativi il legame diretto articolo-azienda punta sempre alla stessa azienda.
 * Quel legame serve solo per un articolo nuovo, che non è ancora in nessun deposito.
 */
export async function leggiScorte(req: AuthenticatedMedusaRequest, aziendaId?: string) {
  const [articoli, locazioni] = await Promise.all([leggiArticoli(req), leggiLocazioni(req)])
  const perId = new Map(locazioni.map((l) => [l.id, l]))
  const righe: RigaInterna[] = []
  for (const articolo of articoli) {
    const livelli = presenti(articolo.location_levels)
    for (const livello of livelli) {
      const locazione = perId.get(livello.location_id)
      if (locazione?.seller && (!aziendaId || locazione.seller.id === aziendaId)) {
        righe.push(costruisciRiga(articolo, locazione, locazione.seller, livello))
      }
    }
    if (livelli.length) continue
    const proprietario = presenti(articolo.offers)[0]?.seller_id ?? articolo.seller?.id
    const locazione = locazioni.find((l) => l.seller?.id === proprietario)
    if (locazione?.seller && (!aziendaId || proprietario === aziendaId)) {
      righe.push(costruisciRiga(articolo, locazione, locazione.seller, null))
    }
  }
  const depositi: Deposito[] = locazioni
    .filter((l) => !aziendaId || l.seller?.id === aziendaId)
    .map((l) => ({ id: l.id, nome: l.name, citta: l.address?.city ?? null, azienda_id: l.seller?.id ?? null, azienda: l.seller?.name ?? null }))
  return { righe: righe.sort(ordina), depositi }
}

/** Le aziende risultano sempre senza questo permesso: esiste solo per il pannello amministratore. */
export const vedeMargini = (req: AuthenticatedMedusaRequest): boolean => {
  const diritto = (req as unknown as { permissions?: Record<string, string> }).permissions?.margini
  return diritto === "view" || diritto === "edit" || diritto === "manage"
}

export function pubblica(riga: RigaInterna, vedeValore: boolean): Riga {
  const { ha_livello: _livello, movimenti: _movimenti, metadata_livello: _ml, metadata_articolo: _ma, ...dati } = riga
  return vedeValore ? dati : { ...dati, costo_unitario: null, valore: null }
}

export const ParametriElenco = z.object({
  q: z.string().trim().max(120).optional(),
  stato: z.enum(STATI, { message: "Unknown stock status" }).optional(),
  azienda: z.string().optional(),
  deposito: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  tutte: z.enum(["0", "1"]).optional(),
})
export type Parametri = z.infer<typeof ParametriElenco>

const contiene = (testo: string | undefined, ...valori: (string | null)[]) =>
  !testo || valori.some((v) => v?.toLowerCase().includes(testo.toLowerCase()))

export const filtra = (righe: RigaInterna[], f: Partial<Parametri>) =>
  righe.filter(
    (r) =>
      (!f.azienda || r.azienda_id === f.azienda) &&
      (!f.deposito || r.deposito_id === f.deposito) &&
      (!f.stato || r.stato === f.stato) &&
      contiene(f.q, r.sku, r.prodotto, r.variante)
  )

export function riepiloga(righe: RigaInterna[], vedeValore: boolean) {
  const somma = (campo: (r: RigaInterna) => number) => righe.reduce((totale, r) => totale + campo(r), 0)
  const conCosto = righe.filter((r) => r.valore !== null)
  return {
    articoli: righe.length,
    giacenza: somma((r) => r.giacenza),
    disponibili: somma((r) => r.disponibili),
    riservate: somma((r) => r.riservate),
    in_esaurimento: righe.filter((r) => r.stato === "esaurimento").length,
    esauriti: righe.filter((r) => r.stato === "esaurito").length,
    valore: vedeValore && conCosto.length ? conCosto.reduce((totale, r) => totale + (r.valore ?? 0), 0) : null,
    senza_costo: vedeValore ? righe.length - conCosto.length : null,
  }
}

export function elenco(righe: RigaInterna[], parametri: Parametri, vedeValore: boolean) {
  const trovate = filtra(righe, parametri).sort(perUrgenza)
  const pagina = parametri.tutte === "1" ? trovate : trovate.slice(parametri.offset, parametri.offset + parametri.limit)
  return {
    righe: pagina.map((r) => pubblica(r, vedeValore)),
    conteggio: trovate.length,
    limite: parametri.limit,
    posizione: parametri.offset,
    riepilogo: riepiloga(trovate, vedeValore),
    soglia_predefinita: SOGLIA_PREDEFINITA,
    vede_valore: vedeValore,
  }
}

/** Esauriti per primi, poi gli articoli più vicini a finire. */
export function scorteBasse(righe: RigaInterna[], vedeValore: boolean) {
  const basse = righe
    .filter((r) => r.stato !== "disponibile")
    .sort(perUrgenza)
  return {
    scorte_basse: basse.map((r) => pubblica(r, vedeValore)),
    conteggio: basse.length,
    esauriti: basse.filter((r) => r.stato === "esaurito").length,
    in_esaurimento: basse.filter((r) => r.stato === "esaurimento").length,
    soglia_predefinita: SOGLIA_PREDEFINITA,
  }
}

/** Arrivano qui solo righe già filtrate per azienda: un articolo altrui risulta inesistente. */
export function righeDiArticolo(righe: RigaInterna[], articoloId: string) {
  const trovate = righe.filter((r) => r.articolo_id === articoloId)
  if (!trovate.length) throw assente("Item")
  return trovate
}

export function trovaRiga(righe: RigaInterna[], articoloId: string, depositoId: string) {
  const riga = righe.find((r) => r.articolo_id === articoloId && r.deposito_id === depositoId)
  if (!riga) throw assente("Item")
  return riga
}
