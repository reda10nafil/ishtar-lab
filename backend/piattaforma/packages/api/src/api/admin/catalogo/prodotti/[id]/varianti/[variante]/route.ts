import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { deleteProductVariantsWorkflow, updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { invalido, rifiutato, valida } from "../../../../../../utili"
import { aggiornaOfferta, creaOfferte, impostaScorte, leggiOfferte, rimuoviOfferte, type Offerta } from "../../../../comune/offerte"
import { assente, puo, vedeMargini } from "../../../../comune/permessi"
import { ean } from "../../../../comune/scheda"

const importo = z.number({ message: "Enter a valid amount" }).min(0, "The amount cannot be negative").nullable()
const quantita = z.number({ message: "Enter a valid quantity" }).int("Quantity is a whole number").min(0, "Quantity cannot be negative")

const CampiOfferta = z.object({
  prezzo: importo.optional(),
  prezzo_cessione: importo.optional(),
  prezzo_consigliato: importo.optional(),
  quantita: quantita.optional(),
})

const Corpo = z.object({
  titolo: z.string().trim().min(1, "A variant needs a name").max(80, "This variant name is too long").optional(),
  sku: z.string().trim().min(1, "A variant needs a code").max(80, "This code is too long").optional(),
  ean: ean.nullish(),
  offerte: z.array(CampiOfferta.extend({ id: z.string() })).optional(),
  nuova_offerta: CampiOfferta.extend({ azienda_id: z.string() }).optional(),
})

async function leggiVariante(req: AuthenticatedMedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "variant",
    fields: ["id", "sku", "ean", "title"],
    filters: { id: req.params.variante, product_id: req.params.id },
  })
  const variante = data[0] as { id: string; sku: string | null; ean: string | null; title: string } | undefined
  if (!variante) throw assente("Variant")
  return variante
}

/** I metadati dell'offerta si uniscono a quelli esistenti: per svuotare un prezzo si scrive `null`. */
const metadatiAggiornati = (offerta: Offerta, { prezzo_cessione, prezzo_consigliato }: { prezzo_cessione?: number | null; prezzo_consigliato?: number | null }) => ({
  ...offerta.metadata,
  ...(prezzo_cessione !== undefined ? { prezzo_cessione } : {}),
  ...(prezzo_consigliato !== undefined ? { prezzo_consigliato } : {}),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(Corpo, req.body)
  const variante = await leggiVariante(req)
  const autore = req.auth_context.actor_id
  const voci = [...(dati.offerte ?? []), ...(dati.nuova_offerta ? [dati.nuova_offerta] : [])]
  if (voci.some((o) => o.prezzo_cessione !== undefined) && !vedeMargini(req)) throw rifiutato("Supply prices need the margins permission")
  if (voci.some((o) => o.quantita !== undefined) && !puo(req, "inventory_items", "edit")) throw rifiutato("You do not have permission to change stock")

  const campi = {
    ...(dati.titolo !== undefined && dati.titolo !== variante.title ? { title: dati.titolo } : {}),
    ...(dati.sku !== undefined && dati.sku !== variante.sku ? { sku: dati.sku } : {}),
    ...(dati.ean !== undefined && (dati.ean || null) !== variante.ean ? { ean: dati.ean || null } : {}),
  }
  if (Object.keys(campi).length) {
    await updateProductVariantsWorkflow(req.scope).run({ input: { selector: { id: variante.id }, update: campi } })
  }

  const attuali = await leggiOfferte(req.scope, { variant_id: variante.id })
  for (const modifica of dati.offerte ?? []) {
    const offerta = attuali.find((o) => o.id === modifica.id)
    if (!offerta) throw invalido("This offer does not belong to the variant")
    if (modifica.quantita !== undefined && offerta.livelli.length > 1) throw invalido("Stock across several warehouses is changed from Inventory")
    await aggiornaOfferta(req.scope, offerta, { prezzo: modifica.prezzo, metadata: metadatiAggiornati(offerta, modifica) }, autore)
    if (modifica.quantita !== undefined) await impostaScorte(req.scope, offerta, modifica.quantita)
  }

  if (dati.nuova_offerta) {
    const { azienda_id, ...resto } = dati.nuova_offerta
    if (attuali.some((o) => o.azienda.id === azienda_id)) throw invalido("This company already has an offer on the variant")
    const sku = dati.sku ?? variante.sku ?? variante.id
    await creaOfferte(req.scope, azienda_id, autore, [{ variante_id: variante.id, sku, ean: dati.ean ?? variante.ean, ...resto }])
  }
  res.json({ variante: { id: variante.id } })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const variante = await leggiVariante(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: sorelle } = await query.graph({ entity: "variant", fields: ["id"], filters: { product_id: req.params.id } })
  if (sorelle.length <= 1) throw invalido("A product needs at least one variant")
  await rimuoviOfferte(req.scope, await leggiOfferte(req.scope, { variant_id: variante.id }))
  await deleteProductVariantsWorkflow(req.scope).run({ input: { ids: [variante.id] } })
  res.json({ id: variante.id, eliminata: true })
}
