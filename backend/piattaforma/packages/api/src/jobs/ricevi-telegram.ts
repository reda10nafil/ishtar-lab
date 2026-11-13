import type { MedusaContainer } from "@medusajs/framework/types"
import { riceviDaTelegram } from "../modules/conversazioni/ricezione"

/**
 * Ogni minuto legge i messaggi nuovi del bot Telegram del negozio: quattro richieste in attesa fino a 12 secondi
 * ciascuna. Attese brevi: allo spegnimento dell'API una lettura in corso finisce prima dell'arresto forzato.
 */
export default async function riceviTelegram(container: MedusaContainer) {
  await riceviDaTelegram(container, { giri: 4, attesa: 12 })
}

export const config = { name: "ricevi-telegram", schedule: "* * * * *" }
