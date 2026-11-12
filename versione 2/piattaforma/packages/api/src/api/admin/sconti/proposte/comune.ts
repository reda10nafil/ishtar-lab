import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { invalido } from "../../../utili"
import { leggiPromozioni, statoDi } from "../promozioni"

export type Proposta = {
  id: string
  azienda_id: string
  titolo: string
  tipo: string
  valore: unknown
  inizio: string | Date
  fine: string | Date
  motivo: string
  prodotti: string[] | null
  stato: string
  nota: string | null
  deciso_da: string | null
  deciso_il: string | Date | null
  promozione_id: string | null
  codice: string | null
  created_at: string | Date
}

const DataObbligatoria = (messaggio: string) => z.string({ error: messaggio }).refine((valore) => !Number.isNaN(Date.parse(valore)), "That date isn't valid")

export const NuovaProposta = z.object({
  titolo: z.string({ error: "Give the proposal a title" }).trim().min(3, "The title needs at least 3 characters").max(80, "That title is too long"),
  tipo: z.enum(["percentuale", "importo"], { error: "Choose a discount type" }),
  valore: z.number({ error: "Enter the discount value" }).positive("Il valore deve essere maggiore di zero"),
  inizio: DataObbligatoria("Enter the start date"),
  fine: DataObbligatoria("Enter the end date"),
  motivo: z.string({ error: "Give a reason for the proposal" }).trim().min(5, "Give the reason in a few words").max(500, "That reason is too long"),
  prodotti: z.array(z.string()).max(200, "Too many products in one proposal").nullable().optional(),
})

export function controllaProposta(dati: z.infer<typeof NuovaProposta>) {
  if (dati.tipo === "percentuale" && dati.valore > 100) throw invalido("The percentage can't go above 100")
  if (Date.parse(dati.fine) <= Date.parse(dati.inizio)) throw invalido("The end date must be after the start date")
  if (Date.parse(dati.fine) <= Date.now()) throw invalido("The end date must be in the future")
}

/** Solo i prodotti legati all'azienda: lo stesso legame che usa il portale per mostrarglieli. */
export async function prodottiDellAzienda(scope: MedusaContainer, azienda: string, scelti?: string[] | null): Promise<string[]> {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_seller",
    fields: ["product_id"],
    filters: { seller_id: azienda, ...(scelti?.length ? { product_id: scelti } : {}) },
  })
  return (data as { product_id: string }[]).map((riga) => riga.product_id)
}

async function titoliProdotti(scope: MedusaContainer, proposte: Proposta[]) {
  const ids = [...new Set(proposte.flatMap((p) => p.prodotti ?? []))]
  if (!ids.length) return new Map<string, string>()
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "product", fields: ["id", "title"], filters: { id: ids } })
  return new Map<string, string>(data.map((p) => [p.id, p.title]))
}

/** Lo stato dello sconto nato dalla proposta, se esiste ancora. */
async function statiSconti(scope: MedusaContainer, proposte: Proposta[]) {
  const ids = proposte.map((p) => p.promozione_id).filter(Boolean) as string[]
  const stati = new Map<string, string>()
  if (ids.length) for (const promozione of await leggiPromozioni(scope, { id: ids })) stati.set(promozione.id, statoDi(promozione))
  return stati
}

/** Campi uguali per le due viste. Mai prezzi di vendita, mai dati di altre aziende. */
export async function perVista(scope: MedusaContainer, proposte: Proposta[]) {
  const [titoli, stati] = await Promise.all([titoliProdotti(scope, proposte), statiSconti(scope, proposte)])
  return proposte.map((p) => ({
    id: p.id,
    titolo: p.titolo,
    tipo: p.tipo,
    valore: Number(p.valore),
    inizio: p.inizio,
    fine: p.fine,
    motivo: p.motivo,
    prodotti: (p.prodotti ?? []).map((id) => titoli.get(id) ?? "Product no longer available"),
    stato: p.stato,
    nota: p.nota,
    codice: p.codice,
    stato_sconto: p.promozione_id ? stati.get(p.promozione_id) ?? "eliminato" : null,
    creata_il: p.created_at,
    decisa_il: p.deciso_il,
  }))
}
