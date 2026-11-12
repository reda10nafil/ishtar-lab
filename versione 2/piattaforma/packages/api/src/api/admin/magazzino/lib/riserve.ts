import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { interroga } from "../../../utili"
import type { RigaInterna } from "./scorte"

type Riserva = {
  id: string
  inventory_item_id: string
  location_id: string
  quantity: number
  line_item_id: string | null
  description: string | null
  created_at: string
}

export const ParametriRiserve = z.object({
  q: z.string().trim().max(120).optional(),
  azienda: z.string().optional(),
  deposito: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})

/** Una riserva appartiene a chi possiede l'articolo in quel deposito: le altre non escono da qui. */
export async function leggiRiserve(req: AuthenticatedMedusaRequest, righe: RigaInterna[]) {
  if (!righe.length) return []
  const perChiave = new Map(righe.map((r) => [`${r.articolo_id}@${r.deposito_id}`, r]))
  const { data } = await interroga(req).graph({
    entity: "reservation",
    fields: ["id", "inventory_item_id", "location_id", "quantity", "line_item_id", "description", "created_at"],
    filters: { location_id: [...new Set(righe.map((r) => r.deposito_id))] },
  })
  return (data as unknown as Riserva[]).flatMap((riserva) => {
    const riga = perChiave.get(`${riserva.inventory_item_id}@${riserva.location_id}`)
    if (!riga) return []
    return [
      {
        id: riserva.id,
        articolo_id: riga.articolo_id,
        sku: riga.sku,
        prodotto: riga.prodotto,
        variante: riga.variante,
        azienda_id: riga.azienda_id,
        azienda: riga.azienda,
        deposito_id: riga.deposito_id,
        deposito: riga.deposito,
        quantita: Number(riserva.quantity),
        origine: riserva.line_item_id ? ("ordine" as const) : ("manuale" as const),
        descrizione: riserva.description,
        creata_il: riserva.created_at,
      },
    ]
  })
}

export function elencoRiserve(riserve: Awaited<ReturnType<typeof leggiRiserve>>, parametri: z.infer<typeof ParametriRiserve>) {
  const testo = parametri.q?.toLowerCase()
  const trovate = riserve
    .filter((r) => !parametri.azienda || r.azienda_id === parametri.azienda)
    .filter((r) => !parametri.deposito || r.deposito_id === parametri.deposito)
    .filter((r) => !testo || [r.sku, r.prodotto, r.variante, r.descrizione].some((v) => v?.toLowerCase().includes(testo)))
    .sort((a, b) => String(b.creata_il).localeCompare(String(a.creata_il)))
  return {
    riserve: trovate.slice(parametri.offset, parametri.offset + parametri.limit),
    conteggio: trovate.length,
    unita: trovate.reduce((totale, r) => totale + r.quantita, 0),
    limite: parametri.limit,
    posizione: parametri.offset,
  }
}
