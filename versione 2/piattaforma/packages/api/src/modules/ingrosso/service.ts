import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import type { Fase } from "./fasi"
import { NotaTrattativa } from "./models/nota-trattativa"
import { Rivenditore } from "./models/rivenditore"
import { Trattativa } from "./models/trattativa"

export default class IngrossoModuleService extends MedusaService({ Rivenditore, Trattativa, NotaTrattativa }) {
  /** Mette la carta al posto indicato della colonna e rinumera la colonna; senza indice va in fondo. */
  @InjectTransactionManager()
  async sposta(id: string, fase: Fase, indice: number | undefined, @MedusaContext() contesto: Context = {}) {
    const carta = await this.retrieveTrattativa(id, {}, contesto)
    const colonna = await this.listTrattativas({ fase }, { order: { posizione: "ASC", created_at: "ASC" } }, contesto)
    // La rinumerazione tocca tutta la colonna: solo il cambio di corsia conta come spostamento.
    const mossa = carta.fase === fase ? {} : { spostata_il: new Date() }
    const altre = colonna.filter((t) => t.id !== id).map((t) => t.id)
    const posto = Math.min(Math.max(indice ?? altre.length, 0), altre.length)
    const ordine = [...altre.slice(0, posto), id, ...altre.slice(posto)]
    await this.updateTrattativas(ordine.map((voce, posizione) => (voce === id ? { id: voce, posizione, fase, ...mossa } : { id: voce, posizione })), contesto)
  }
}
