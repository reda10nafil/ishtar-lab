import type { MedusaContainer } from "@medusajs/framework/types"
import { riceviDaTelegram } from "../modules/conversazioni/ricezione"

/** Ogni minuto legge i messaggi nuovi del bot Telegram del negozio: due richieste in attesa fino a 25 secondi ciascuna. */
export default async function riceviTelegram(container: MedusaContainer) {
  await riceviDaTelegram(container, { giri: 2, attesa: 25 })
}

export const config = { name: "ricevi-telegram", schedule: "* * * * *" }
