import { MedusaService } from "@medusajs/framework/utils"
import { PaginaNegozio } from "./models/pagina"
import { Vetrina } from "./models/vetrina"

// Le chiavi finiscono in «a»: i metodi hanno lo stesso plurale a compilazione e a runtime.
export default class NegozioOnlineModuleService extends MedusaService({ Vetrina, Pagina: PaginaNegozio }) {
  /** La riga nasce alla prima lettura: i valori predefiniti stanno nel modello. */
  async vetrina() {
    const [esistente] = await this.listVetrinas({}, { take: 1 })
    return esistente ?? this.createVetrinas({})
  }
}
