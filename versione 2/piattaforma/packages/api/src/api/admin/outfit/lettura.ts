import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { OUTFIT_MODULE } from "../../../modules/outfit"
import { arrotonda, calcolaOutfit, valutaScheda, type Riga, type Scheda, type Valutazione, type Variante } from "../../../modules/outfit/calcolo"
import type OutfitModuleService from "../../../modules/outfit/service"
import type { CaricoSconto, ModalitaPrezzo, StatoOutfit } from "../../../modules/outfit/service"
import { MedusaError } from "@medusajs/framework/utils"
import { interroga } from "../../utili"

type Query = ReturnType<typeof interroga>
type Meta = Record<string, unknown> | null | undefined

export type Coppia = { product_id: string; azienda_id: string }

export type RisultatiOutfit = { viste: number; vendite: number; incasso: number; capi_sostituiti: number; serie?: number[] }

export type RigaCapo = Coppia & {
  id: string
  alternativa_product_id: string | null
  alternativa_azienda_id: string | null
  x: number
  y: number
  larghezza: number
  livello: number
}

export type RigaOutfit = {
  id: string
  nome: string
  descrizione: string | null
  stato: StatoOutfit
  modalita_prezzo: ModalitaPrezzo
  prezzo_fisso: unknown
  sconto_a_carico: CaricoSconto
  quota_negozio: number
  pubblicato_il: Date | string | null
  created_at: Date | string
  updated_at: Date | string
  capi: RigaCapo[]
}

type OffertaLetta = {
  id: string
  seller_id: string
  product_id: string
  variant_id: string
  manage_inventory: boolean | null
  allow_backorder: boolean | null
  metadata: Meta
  prices?: { amount: number | string; currency_code: string; min_quantity: number | string | null }[]
  inventory_item_link?: {
    required_quantity: number | null
    inventory_item?: { location_levels?: { stocked_quantity: number | string | null; reserved_quantity: number | string | null }[] } | null
  }[]
}

type VarianteLetta = { id: string; title: string | null; sku: string | null; metadata: Meta; variant_rank: number | null }

type ProdottoLetto = {
  id: string
  title: string
  thumbnail: string | null
  status: string
  metadata: Meta
  variants?: VarianteLetta[]
}

const CAMPI_PRODOTTO = ["id", "title", "thumbnail", "status", "metadata", "variants.id", "variants.title", "variants.sku", "variants.metadata", "variants.variant_rank"]

const CAMPI_OFFERTA = [
  "id",
  "seller_id",
  "product_id",
  "variant_id",
  "manage_inventory",
  "allow_backorder",
  "metadata",
  "prices.amount",
  "prices.currency_code",
  "prices.min_quantity",
  "inventory_item_link.required_quantity",
  "inventory_item_link.inventory_item.location_levels.stocked_quantity",
  "inventory_item_link.inventory_item.location_levels.reserved_quantity",
]

/** Le taglie in lettere vanno in ordine di misura: l'alfabeto metterebbe M prima di S. */
const ORDINE_TAGLIE = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"]

const rangoTaglia = (titolo: string | null) => {
  const posto = ORDINE_TAGLIE.indexOf((titolo ?? "").trim().toUpperCase())
  return posto === -1 ? ORDINE_TAGLIE.length : posto
}

export const servizioOutfit = (req: AuthenticatedMedusaRequest) => req.scope.resolve<OutfitModuleService>(OUTFIT_MODULE)

export const chiaveCoppia = (coppia: Coppia) => `${coppia.product_id}|${coppia.azienda_id}`

const alternativaDi = (capo: RigaCapo): Coppia | null =>
  capo.alternativa_product_id && capo.alternativa_azienda_id
    ? { product_id: capo.alternativa_product_id, azienda_id: capo.alternativa_azienda_id }
    : null

export const coppieDi = (capo: RigaCapo): Coppia[] => {
  const alternativa = alternativaDi(capo)
  return alternativa ? [capo, alternativa] : [capo]
}

/** I margini si mostrano solo a chi ha il permesso: senza, i dati di costo non escono dal server. */
export const puoVedereMargini = (req: AuthenticatedMedusaRequest) =>
  Boolean((req as unknown as { permissions?: Record<string, string> }).permissions?.margini)

/** Gli importi sono già in euro. Il prezzo vale per il singolo capo, senza soglie di quantità. */
function prezzoInEuro(offerta: OffertaLetta): number | null {
  const importi = (offerta.prices ?? [])
    .filter((p) => p.currency_code === "eur" && Number(p.min_quantity ?? 0) <= 1)
    .map((p) => Number(p.amount))
    .filter(Number.isFinite)
  return importi.length ? Math.min(...importi) : null
}

/** Scorte libere dell'offerta, con la formula di Mercur: giacenza meno riservato, per ogni articolo legato. */
function scorteDi(offerta: OffertaLetta): number | null {
  if (offerta.manage_inventory === false) return null
  const legami = offerta.inventory_item_link ?? []
  if (!legami.length) return 0
  return Math.min(
    ...legami.map((legame) => {
      const necessari = legame.required_quantity ?? 1
      const libere = (legame.inventory_item?.location_levels ?? []).reduce(
        (totale, livello) => totale + Math.max(0, Number(livello.stocked_quantity ?? 0) - Number(livello.reserved_quantity ?? 0)),
        0
      )
      return necessari > 0 ? Math.floor(libere / necessari) : 0
    })
  )
}

const importoValido = (valore: unknown): number | null => {
  if (valore === null || valore === undefined || valore === "") return null
  const numero = Number(valore)
  return Number.isFinite(numero) && numero >= 0 ? numero : null
}

/** Il prezzo di cessione è scritto dall'azienda. Se non c'è resta `null`: nessuna stima. */
const costoDi = (...fonti: Meta[]): number | null => {
  for (const fonte of fonti) {
    const importo = importoValido(fonte?.prezzo_cessione)
    if (importo !== null) return importo
  }
  return null
}

function varianteDa(offerta: OffertaLetta, variante: VarianteLetta, prodotto: ProdottoLetto): Variante {
  const prezzo = prezzoInEuro(offerta)
  const quantita = scorteDi(offerta)
  return {
    id: variante.id,
    titolo: variante.title ?? "One size",
    sku: variante.sku,
    prezzo,
    costo: costoDi(offerta.metadata, variante.metadata, prodotto.metadata),
    quantita,
    disponibile: prezzo !== null && (quantita === null || quantita > 0 || offerta.allow_backorder === true),
  }
}

/** Fra più offerte della stessa azienda sulla stessa variante vale quella comprabile meno cara. */
const migliore = (varianti: Variante[]): Variante | undefined =>
  [...varianti].sort((a, b) => Number(b.disponibile) - Number(a.disponibile) || (a.prezzo ?? Infinity) - (b.prezzo ?? Infinity))[0]

/** Legge dal catalogo vero tutto ciò che serve per valutare un insieme di capi. */
export async function leggiSchede(query: Query, coppie: Coppia[]): Promise<Map<string, Scheda>> {
  const schede = new Map<string, Scheda>()
  const prodottiId = [...new Set(coppie.map((c) => c.product_id))]
  const aziendeId = [...new Set(coppie.map((c) => c.azienda_id))]
  if (!prodottiId.length) return schede

  const [{ data: prodotti }, { data: offerte }, { data: aziende }] = await Promise.all([
    query.graph({ entity: "product", fields: CAMPI_PRODOTTO, filters: { id: prodottiId } }),
    query.graph({ entity: "offer", fields: CAMPI_OFFERTA, filters: { product_id: prodottiId, seller_id: aziendeId } }),
    query.graph({ entity: "seller", fields: ["id", "name", "status"], filters: { id: aziendeId } }),
  ])
  const perProdotto = new Map((prodotti as unknown as ProdottoLetto[]).map((p) => [p.id, p]))
  const perAzienda = new Map((aziende as unknown as { id: string; name: string; status: string }[]).map((a) => [a.id, a]))

  for (const coppia of coppie) {
    const prodotto = perProdotto.get(coppia.product_id)
    if (!prodotto) continue
    const sueOfferte = (offerte as unknown as OffertaLetta[]).filter((o) => o.product_id === coppia.product_id && o.seller_id === coppia.azienda_id)
    const elenco = [...(prodotto.variants ?? [])].sort(
      (a, b) =>
        (a.variant_rank ?? 0) - (b.variant_rank ?? 0) ||
        rangoTaglia(a.title) - rangoTaglia(b.title) ||
        (a.title ?? "").localeCompare(b.title ?? "", "it", { numeric: true })
    )
    const varianti = elenco.flatMap((variante) => {
      const scelta = migliore(sueOfferte.filter((o) => o.variant_id === variante.id).map((o) => varianteDa(o, variante, prodotto)))
      return scelta ? [scelta] : []
    })
    const azienda = perAzienda.get(coppia.azienda_id)
    schede.set(chiaveCoppia(coppia), {
      product_id: coppia.product_id,
      azienda_id: coppia.azienda_id,
      titolo: prodotto.title,
      foto: prodotto.thumbnail,
      azienda_nome: azienda?.name ?? "Company not found",
      in_vendita: prodotto.status === "published",
      azienda_attiva: azienda?.status === "open",
      con_offerta: sueOfferte.length > 0,
      varianti,
    })
  }
  return schede
}

const vistaVariante = (variante: Variante, margini: boolean) => ({
  id: variante.id,
  titolo: variante.titolo,
  sku: variante.sku,
  prezzo: variante.prezzo,
  quantita: variante.quantita,
  disponibile: variante.disponibile,
  ...(margini ? { costo: variante.costo } : {}),
})

const vistaSorgente = (coppia: Coppia, scheda: Scheda | undefined, valutazione: Valutazione, margini: boolean) => ({
  product_id: coppia.product_id,
  azienda_id: coppia.azienda_id,
  titolo: scheda?.titolo ?? "Product no longer in the catalogue",
  foto: scheda?.foto ?? null,
  azienda_nome: scheda?.azienda_nome ?? "Company not found",
  acquistabile: valutazione.acquistabile,
  problema: valutazione.problema,
  prezzo: valutazione.prezzo,
  prezzo_varia: valutazione.prezzo_varia,
  varianti: (scheda?.varianti ?? []).map((v) => vistaVariante(v, margini)),
  ...(margini ? { costo: valutazione.costo } : {}),
})

export const vistaCatalogo = (coppia: Coppia, scheda: Scheda | undefined, margini: boolean) => vistaSorgente(coppia, scheda, valutaScheda(scheda), margini)

const impostazioniDi = (outfit: RigaOutfit) => ({
  modalita_prezzo: outfit.modalita_prezzo,
  prezzo_fisso: importoValido(outfit.prezzo_fisso),
  sconto_a_carico: outfit.sconto_a_carico,
  quota_negozio: outfit.quota_negozio,
})

const ordinati = (capi: RigaCapo[]) => [...capi].sort((a, b) => a.livello - b.livello)

function valuta(outfit: RigaOutfit, schede: Map<string, Scheda>) {
  const capi = ordinati(outfit.capi ?? [])
  const righe: Riga[] = capi.map((capo) => {
    const alternativa = alternativaDi(capo)
    return {
      titolo: schede.get(chiaveCoppia(capo))?.titolo ?? "Product no longer in the catalogue",
      principale: valutaScheda(schede.get(chiaveCoppia(capo))),
      alternativa: alternativa ? valutaScheda(schede.get(chiaveCoppia(alternativa))) : null,
      titolo_alternativa: alternativa ? (schede.get(chiaveCoppia(alternativa))?.titolo ?? "Product no longer in the catalogue") : null,
    }
  })
  return { capi, righe, calcolo: calcolaOutfit(impostazioniDi(outfit), righe) }
}

export const esitoOutfit = (outfit: RigaOutfit, schede: Map<string, Scheda>) => valuta(outfit, schede).calcolo

/** Vista per il pannello. Costi e margini ci sono solo se `margini` è vero. */
export function vistaOutfit(outfit: RigaOutfit, schede: Map<string, Scheda>, margini: boolean, risultati: RisultatiOutfit | null = null) {
  const { capi, righe, calcolo } = valuta(outfit, schede)
  return {
    id: outfit.id,
    nome: outfit.nome,
    descrizione: outfit.descrizione,
    stato: outfit.stato,
    ...impostazioniDi(outfit),
    pubblicato_il: outfit.pubblicato_il,
    created_at: outfit.created_at,
    updated_at: outfit.updated_at,
    capi: capi.map((capo, indice) => {
      const alternativa = alternativaDi(capo)
      return {
        ...vistaSorgente(capo, schede.get(chiaveCoppia(capo)), righe[indice].principale, margini),
        id: capo.id,
        x: capo.x,
        y: capo.y,
        larghezza: capo.larghezza,
        livello: capo.livello,
        in_sostituzione: calcolo.sostituzioni[indice],
        alternativa: alternativa
          ? vistaSorgente(alternativa, schede.get(chiaveCoppia(alternativa)), righe[indice].alternativa as Valutazione, margini)
          : null,
      }
    }),
    disponibilita: calcolo.disponibilita,
    prezzo: calcolo.prezzo,
    risultati,
    ...(margini ? { economia: calcolo.economia } : {}),
  }
}

export type VistaOutfit = ReturnType<typeof vistaOutfit>

/** Per l'elenco bastano foto e sintesi: taglie e scorte restano nella scheda. */
export function sintesiOutfit(vista: VistaOutfit) {
  return { ...vista, capi: vista.capi.map(({ varianti: _varianti, alternativa: _alternativa, ...capo }) => capo) }
}

/**
 * Il valore che un'azienda vede per un proprio capo: la cessione se l'ha indicata, altrimenti il prezzo
 * della sua offerta. Mai entrambi: dalla differenza ricaverebbe il margine, che resta riservato.
 */
const valoreAzienda = (costo: number | null, prezzo: number | null) => ({
  valore: costo ?? prezzo,
  valore_tipo: costo !== null ? ("cessione" as const) : ("offerta" as const),
})

/**
 * Vista per un'azienda. È costruita campo per campo, senza spargere la vista completa:
 * ciò che non è elencato qui non può uscire. Mai margini, né prezzi o nomi di altre aziende.
 */
export function vistaAzienda(outfit: RigaOutfit, schede: Map<string, Scheda>, azienda: string) {
  const { capi, righe, calcolo } = valuta(outfit, schede)

  const riga = (capo: RigaCapo, coppia: Coppia, ruolo: "capo" | "alternativa", valutazione: Valutazione, sconto: number) => {
    const scheda = schede.get(chiaveCoppia(coppia))
    return {
      id: `${capo.id}-${ruolo}`,
      ruolo,
      x: capo.x,
      y: capo.y,
      larghezza: capo.larghezza,
      livello: capo.livello,
      titolo: scheda?.titolo ?? "Product no longer in the catalogue",
      foto: scheda?.foto ?? null,
      acquistabile: valutazione.acquistabile,
      problema: valutazione.problema,
      ...valoreAzienda(valutazione.costo, valutazione.prezzo),
      sconto_a_carico: arrotonda(sconto),
      varianti: (scheda?.varianti ?? []).map((v) => ({
        id: v.id,
        titolo: v.titolo,
        sku: v.sku,
        quantita: v.quantita,
        disponibile: v.disponibile,
        ...valoreAzienda(v.costo, v.prezzo),
      })),
    }
  }

  const miei = capi.flatMap((capo, indice) => {
    const alternativa = alternativaDi(capo)
    const sostituito = calcolo.sostituzioni[indice]
    const sconto = calcolo.scontiCapo[indice]
    return [
      ...(capo.azienda_id === azienda ? [riga(capo, capo, "capo", righe[indice].principale, sostituito ? 0 : sconto)] : []),
      ...(alternativa?.azienda_id === azienda
        ? [riga(capo, alternativa, "alternativa", righe[indice].alternativa as Valutazione, sostituito ? sconto : 0)]
        : []),
    ]
  })

  const contengonoMiei = capi.filter((capo) => capo.azienda_id === azienda || capo.alternativa_azienda_id === azienda).length
  return {
    id: outfit.id,
    nome: outfit.nome,
    descrizione: outfit.descrizione,
    stato: outfit.stato,
    pubblicato_il: outfit.pubblicato_il,
    capi: miei,
    altri_capi: capi.length - contengonoMiei,
  }
}

export const contieneAzienda = (outfit: RigaOutfit, azienda: string) =>
  (outfit.capi ?? []).some((capo) => capo.azienda_id === azienda || capo.alternativa_azienda_id === azienda)

/** L'interfaccia è in inglese: il messaggio comune di `utili.ts` è ancora in italiano. */
export const outfitNonTrovato = () => new MedusaError(MedusaError.Types.NOT_FOUND, "Outfit not found")

export async function caricaOutfit(req: AuthenticatedMedusaRequest, id: string): Promise<RigaOutfit> {
  const [outfit] = await servizioOutfit(req).listOutfits({ id }, { relations: ["capi"], take: 1 })
  if (!outfit) throw outfitNonTrovato()
  return outfit as unknown as RigaOutfit
}

/**
 * Viste e vendite non hanno ancora una fonte reale: si leggono da `store.metadata.demo.outfit`, chiave l'id o il nome
 * dell'outfit, con `{ viste, vendite, incasso, capi_sostituiti, serie }`. Senza quei dati il blocco resta vuoto.
 */
export async function leggiRisultati(query: Query, outfit: RigaOutfit): Promise<RisultatiOutfit | null> {
  const { data } = await query.graph({ entity: "store", fields: ["metadata"] })
  const demo = (data[0] as { metadata?: { demo?: { outfit?: Record<string, RisultatiOutfit> } } | null } | undefined)?.metadata?.demo
  return demo?.outfit?.[outfit.id] ?? demo?.outfit?.[outfit.nome] ?? null
}

/** La risposta comune di lettura, salvataggio e cambio di stato. */
export async function rispostaOutfit(req: AuthenticatedMedusaRequest, id: string) {
  const query = interroga(req)
  const outfit = await caricaOutfit(req, id)
  const [schede, risultati] = await Promise.all([schedeDi(query, [outfit]), leggiRisultati(query, outfit)])
  return { outfit: vistaOutfit(outfit, schede, puoVedereMargini(req), risultati) }
}

/** La ricerca del pannello guarda nome, note e codici: qui anche i capi dell'outfit e i loro SKU. */
export function corrisponde(outfit: RigaOutfit, schede: Map<string, Scheda>, testo: string) {
  const cercato = testo.toLocaleLowerCase("en")
  const voci = [outfit.nome, outfit.descrizione ?? ""]
  for (const coppia of (outfit.capi ?? []).flatMap(coppieDi)) {
    const scheda = schede.get(chiaveCoppia(coppia))
    if (scheda) voci.push(scheda.titolo, ...scheda.varianti.map((v) => v.sku ?? ""))
  }
  return voci.some((voce) => voce.toLocaleLowerCase("en").includes(cercato))
}

export const schedeDi = (query: Query, outfit: RigaOutfit[]) => leggiSchede(query, outfit.flatMap((o) => (o.capi ?? []).flatMap(coppieDi)))
