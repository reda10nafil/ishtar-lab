import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaError, MedusaService } from "@medusajs/framework/utils"
import crypto from "node:crypto"
import { CartaRegalo } from "./models/carta-regalo"
import { MovimentoCarta } from "./models/movimento-carta"
import { PropostaSconto } from "./models/proposta-sconto"

type NuovaCarta = {
  importo_iniziale: number
  scadenza: Date | null
  destinatario_nome: string | null
  destinatario_email: string | null
  nota: string | null
}

/** Niente 0, O, 1 e I: il codice si legge e si detta senza equivoci. */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const TENTATIVI = 5

const arrotonda = (valore: number) => Math.round(valore * 100) / 100
const rifiuta = (motivo: string) => new MedusaError(MedusaError.Types.NOT_ALLOWED, motivo)

function generaCodice(): string {
  const segni = [...crypto.randomBytes(16)].map((byte) => ALFABETO[byte % ALFABETO.length]).join("")
  return segni.match(/.{4}/g)!.join("-")
}

export default class CarteRegaloModuleService extends MedusaService({
  // Chiavi senza «o» finale: il plurale coincide a compilazione e a runtime (vedi CLAUDE.md).
  Carta: CartaRegalo,
  MovimentoCarta,
  Proposta: PropostaSconto,
}) {
  private async codiceLibero(contesto: Context): Promise<string> {
    for (let i = 0; i < TENTATIVI; i += 1) {
      const codice = generaCodice()
      const [, usati] = await this.listAndCountCartas({ codice }, { take: 1, withDeleted: true }, contesto)
      if (!usati) return codice
    }
    throw new MedusaError(MedusaError.Types.CONFLICT, "The card code couldn't be generated: try again")
  }

  @InjectTransactionManager()
  async emetti(dati: NuovaCarta, attore: string, @MedusaContext() contesto: Context = {}) {
    const importo = arrotonda(dati.importo_iniziale)
    const codice = await this.codiceLibero(contesto)
    const carta = await this.createCartas({ ...dati, importo_iniziale: importo, saldo: importo, codice }, contesto)
    await this.createMovimentoCartas({ carta_id: carta.id, tipo: "emissione", importo, saldo_dopo: importo, attore }, contesto)
    return carta
  }

  @InjectTransactionManager()
  async rettifica(id: string, importo: number, nota: string, attore: string, @MedusaContext() contesto: Context = {}) {
    const carta = await this.retrieveCarta(id, {}, contesto)
    if (carta.stato === "annullata") throw rifiuta("This card is cancelled: its balance can no longer change")
    const saldo = arrotonda(Number(carta.saldo) + importo)
    if (saldo < 0) throw rifiuta("The balance can't go below zero")
    await this.updateCartas({ id, saldo }, contesto)
    await this.createMovimentoCartas({ carta_id: id, tipo: "rettifica", importo: arrotonda(importo), saldo_dopo: saldo, nota, attore }, contesto)
  }

  @InjectTransactionManager()
  async annulla(id: string, motivo: string, attore: string, @MedusaContext() contesto: Context = {}) {
    const carta = await this.retrieveCarta(id, {}, contesto)
    if (carta.stato === "annullata") throw rifiuta("This card is already cancelled")
    await this.updateCartas({ id, stato: "annullata", saldo: 0, annullata_il: new Date(), motivo_annullamento: motivo }, contesto)
    await this.createMovimentoCartas({ carta_id: id, tipo: "annullamento", importo: -Number(carta.saldo), saldo_dopo: 0, nota: motivo, attore }, contesto)
  }
}
