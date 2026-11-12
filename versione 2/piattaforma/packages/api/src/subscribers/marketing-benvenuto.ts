import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { inviaBenvenuto } from "../api/admin/marketing/lib/invio"

type Evento = { id: string }

/** Il controllo di regola accesa, consenso e doppio invio sta in `inviaBenvenuto`. */
export default async function marketingBenvenuto({ event: { data }, container }: SubscriberArgs<Evento | Evento[]>) {
  for (const { id } of Array.isArray(data) ? data : [data]) await inviaBenvenuto(container, id)
}

export const config: SubscriberConfig = { event: "customer.created" }
