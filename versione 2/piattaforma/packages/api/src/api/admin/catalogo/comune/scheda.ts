import { z } from "@medusajs/framework/zod"

const testoBreve = z.string().trim().max(200, "This text is too long")
const testoLungo = z.string().trim().max(20_000, "This text is too long")
const importo = z.number({ message: "Enter a valid amount" }).min(0, "The amount cannot be negative")

const CODICE_EAN = /^\d{8,14}$/

export const ean = z
  .string()
  .trim()
  .refine((valore) => !valore || CODICE_EAN.test(valore), "An EAN has 8 to 14 digits")

/** Campi della scheda comuni ad amministratore e azienda. Tutti facoltativi tranne il nome. */
export const CampiScheda = z.object({
  titolo: z.string().trim().min(1, "Enter a product name").max(200, "This name is too long"),
  descrizione: testoLungo.nullish(),
  categoria_id: z.string().nullish(),
  foto: z.array(z.object({ url: z.string().min(1) })).max(30, "Up to 30 photos").optional(),
  peso: z.number({ message: "Enter a valid weight" }).int("Weight is in whole grams").min(0, "Weight cannot be negative").nullish(),
  composizione: testoBreve.nullish(),
  brand: testoBreve.nullish(),
  stagione: testoBreve.nullish(),
  genere: testoBreve.nullish(),
  cura: testoLungo.nullish(),
  /** Colore della tessera quando il prodotto non ha una foto. */
  tinta: z.number({ message: "Choose a tile colour" }).int().min(0).max(5).nullish(),
  prezzo_cessione: importo.nullish(),
  prezzo_consigliato: importo.nullish(),
})

export const NuovaVariante = z.object({
  titolo: z.string().trim().min(1, "Every variant needs a name").max(80, "This variant name is too long"),
  sku: z.string().trim().min(1, "Every variant needs a code").max(80, "This code is too long"),
  ean: ean.nullish(),
  quantita: z.number({ message: "Enter a valid quantity" }).int("Quantity is a whole number").min(0, "Quantity cannot be negative").nullish(),
})

export type DatiScheda = z.infer<typeof CampiScheda>
export type DatiVariante = z.infer<typeof NuovaVariante>

const CHIAVI_METADATI = ["brand", "stagione", "genere", "cura", "seo_titolo", "seo_descrizione"] as const

type CampiMetadati = Partial<Record<(typeof CHIAVI_METADATI)[number], string | null | undefined>>

/** Traduce i campi della scheda nei nomi di Medusa; i dati extra stanno nei metadati del prodotto. */
export function versoMedusa(dati: Partial<DatiScheda> & CampiMetadati) {
  const metadati = Object.fromEntries(CHIAVI_METADATI.filter((chiave) => dati[chiave] !== undefined).map((chiave) => [chiave, dati[chiave] || null]))
  return {
    title: dati.titolo,
    description: dati.descrizione === undefined ? undefined : dati.descrizione || null,
    categories: dati.categoria_id === undefined ? undefined : dati.categoria_id ? [{ id: dati.categoria_id }] : [],
    images: dati.foto,
    thumbnail: dati.foto === undefined ? undefined : dati.foto[0]?.url ?? null,
    weight: dati.peso,
    material: dati.composizione === undefined ? undefined : dati.composizione || null,
    metadata: dati.tinta === undefined ? metadati : { ...metadati, tinta: dati.tinta },
  }
}
