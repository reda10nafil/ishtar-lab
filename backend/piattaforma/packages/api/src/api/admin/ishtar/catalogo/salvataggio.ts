import type { z } from "@medusajs/framework/zod"
import { invalido } from "../../../utili"
import { CAMPI_MODIFICABILI, ValoreCampo } from "./schema"
import { metadatiIshtar } from "./vista"

type Livello = { voce_id: string; deposito_id: string; quantita: number }
type OffertaScorte = { livelli: Livello[]; voci_magazzino: string[] }

/**
 * Dove registrare le variazioni di scorte del pannello: la voce di magazzino e il deposito del suo livello, oppure
 * deposito null se la voce non ha ancora un livello (allora si usa il deposito dell'azienda, creato se manca). Con più
 * depositi il pannello mostra il totale e non sa a quale attribuire la variazione: si cambiano dal Magazzino.
 */
export function destinazioneScorte(offerta: OffertaScorte): { voce: string; deposito: string | null } {
  if (offerta.livelli.length > 1) throw invalido("Questo articolo ha scorte in più depositi: cambiarle dal Magazzino")
  const [livello] = offerta.livelli
  if (livello) return { voce: livello.voce_id, deposito: livello.deposito_id }
  const [voce] = offerta.voci_magazzino
  if (!voce) throw invalido("Articolo senza voce di magazzino: scorte non salvate")
  return { voce, deposito: null }
}

type Campo = { id: string; label: string; type: string; category?: string; options?: string[]; required?: boolean }
type Valori = Record<string, unknown>

const presente = (valore: unknown) => valore !== undefined && valore !== null && valore !== ""

/**
 * Controllo dei campi personalizzati. Un campo obbligatorio aggiunto dopo non deve bloccare scorte, prezzo e stato dei
 * prodotti che ancora non lo hanno: si richiede alla creazione, quando il prodotto entra nella categoria del campo o
 * quando si svuota un valore che c'era. Tipo e scelte si controllano solo sui valori nuovi o cambiati.
 * Restituisce il primo errore o null.
 */
export function controllaCampi({ campi, categoria, custom, precedente }: {
  campi: Campo[]
  categoria: string
  custom: Valori
  precedente: { categoria: string; custom: Valori } | null
}): string | null {
  for (const f of campi) {
    if (f.category && f.category !== categoria) continue
    const valore = custom[f.id]
    const prima = precedente?.custom?.[f.id]
    // Il prodotto «entra» nel campo se è nuovo o se passa nella categoria del campo; un campo valido per tutte le
    // categorie non diventa richiesto solo perché la categoria cambia.
    const entra = !precedente || (Boolean(f.category) && precedente.categoria !== categoria)
    if (f.required && !presente(valore) && (entra || presente(prima))) return `Compilare ${f.label}`
    if (!presente(valore) || (!entra && JSON.stringify(valore) === JSON.stringify(prima))) continue
    if (f.type === "number" && typeof valore !== "number") return `${f.label}: indicare un numero`
    if (f.type === "boolean" && typeof valore !== "boolean") return `${f.label}: indicare sì/no`
    if (f.type === "select" && !(f.options ?? []).includes(valore as string)) return `${f.label}: valore non valido`
  }
  return null
}

type OffertaAttuale = { prezzo: number | null; prezzo_cessione: number | null; metadata: Record<string, unknown> }

/**
 * Cosa cambia nell'offerta: null se prezzo e costo sono quelli salvati. Un prezzo o un costo assenti valgono come lo 0
 * mostrato dal pannello, così un salvataggio qualsiasi non crea un prezzo di 0 €; se cambia solo il costo i prezzi non si
 * toccano (prezzo assente nel risultato).
 */
export function modificaOfferta(offerta: OffertaAttuale, prezzo: number, costo: number): null | { prezzo?: number; metadata?: Record<string, unknown> } {
  const nuovoPrezzo = (offerta.prezzo ?? 0) !== prezzo
  const nuovoCosto = (offerta.prezzo_cessione ?? 0) !== costo
  if (!nuovoPrezzo && !nuovoCosto) return null
  // Dei metadati solo il costo: Medusa li unisce al primo livello, quindi le altre chiavi (anche cambiate intanto dalla
  // console) restano come sono.
  return { ...(nuovoPrezzo ? { prezzo } : {}), ...(nuovoCosto ? { metadata: { prezzo_cessione: costo } } : {}) }
}

type Valore = unknown
/** Vuoto e assente sono la stessa cosa (un campo personalizzato mai compilato). */
const normale = (v: Valore) => (v === undefined || v === null ? "" : v)
const uguale = (a: Valore, b: Valore) => JSON.stringify(normale(a)) === JSON.stringify(normale(b))
const leggiCampo = (scheda: Record<string, any>, campo: string) =>
  campo.startsWith("custom.") ? scheda.custom?.[campo.slice(7)] : scheda[campo]

export type Conflitto = { campo: string; attuale: Valore; tuo: Valore; tolto?: boolean }

/**
 * Modifiche parziali con il valore di partenza: si scrive solo se il valore attuale è uno di quelli da cui la modifica è
 * partita (anche il valore di un invio precedente non ancora confermato). Se è già quello nuovo non c'è niente da fare,
 * così un invio ripetuto dopo un timeout è innocuo; altrimenti qualcuno l'ha cambiato altrove ed è un conflitto.
 */
export function confrontaCampi(attuale: Record<string, any>, campi: Record<string, { prima: Valore[]; dopo: Valore }>) {
  const scrivere: Record<string, Valore> = {}
  const conflitti: Conflitto[] = []
  for (const [campo, { prima, dopo }] of Object.entries(campi)) {
    const ora = leggiCampo(attuale, campo)
    if (uguale(ora, dopo)) continue
    if (prima.some((p) => uguale(ora, p))) scrivere[campo] = dopo
    else conflitti.push({ campo, attuale: ora, tuo: dopo })
  }
  return { scrivere, conflitti }
}

/** Scheda con i valori da scrivere; i campi personalizzati si indicano come «custom.<id>». */
export function applicaCampi(attuale: Record<string, any>, scrivere: Record<string, Valore>) {
  const nuova: Record<string, any> = { ...attuale, custom: { ...(attuale.custom ?? {}) } }
  for (const [campo, valore] of Object.entries(scrivere)) {
    if (campo.startsWith("custom.")) nuova.custom[campo.slice(7)] = valore
    else nuova[campo] = valore
  }
  return nuova
}

/** Campi della scheda Ishtar nei metadati: se ne cambia uno si riscrive la scheda (vista.ts, CAMPI_METADATI). */
const NELLA_SCHEDA = new Set(["category", "gender", "size", "color", "material", "demo", "status", "custom"])
/** Chiavi di una scheda salvata prima della parte B, che lo script pulisci-metadati-ishtar.ts sposta nel magazzino. */
const IN_ATTESA_DI_SPOSTAMENTO = ["incoming", "reorder"]

type Contesto = {
  /** Scheda Ishtar salvata: le chiavi ancora da spostare nel magazzino restano finché lo script non le sposta. */
  salvata?: Record<string, unknown> | null
  /** Categorie native del prodotto fuori dal catalogo Ishtar (messe dalla console): restano al cambio di categoria. */
  categorieDaTenere?: string[]
}

/**
 * Aggiornamento del prodotto con i soli campi cambiati: un salvataggio del prezzo non riscrive titolo, stato o categoria
 * cambiati intanto dalla console. null se non cambia nulla del prodotto (solo prezzo, costo o scorte). `cambiati` usa i
 * nomi del pannello, con «custom» per qualunque campo personalizzato; `nuova` è la scheda attuale con i valori nuovi.
 */
export function aggiornamentoProdotto(cambiati: Set<string>, nuova: Record<string, any>, categoriaId: string | null, id: string, contesto: Contesto = {}) {
  const u: Record<string, unknown> = {}
  if (cambiati.has("name")) u.title = nuova.name
  if (cambiati.has("description")) u.description = nuova.description
  if (cambiati.has("material")) u.material = nuova.material
  if (cambiati.has("status")) u.status = nuova.status === "active" ? "published" : "draft"
  if (cambiati.has("category")) u.category_ids = [categoriaId, ...(contesto.categorieDaTenere ?? [])]
  if (cambiati.has("photos")) {
    u.images = (nuova.photos as string[]).map((url) => ({ url }))
    u.thumbnail = nuova.photos[0] ?? null
  }
  // Metadati: solo le chiavi del pannello; Medusa le unisce alle altre (mergeMetadata), che restano come sono.
  const metadata: Record<string, unknown> = {}
  if ([...cambiati].some((k) => NELLA_SCHEDA.has(k))) {
    const salvata = contesto.salvata ?? {}
    const daSpostare = Object.fromEntries(IN_ATTESA_DI_SPOSTAMENTO.filter((k) => k in salvata).map((k) => [k, salvata[k]]))
    metadata.ishtar_v1 = { ...daSpostare, ...metadatiIshtar(nuova, id) }
  }
  if (cambiati.has("gender")) metadata.genere = nuova.gender
  if (Object.keys(metadata).length) u.metadata = metadata
  return Object.keys(u).length ? u : null
}

/** Soggetto e verbo concordati, per un messaggio che si legge come una frase. */
const ETICHETTE: Record<string, [string, string]> = {
  name: ["il nome", "è stato cambiato"],
  description: ["la descrizione", "è stata cambiata"],
  category: ["la categoria", "è stata cambiata"],
  gender: ["la destinazione", "è stata cambiata"],
  size: ["la taglia", "è stata cambiata"],
  color: ["il colore", "è stato cambiato"],
  material: ["il materiale", "è stato cambiato"],
  price: ["il prezzo", "è stato cambiato"],
  cost: ["il costo", "è stato cambiato"],
  status: ["lo stato", "è stato cambiato"],
  photos: ["le foto", "sono state cambiate"],
  demo: ["il segno «dati dimostrativi»", "è stato cambiato"],
  stock: ["le scorte", "sono state cambiate"],
  incoming: ["le unità in arrivo", "sono state cambiate"],
}
const STATI: Record<string, string> = { active: "attivo", draft: "bozza", archived: "archiviato" }

function etichetta(campo: string, personalizzati: { id: string; label: string }[], tolto = false): [string, string] {
  if (tolto) return [`il campo «${campo.slice(7)}»`, "è stato tolto dai campi personalizzati"]
  if (!campo.startsWith("custom.")) return ETICHETTE[campo] ?? [`il campo ${campo}`, "è stato cambiato"]
  const id = campo.slice(7)
  return [`il campo «${personalizzati.find((f) => f.id === id)?.label ?? id}»`, "è stato cambiato"]
}

/** Valore attuale da mostrare: niente per testi lunghi ed elenchi (foto), che nel messaggio non si leggerebbero. */
function leggibile(campo: string, valore: Valore): string | null {
  if (valore === undefined || valore === null || valore === "") return "vuoto"
  if (campo === "status" && typeof valore === "string") return STATI[valore] ?? valore
  if (typeof valore === "boolean") return valore ? "sì" : "no"
  if (typeof valore === "number") return String(valore)
  if (typeof valore === "string" && valore.length <= 60) return valore
  return null
}

/** Messaggio per chi salva: il primo conflitto per esteso, con il valore attuale, e gli altri campi elencati. */
export function messaggioConflitto(conflitti: Conflitto[], personalizzati: { id: string; label: string }[]) {
  const [primo, ...altri] = conflitti
  const [soggetto, verbo] = etichetta(primo.campo, personalizzati, primo.tolto)
  const ora = primo.tolto ? null : leggibile(primo.campo, primo.attuale)
  const resto = altri.length ? ` Cambiati altrove anche: ${altri.map((c) => etichetta(c.campo, personalizzati, c.tolto)[0]).join(", ")}.` : ""
  return `Modifica non salvata: ${soggetto} ${verbo}${primo.tolto ? "" : " altrove"}${ora === null ? "" : ` (ora ${ora})`}.${resto}`
}

type Configurazione = { categories: { id: string; name: string }[]; fields?: Campo[] }

/**
 * Prepara una modifica del pannello sulla scheda attuale (letta sotto il lucchetto del prodotto): controlla campi e
 * valori, confronta ogni campo con il valore da cui il pannello è partito e decide cosa scrivere nel prodotto e
 * nell'offerta. Con un conflitto non si scrive niente, nemmeno i campi che non ne hanno: la modifica è una sola.
 */
export function preparaModifica(
  attuale: Record<string, any>,
  campi: Record<string, { prima: unknown[]; dopo: unknown }>,
  config: Configurazione,
  offerta: OffertaAttuale,
  id: string,
  contesto: Contesto = {}
) {
  const definiti = config.fields ?? []
  const controllati: Record<string, { prima: unknown[]; dopo: unknown }> = {}
  // Campo personalizzato tolto altrove dalla configurazione mentre il pannello lo mostrava: è un conflitto (il pannello
  // ricarica catalogo e campi), non un dato sbagliato.
  const tolti: Conflitto[] = []
  for (const [campo, { prima, dopo }] of Object.entries(campi)) {
    if (campo.startsWith("custom.")) {
      if (!definiti.some((f) => f.id === campo.slice(7))) {
        tolti.push({ campo, attuale: attuale.custom?.[campo.slice(7)], tuo: dopo, tolto: true })
        continue
      }
    } else if (!Object.prototype.hasOwnProperty.call(CAMPI_MODIFICABILI, campo)) throw invalido(`Campo non modificabile dal pannello: ${campo}`)
    const schema: z.ZodTypeAny = campo.startsWith("custom.") ? ValoreCampo : (CAMPI_MODIFICABILI as Record<string, z.ZodTypeAny>)[campo]
    const esito = schema.safeParse(dopo)
    if (!esito.success) throw invalido(`${campo}: ${esito.error.issues[0]?.message ?? "valore non valido"}`)
    controllati[campo] = { prima, dopo: esito.data }
  }
  const { scrivere, conflitti } = confrontaCampi(attuale, controllati)
  if (tolti.length || conflitti.length) return { conflitti: [...tolti, ...conflitti] }
  const nuova = applicaCampi(attuale, scrivere)
  const cambiati = new Set(Object.keys(scrivere).map((k) => (k.startsWith("custom.") ? "custom" : k)))
  // La categoria si controlla solo se cambia: una categoria messa dalla console fuori dal catalogo Ishtar non blocca
  // un salvataggio del prezzo.
  let categoriaId: string | null = null
  if (cambiati.has("category")) {
    const categoria = config.categories.find((c) => c.name === nuova.category)
    if (!categoria) throw invalido("Scegliere una categoria del catalogo")
    categoriaId = categoria.id
  }
  const errore = controllaCampi({
    campi: definiti,
    categoria: nuova.category,
    custom: nuova.custom ?? {},
    precedente: { categoria: attuale.category, custom: attuale.custom ?? {} },
  })
  if (errore) throw invalido(errore)
  return {
    conflitti: [] as Conflitto[],
    nuova,
    prodotto: aggiornamentoProdotto(cambiati, nuova, categoriaId, id, contesto),
    offerta: modificaOfferta(offerta, nuova.price, nuova.cost),
  }
}

const campoNormale = (f: Record<string, unknown>) =>
  JSON.stringify([f.id, f.label, f.type, f.options ?? [], f.category ?? "", f.required ?? false])

/** La configurazione dei campi da cui il pannello è partito è ancora quella salvata? (ordine compreso) */
export function stessiCampi(salvati: Record<string, unknown>[], prima: Record<string, unknown>[]) {
  return salvati.length === prima.length && salvati.every((f, i) => campoNormale(f) === campoNormale(prima[i]))
}

