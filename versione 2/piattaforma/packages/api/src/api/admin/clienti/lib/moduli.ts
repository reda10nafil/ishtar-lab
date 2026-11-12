import { z } from "@medusajs/framework/zod"

const facoltativo = (massimo: number) => z.string().trim().max(massimo, `No more than ${massimo} characters`).optional()

export const DatiCliente = z.object({
  email: z.string({ message: "Enter an email address" }).trim().toLowerCase().email("Enter a valid email address"),
  nome: z.string({ message: "Enter a first name" }).trim().min(1, "Enter a first name").max(100, "No more than 100 characters"),
  cognome: facoltativo(100),
  azienda: facoltativo(150),
  telefono: facoltativo(40),
  newsletter: z.boolean().optional(),
  rivenditore: z.boolean().optional(),
  citta: facoltativo(100),
  tag: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  note: facoltativo(2000),
})

export const ModificaCliente = DatiCliente.partial()

export const DatiIndirizzo = z.object({
  etichetta: facoltativo(80),
  nome: facoltativo(100),
  cognome: facoltativo(100),
  azienda: facoltativo(150),
  indirizzo: z.string({ message: "Enter a street address" }).trim().min(1, "Enter a street address").max(200, "No more than 200 characters"),
  indirizzo_2: facoltativo(200),
  citta: z.string({ message: "Enter a town or city" }).trim().min(1, "Enter a town or city").max(100, "No more than 100 characters"),
  provincia: facoltativo(60),
  cap: facoltativo(16),
  paese: z.string().trim().toLowerCase().length(2, "Country must be a two-letter code").default("it"),
  telefono: facoltativo(40),
  predefinito_spedizione: z.boolean().optional(),
  predefinito_fatturazione: z.boolean().optional(),
})

export const ModificaIndirizzo = DatiIndirizzo.partial()

type Indirizzo = z.infer<typeof ModificaIndirizzo>

/** Un campo lasciato vuoto nel modulo cancella il valore: `undefined` lo lascerebbe com'è. */
export const perMedusa = (i: Indirizzo) => ({
  address_name: i.etichetta,
  first_name: i.nome,
  last_name: i.cognome,
  company: i.azienda,
  address_1: i.indirizzo,
  address_2: i.indirizzo_2,
  city: i.citta,
  province: i.provincia,
  postal_code: i.cap,
  country_code: i.paese,
  phone: i.telefono,
  is_default_shipping: i.predefinito_spedizione,
  is_default_billing: i.predefinito_fatturazione,
})
