import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { invalido, rifiutato, valida } from "../../../../../utili"
import { controllaCodici } from "../../../comune/creazione"
import { creaOfferte } from "../../../comune/offerte"
import { assente, puo, vedeMargini } from "../../../comune/permessi"
import { NuovaVariante } from "../../../comune/scheda"

const importo = z.number({ message: "Enter a valid amount" }).min(0, "The amount cannot be negative").nullish()

const Corpo = NuovaVariante.extend({
  azienda_id: z.string().nullish(),
  prezzo: importo,
  prezzo_cessione: importo,
  prezzo_consigliato: importo,
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const prodottoId = req.params.id
  const dati = valida(Corpo, req.body)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "variants.id"], filters: { id: prodottoId } })
  const prodotto = data[0] as { variants?: unknown[] } | undefined
  if (!prodotto) throw assente("Product")
  if (dati.prezzo_cessione != null && !vedeMargini(req)) throw rifiutato("Supply prices need the margins permission")
  if (dati.quantita != null && !puo(req, "inventory_items", "edit")) throw rifiutato("You do not have permission to change stock")
  if (!dati.azienda_id && (dati.prezzo != null || dati.quantita)) throw invalido("Price and stock belong to a company: choose one")
  await controllaCodici(req.scope, [dati.sku])

  const { result } = await createProductVariantsWorkflow(req.scope).run({
    input: {
      product_variants: [
        {
          product_id: prodottoId,
          title: dati.titolo,
          sku: dati.sku,
          ean: dati.ean || undefined,
          manage_inventory: false,
          variant_rank: prodotto.variants?.length ?? 0,
        } as never,
      ],
    },
  })
  const [variante] = result
  if (dati.azienda_id) {
    await creaOfferte(req.scope, dati.azienda_id, req.auth_context.actor_id, [
      {
        variante_id: variante.id,
        sku: dati.sku,
        ean: dati.ean,
        quantita: dati.quantita,
        prezzo: dati.prezzo,
        prezzo_cessione: dati.prezzo_cessione,
        prezzo_consigliato: dati.prezzo_consigliato,
      },
    ])
  }
  res.status(201).json({ variante: { id: variante.id } })
}
