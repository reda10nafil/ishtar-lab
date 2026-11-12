import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const GIORNO = 86_400_000
const GIORNI_PERIODO = 30
const GIORNI_GRAFICO = 14
const ORDINI_ESCLUSI = new Set(["draft", "canceled", "archived"])

export type Vendite = { pezzi: number; incasso: number; giorni: number[] }

type RigaOrdine = {
  created_at: string
  status: string
  items?: ({ product_id?: string | null; quantity?: number | null; unit_price?: number | null } | null)[]
}

const vuote = (): Vendite => ({ pezzi: 0, incasso: 0, giorni: Array.from({ length: GIORNI_GRAFICO }, () => 0) })

/** Vendite vere degli ultimi 30 giorni per prodotto, dagli ordini: mai numeri stimati. */
export async function venditePerProdotto(scope: MedusaContainer) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const adesso = Date.now()
  const inizio = new Date(adesso - GIORNI_PERIODO * GIORNO)
  const { data } = await query.graph({
    entity: "order",
    fields: ["created_at", "status", "items.product_id", "items.quantity", "items.unit_price"],
    filters: { created_at: { $gte: inizio } },
  })
  const vendite = new Map<string, Vendite>()
  for (const ordine of data as RigaOrdine[]) {
    if (ORDINI_ESCLUSI.has(ordine.status)) continue
    const giorniFa = Math.floor((adesso - new Date(ordine.created_at).getTime()) / GIORNO)
    for (const riga of ordine.items ?? []) {
      if (!riga?.product_id) continue
      const voce = vendite.get(riga.product_id) ?? vuote()
      const pezzi = Number(riga.quantity ?? 0)
      voce.pezzi += pezzi
      voce.incasso += pezzi * Number(riga.unit_price ?? 0)
      if (giorniFa < GIORNI_GRAFICO) voce.giorni[GIORNI_GRAFICO - 1 - giorniFa] += pezzi
      vendite.set(riga.product_id, voce)
    }
  }
  return vendite
}

export const venditeVuote = vuote
