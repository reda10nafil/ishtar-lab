import { MedusaService } from "@medusajs/framework/utils"
import { Automazione } from "./models/automazione"
import { Campagna } from "./models/campagna"
import { Consegna } from "./models/consegna"

export type ChiaveAutomazione = "carrello" | "benvenuto" | "riacquisto" | "recensione" | "recupero"

const BASE: Record<ChiaveAutomazione, { attiva: boolean; oggetto: string; testo: string }> = {
  carrello: { attiva: false, oggetto: "You left something in your basket", testo: "Your basket is saved and waiting for you." },
  benvenuto: {
    attiva: true,
    oggetto: "Welcome",
    testo: "Thanks for joining us.\n\nFrom now on you'll be the first to hear about new outfits and pieces from our companies.",
  },
  riacquisto: { attiva: false, oggetto: "Time for something new", testo: "It's been a while: here's what has arrived since your last order." },
  recensione: { attiva: false, oggetto: "How did it fit?", testo: "Tell us what you think of your order." },
  recupero: { attiva: false, oggetto: "We've missed you", testo: "It's been a while. Here's what's new since your last visit." },
}

export const CHIAVI_AUTOMAZIONE = Object.keys(BASE) as ChiaveAutomazione[]

// Le chiavi non finiscono in «o»: i metodi hanno lo stesso plurale a compilazione e a runtime.
export default class MarketingModuleService extends MedusaService({ Campagna, Automazione, Consegna }) {
  /** Le regole esistono da subito: al primo accesso si crea la riga che ne conserva lo stato. */
  async assicuraAutomazioni() {
    const presenti = await this.listAutomaziones({})
    const mancanti = CHIAVI_AUTOMAZIONE.filter((chiave) => !presenti.some((a) => a.chiave === chiave))
    if (!mancanti.length) return presenti
    const nuove = await this.createAutomaziones(mancanti.map((chiave) => ({ chiave, ...BASE[chiave] })))
    return [...presenti, ...nuove]
  }

  async automazione(chiave: ChiaveAutomazione) {
    const tutte = await this.assicuraAutomazioni()
    return tutte.find((a) => a.chiave === chiave)
  }
}
