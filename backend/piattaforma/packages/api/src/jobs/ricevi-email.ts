import type { MedusaContainer } from "@medusajs/framework/types"
import { riceviDaEmail } from "../modules/conversazioni/ricezione-email"

/** Ogni minuto legge le email nuove della casella del negozio, se è collegata, sempre in sola lettura. */
export default async function riceviEmail(container: MedusaContainer) {
  await riceviDaEmail(container)
}

export const config = { name: "ricevi-email", schedule: "* * * * *" }
