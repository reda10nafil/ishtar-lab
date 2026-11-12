import { z } from "@medusajs/framework/zod"

const Percentuale = z.number({ message: "Invalid position" }).min(0, "The position is outside the canvas").max(100, "The position is outside the canvas")

const CapoInviato = z.object({
  product_id: z.string().min(1, "The piece has no product"),
  azienda_id: z.string().min(1, "The piece has no company"),
  alternativa_product_id: z.string().nullable().optional(),
  alternativa_azienda_id: z.string().nullable().optional(),
  x: Percentuale,
  y: Percentuale,
  larghezza: z.number({ message: "Invalid width" }).min(10, "The piece is too small for the canvas").max(100, "The piece is larger than the canvas"),
  livello: z.number({ message: "Invalid layer" }).int("Invalid layer").min(0, "Invalid layer"),
})

export const NuovoOutfit = z.object({
  nome: z.string({ message: "Enter a name for the outfit" }).trim().min(1, "Enter a name for the outfit").max(120, "The name is too long"),
  descrizione: z.string().max(2000, "The description is too long").nullable().optional(),
})

export const ModificaOutfit = z.object({
  nome: NuovoOutfit.shape.nome.optional(),
  descrizione: NuovoOutfit.shape.descrizione,
  modalita_prezzo: z.enum(["somma", "fisso"], { message: "Invalid pricing mode" }).optional(),
  prezzo_fisso: z.number({ message: "Invalid price" }).positive("The price must be greater than zero").nullable().optional(),
  sconto_a_carico: z.enum(["negozio", "aziende", "ripartito"], { message: "Invalid discount rule" }).optional(),
  quota_negozio: z.number({ message: "Invalid share" }).int("The share must be a whole number").min(0, "The share must be between 0 and 100").max(100, "The share must be between 0 and 100").optional(),
  capi: z.array(CapoInviato, { message: "Invalid list of pieces" }).max(20, "An outfit can have 20 pieces at most").optional(),
})

export const CambioStato = z.object({
  stato: z.enum(["bozza", "pubblicato", "archiviato"], { message: "Invalid status" }),
})

const Pagina = {
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
}

const Ricerca = z.string().trim().max(120).optional()
const StatoFiltro = z.enum(["bozza", "pubblicato", "archiviato"]).optional()

export const FiltriElenco = z.object({
  ...Pagina,
  q: Ricerca,
  stato: StatoFiltro,
  azienda: z.string().optional(),
  disponibilita: z.enum(["acquistabili", "non_acquistabili"]).optional(),
})

export const FiltriElencoAzienda = z.object({ ...Pagina, q: Ricerca, stato: StatoFiltro })

export const FiltriCatalogo = z.object({ ...Pagina, q: Ricerca, azienda: z.string().optional() })
