import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { EVENTO_CAMPAGNA, inviaCampagna } from "../api/admin/marketing/lib/invio"

/** Invio immediato e programmato passano dallo stesso evento: quello programmato arriva in ritardo. */
export default async function marketingCampagna({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await inviaCampagna(container, data.id)
}

export const config: SubscriberConfig = { event: EVENTO_CAMPAGNA }
