import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { leggiOfferte } from "../../catalogo/comune/offerte"
import { impostazioniDi, leggiStore } from "../../impostazioni/lettura"
import { istante, partiNelFuso } from "./periodi"
import type { Ordine } from "./ordini"

export const puo = (req: AuthenticatedMedusaRequest, ...chiavi: string[]) => {
  const permessi = (req as unknown as { permissions?: Record<string, string> }).permissions
  return chiavi.some((c) => Boolean(permessi?.[c]))
}

export async function negozio(scope: MedusaContainer) {
  const store = await leggiStore(scope)
  const { negozio: dati } = impostazioniDi(store)
  const valute = store.supported_currencies
  const valuta = valute.find((v) => v.is_default)?.currency_code ?? valute[0]?.currency_code ?? "eur"
  return { fuso: dati.fuso, obiettivo: dati.obiettivo_giornaliero, valuta, nome: store.name }
}

/** Due anni bastano per ogni confronto e per riconoscere chi torna a comprare. */
export function inizioStorico(adesso: Date, fuso: string) {
  const { anno, mese } = partiNelFuso(adesso, fuso)
  return istante(anno - 2, mese, 1, 0, fuso)
}

/** Prezzo di cessione per offerta, come in Products: letto solo per chi ha il permesso `margini`. */
export async function costiDi(scope: MedusaContainer, ordini: Ordine[]) {
  const ids = [...new Set(ordini.flatMap((o) => o.righe.map((r) => r.offerta_id)).filter((id): id is string => Boolean(id)))]
  if (!ids.length) return new Map<string, number>()
  const offerte = await leggiOfferte(scope, { id: ids })
  return new Map(offerte.filter((o) => o.prezzo_cessione !== null).map((o) => [o.id, o.prezzo_cessione as number]))
}
