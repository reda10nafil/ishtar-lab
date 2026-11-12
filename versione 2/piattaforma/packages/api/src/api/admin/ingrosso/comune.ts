import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { FASI } from "../../../modules/ingrosso/fasi"
import { INGROSSO_MODULE } from "../../../modules/ingrosso"
import type IngrossoModuleService from "../../../modules/ingrosso/service"

export const servizioIngrosso = (req: AuthenticatedMedusaRequest) => req.scope.resolve<IngrossoModuleService>(INGROSSO_MODULE)

const testo = (massimo: number) => z.string().trim().max(massimo, "That text is too long").nullable().optional()

export const DatiRivenditore = z.object({
  nome: z.string({ error: "Enter the stockist's name" }).trim().min(2, "Enter the stockist's name").max(120, "That name is too long"),
  referente: testo(120),
  email: z.string().trim().email("That email address isn't valid").or(z.literal("")).nullable().optional(),
  telefono: testo(40),
  partita_iva: testo(30),
  indirizzo: testo(200),
  citta: testo(120),
  cap: testo(12),
  paese: z.string().trim().length(2, "Choose a country").toLowerCase().optional(),
  condizione: z.enum(["listino", "sconto"], { error: "Choose a price list or a discount" }).optional(),
  listino: testo(120),
  sconto_percentuale: z.number({ error: "The discount must be a number" }).min(0, "The discount can't be negative").max(100, "The discount can't go above 100").nullable().optional(),
  pagamento: testo(120),
  ordine_minimo: z.number({ error: "The minimum order must be a number" }).min(0, "The minimum order can't be negative").nullable().optional(),
  appunti: testo(1000),
})

/** I campi vuoti diventano null: il database non deve contenere stringhe vuote. */
export const pulisci = <T extends Record<string, unknown>>(dati: T) =>
  Object.fromEntries(Object.entries(dati).map(([chiave, valore]) => [chiave, valore === "" ? null : valore])) as T

export const FaseValida = z.enum(FASI, { error: "That stage doesn't exist" })

const valore = (dato: unknown) => (dato === null || dato === undefined ? null : Number(dato))

type Rivenditore = Record<string, unknown> & { id: string; sconto_percentuale?: unknown; ordine_minimo?: unknown; trattative?: unknown }

// Le corsie Ordered e Shipped sono gli ordini del rivenditore: la riga conta quelli arrivati lì negli ultimi 30 giorni.
const FASI_ORDINATE = ["accordo", "spedito"]
const TRENTA_GIORNI = 30 * 24 * 60 * 60 * 1000

export function schedaRivenditore(rivenditore: Rivenditore) {
  const { trattative, raw_sconto_percentuale, raw_ordine_minimo, ...resto } = rivenditore
  const elenco = (Array.isArray(trattative) ? trattative : []) as { fase: string; valore_stimato: unknown; spostata_il?: string | Date | null; created_at?: string | Date }[]
  const soglia = Date.now() - TRENTA_GIORNI
  const recenti = elenco.filter((t) => FASI_ORDINATE.includes(t.fase) && new Date(t.spostata_il ?? t.created_at ?? 0).getTime() >= soglia)
  return {
    ...resto,
    sconto_percentuale: valore(rivenditore.sconto_percentuale),
    ordine_minimo: valore(rivenditore.ordine_minimo),
    trattative: elenco.length,
    ordini_recenti: recenti.length,
    valore_recente: recenti.reduce((somma, t) => somma + (valore(t.valore_stimato) ?? 0), 0),
  }
}

type Trattativa = {
  id: string
  titolo: string
  fase: string
  posizione: number
  unita: number | null
  valore_stimato: unknown
  ordine_id: string | null
  spostata_il?: string | Date | null
  created_at: string | Date
  rivenditore: { id: string; nome: string; citta: string | null; referente?: string | null; pagamento?: string | null; created_at?: string | Date }
  note?: { id: string; testo: string; autore: string; created_at: string | Date }[]
}

export function schedaTrattativa(t: Trattativa) {
  return {
    id: t.id,
    titolo: t.titolo,
    fase: t.fase,
    posizione: t.posizione,
    unita: t.unita,
    valore_stimato: valore(t.valore_stimato),
    ordine_id: t.ordine_id,
    creata_il: t.created_at,
    rivenditore: { id: t.rivenditore.id, nome: t.rivenditore.nome, citta: t.rivenditore.citta },
  }
}

export function schedaConNote(t: Trattativa) {
  const note = [...(t.note ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((n) => ({ id: n.id, testo: n.testo, autore: n.autore, quando: n.created_at }))
  const { rivenditore } = t
  return {
    ...schedaTrattativa(t),
    spostata_il: t.spostata_il ?? t.created_at,
    rivenditore: { id: rivenditore.id, nome: rivenditore.nome, citta: rivenditore.citta, referente: rivenditore.referente ?? null, pagamento: rivenditore.pagamento ?? null, dal: rivenditore.created_at },
    note,
  }
}
