import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { CapoOutfit } from "./models/capo-outfit"
import { Outfit } from "./models/outfit"

export type StatoOutfit = "bozza" | "pubblicato" | "archiviato"
export type ModalitaPrezzo = "somma" | "fisso"
export type CaricoSconto = "negozio" | "aziende" | "ripartito"

export type CampiOutfit = {
  nome?: string
  descrizione?: string | null
  modalita_prezzo?: ModalitaPrezzo
  prezzo_fisso?: number | null
  sconto_a_carico?: CaricoSconto
  quota_negozio?: number
}

export type CapoDaSalvare = {
  product_id: string
  azienda_id: string
  alternativa_product_id?: string | null
  alternativa_azienda_id?: string | null
  x: number
  y: number
  larghezza: number
  livello: number
}

const chiave = (capo: { product_id: string; azienda_id: string }) => `${capo.product_id}|${capo.azienda_id}`

export default class OutfitModuleService extends MedusaService({ Outfit, CapoOutfit }) {
  /** Salva impostazioni e composizione insieme: o tutto o niente. I capi si riconoscono da prodotto e azienda. */
  @InjectTransactionManager()
  async salvaComposizione(
    id: string,
    campi: CampiOutfit,
    capi: CapoDaSalvare[] | undefined,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    if (Object.keys(campi).length) await this.updateOutfits({ id, ...campi }, sharedContext)
    if (!capi) return

    const attuali = await this.listCapoOutfits({ outfit_id: id }, { take: null }, sharedContext)
    const perChiave = new Map(attuali.map((capo) => [chiave(capo), capo.id]))
    const voluti = new Set(capi.map(chiave))
    // L'elenco è completo: un capo inviato senza alternativa non ne ha più una.
    const completi = capi.map((capo) => ({
      ...capo,
      alternativa_product_id: capo.alternativa_product_id ?? null,
      alternativa_azienda_id: capo.alternativa_azienda_id ?? null,
    }))

    const daTogliere = attuali.filter((capo) => !voluti.has(chiave(capo))).map((capo) => capo.id)
    const daAggiornare = completi.flatMap((capo) => {
      const esistente = perChiave.get(chiave(capo))
      return esistente ? [{ ...capo, id: esistente }] : []
    })
    const daCreare = completi.filter((capo) => !perChiave.has(chiave(capo))).map((capo) => ({ ...capo, outfit_id: id }))

    if (daTogliere.length) await this.deleteCapoOutfits(daTogliere, sharedContext)
    if (daAggiornare.length) await this.updateCapoOutfits(daAggiornare, sharedContext)
    if (daCreare.length) await this.createCapoOutfits(daCreare, sharedContext)
  }
}
