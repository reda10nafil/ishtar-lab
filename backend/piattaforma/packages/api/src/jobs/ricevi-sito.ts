import type { MedusaContainer } from "@medusajs/framework/types"
import { riceviDaSito } from "../modules/conversazioni/ricezione-sito"

/**
 * Ogni minuto legge i messaggi nuovi della chat del sito, se è collegata: dieci prelievi a cinque secondi l'uno
 * dall'altro, così un messaggio arriva in Chats entro pochi secondi e il negozio risulta «online» nella finestra della
 * chat. Il lucchetto evita due letture insieme se un giro si allunga.
 */
export default async function riceviSito(container: MedusaContainer) {
  await riceviDaSito(container, { giri: 10, attesa: 5 })
}

export const config = { name: "ricevi-sito", schedule: "* * * * *" }
