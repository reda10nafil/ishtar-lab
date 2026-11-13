import { z } from "@medusajs/framework/zod"

/*
 * Corpi accettati da POST /admin/ishtar/catalogo.
 * - `product` senza id: creazione (scheda completa).
 * - `modifica`: solo i campi cambiati, ciascuno con il valore da cui il pannello è partito (`prima`), più le variazioni
 *   di scorte con un id (un invio ripetuto non conta due volte) e l'eventuale conteggio della scheda o del CSV.
 * - `fields` con `prima`: configurazione dei campi personalizzati, rifiutata se nel frattempo è cambiata altrove.
 * Un `product` con id o `fields` senza `prima` arrivano da una finestra del pannello con il codice di prima, che
 * riscriverebbe la scheda intera: vengono rifiutati con l'invito a ricaricare la pagina.
 */

export const RICARICA = "Pannello aggiornato: ricaricare la pagina per salvare le modifiche"

const imageUrl = z.string().max(2048).refine((s) => {
  try {
    const u = new URL(s, "http://127.0.0.1:4273")
    return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
  } catch {
    return false
  }
}, "Indirizzo foto non valido")

/** Valore di un campo personalizzato; "" lo svuota. */
export const ValoreCampo = z.union([z.string().max(20000), z.number().finite(), z.boolean()])

export const Product = z.object({
  id: z.string().optional(), name: z.string().trim().min(1).max(200), sku: z.string().trim().min(1).max(80),
  description: z.string().max(20000).default(""), category: z.string().max(150), gender: z.string().max(100).default(""),
  size: z.string().max(80).default(""), color: z.string().max(100).default(""), material: z.string().max(2000).default(""),
  price: z.number().finite().min(0), cost: z.number().finite().min(0), stock: z.number().int().min(0).max(100000000),
  photos: z.array(imageUrl).max(30).default([]), demo: z.boolean().default(false),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  custom: z.record(z.string().max(80), ValoreCampo).default({}),
})

/** Campi che il pannello può modificare, con le stesse regole della creazione. */
export const CAMPI_MODIFICABILI = {
  name: Product.shape.name,
  description: z.string().max(20000),
  category: Product.shape.category,
  gender: z.string().max(100),
  size: z.string().max(80),
  color: z.string().max(100),
  material: z.string().max(2000),
  price: Product.shape.price,
  cost: Product.shape.cost,
  status: z.enum(["draft", "active", "archived"]),
  photos: z.array(imageUrl).max(30),
  demo: z.boolean(),
} as const

export const Field = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,60}$/), label: z.string().trim().min(1).max(100),
  type: z.enum(["text", "number", "select", "color", "boolean", "date"]), options: z.array(z.string().max(150)).max(100).default([]),
  category: z.string().max(150).default(""), required: z.boolean().default(false),
})

/** Valore di partenza così come il pannello l'ha letto (anche un valore vecchio che oggi non passerebbe i controlli). */
const Letto = z.union([z.string().max(20000), z.number(), z.boolean(), z.null(), z.array(z.string().max(2048)).max(30)])
const Quantita = z.number().int().min(-100000000).max(100000000)
const IdMovimento = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/, "Identificatore del movimento non valido")

export const Modifica = z.object({
  id: z.string().min(1).max(100),
  sku: z.string().trim().min(1).max(80),
  campi: z.record(z.string().max(90), z.object({ prima: z.array(Letto).min(1).max(20), dopo: z.unknown() })).default({}),
  movimenti: z.array(z.object({ id: IdMovimento, differenza: Quantita, in_arrivo: Quantita, motivo: z.enum(["rettifica", "rifornimento"]) })).max(200).default([]),
  // La giacenza di partenza è letta dal server e può essere negativa (evasione oltre le scorte); quella contata no.
  conteggio: z.object({ id: IdMovimento, prima: z.array(Quantita).min(1).max(20), dopo: z.number().int().min(0).max(100000000) }).optional(),
})
export type Modifica = z.infer<typeof Modifica>

export const Body = z.union([
  z.object({ product: Product }),
  z.object({ modifica: Modifica }),
  z.object({ fields: z.array(Field).max(100), prima: z.array(z.record(z.string(), z.unknown())).max(100).optional() }),
])
