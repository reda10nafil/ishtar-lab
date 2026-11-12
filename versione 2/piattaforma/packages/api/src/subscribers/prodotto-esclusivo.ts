import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { linkSellersToProductWorkflow } from "@mercurjs/core/workflows"

type Evento = { id: string }

/**
 * In Multi Outfit ogni prodotto appartiene all'azienda che lo crea.
 * Senza questo legame Mercur lo mostrerebbe alle altre aziende una volta pubblicato.
 */
export default async function prodottoEsclusivo({ event: { data }, container }: SubscriberArgs<Evento | Evento[]>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const ids = (Array.isArray(data) ? data : [data]).map((e) => e.id)

  const { data: azioni } = await query.graph({
    entity: "product_change_action",
    fields: ["product_id", "product_change.created_by"],
    filters: { product_id: ids, action: "PRODUCT_ADD" },
  })
  for (const azione of azioni) {
    const autore = azione.product_change?.created_by
    // I prodotti creati dall'amministratore restano fuori: non appartengono a un'azienda.
    if (!autore?.startsWith("sel_")) continue
    await linkSellersToProductWorkflow(container).run({ input: { id: azione.product_id, add: [autore] } })
  }
}

export const config: SubscriberConfig = { event: "product.created" }
