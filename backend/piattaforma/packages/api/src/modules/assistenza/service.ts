import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { Lettura } from "./models/lettura"
import { Messaggio } from "./models/messaggio"
import { Preferenza } from "./models/preferenza"
import { Richiesta } from "./models/richiesta"

export type Attore = { tipo: string; id: string }
export type Autore = { id: string; nome: string }
export type StatoRichiesta = "aperta" | "in_attesa" | "chiusa"

type NuovaRichiesta = { oggetto: string; categoria: string; testo: string; azienda_id: string | null; autore: Autore; da_staff: boolean }
type NuovoMessaggio = { testo: string; autore: Autore; da_staff: boolean; da_richiedente: boolean }

const ERRORE_UNICITA = /unique|duplicate|already exists/i

// Le chiavi finiscono in «a»: i metodi hanno lo stesso plurale a compilazione e a runtime.
export default class AssistenzaModuleService extends MedusaService({ Richiesta, Risposta: Messaggio, Lettura, Preferenza }) {
  async apri({ oggetto, categoria, testo, azienda_id, autore, da_staff }: NuovaRichiesta) {
    const richiesta = await this.createRichiestas({
      oggetto,
      categoria,
      azienda_id,
      autore_id: autore.id,
      autore_nome: autore.nome,
      ultimo_messaggio_il: new Date(),
    })
    await this.createRispostas({ richiesta_id: richiesta.id, da_staff, autore_id: autore.id, autore_nome: autore.nome, testo })
    return richiesta
  }

  /** Chi ha aperto la richiesta passa la palla allo staff, e viceversa. */
  async rispondi(id: string, { testo, autore, da_staff, da_richiedente }: NuovoMessaggio) {
    const richiesta = await this.retrieveRichiesta(id)
    if (richiesta.stato === "chiusa") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This request is closed: reopen it to reply")
    }
    await this.createRispostas({ richiesta_id: id, da_staff, autore_id: autore.id, autore_nome: autore.nome, testo })
    return this.updateRichiestas({
      id,
      stato: da_richiedente ? "aperta" : "in_attesa",
      ultimo_messaggio_il: new Date(),
    })
  }

  async chiaviLette({ tipo, id }: Attore, chiavi: string[]) {
    if (!chiavi.length) return new Set<string>()
    const lette = await this.listLetturas({ attore_tipo: tipo, attore_id: id, chiave: chiavi })
    return new Set(lette.map((l) => l.chiave))
  }

  async segnaLette(attore: Attore, chiavi: string[]) {
    const gia = await this.chiaviLette(attore, chiavi)
    const nuove = [...new Set(chiavi)].filter((c) => !gia.has(c))
    if (!nuove.length) return
    try {
      await this.createLetturas(nuove.map((chiave) => ({ attore_tipo: attore.tipo, attore_id: attore.id, chiave })))
    } catch (errore) {
      // Due schede aperte possono segnare lo stesso avviso insieme: basta che sia salvato una volta.
      if (!ERRORE_UNICITA.test((errore as Error).message)) throw errore
    }
  }

  async fontiSpente({ tipo, id }: Attore) {
    const [riga] = await this.listPreferenzas({ attore_tipo: tipo, attore_id: id }, { take: 1 })
    return (riga?.disattivate as unknown as string[] | undefined) ?? []
  }

  async salvaFontiSpente({ tipo, id }: Attore, disattivate: string[]) {
    const [riga] = await this.listPreferenzas({ attore_tipo: tipo, attore_id: id }, { take: 1 })
    const valore = disattivate as unknown as Record<string, unknown>
    if (riga) await this.updatePreferenzas({ id: riga.id, disattivate: valore })
    else await this.createPreferenzas({ attore_tipo: tipo, attore_id: id, disattivate: valore })
  }
}
