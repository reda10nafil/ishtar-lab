import { randomUUID } from "node:crypto"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createInventoryLevelsWorkflow, updateInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"
import { interroga } from "../../../utili"
import type { Movimento, RigaInterna } from "./scorte"

/** Lo storico vive nel livello di scorta, così si scrive insieme alla quantità: si tiene l'ultima parte. */
export const MOVIMENTI_PER_LIVELLO = 100

export const MOTIVI = ["rifornimento", "reso", "danneggiato", "smarrito", "rettifica", "altro"] as const

export type Variazione = {
  riga: RigaInterna
  nuova: number
  tipo: Movimento["tipo"]
  motivo: string | null
  nota: string | null
  /** Unità in arrivo dall'azienda dopo la variazione; se manca restano quelle di prima. */
  in_arrivo?: number
}

/** I tipi di Medusa non dichiarano `metadata` sui livelli, ma il modello lo salva. */
type VoceLivello = { inventory_item_id: string; location_id: string; stocked_quantity: number; incoming_quantity: number; metadata: Record<string, unknown> }

async function chiE(req: AuthenticatedMedusaRequest): Promise<string> {
  const entity = req.auth_context.actor_type === "user" ? "user" : "member"
  const { data } = await interroga(req).graph({ entity, fields: ["email"], filters: { id: req.auth_context.actor_id } })
  return (data[0] as { email?: string } | undefined)?.email ?? "Team member"
}

function metadataDopo({ riga, nuova, tipo, motivo, nota }: Variazione, chi: string, quando: string) {
  const differenza = nuova - riga.giacenza
  const movimento: Movimento = { id: randomUUID(), quando, chi, tipo, prima: riga.giacenza, dopo: nuova, differenza, motivo, nota }
  return {
    ...riga.metadata_livello,
    ...(tipo === "conteggio" ? { ultimo_conteggio: quando } : {}),
    movimenti: differenza ? [movimento, ...riga.movimenti].slice(0, MOVIMENTI_PER_LIVELLO) : riga.movimenti,
  }
}

/** Quantità e movimento vanno nello stesso aggiornamento: non esiste storico senza variazione. */
export async function applicaVariazioni(req: AuthenticatedMedusaRequest, variazioni: Variazione[]) {
  const chi = await chiE(req)
  const quando = new Date().toISOString()
  const voce = (v: Variazione): VoceLivello => ({
    inventory_item_id: v.riga.articolo_id,
    location_id: v.riga.deposito_id,
    stocked_quantity: v.nuova,
    incoming_quantity: v.in_arrivo ?? v.riga.in_arrivo,
    metadata: metadataDopo(v, chi, quando),
  })
  const esistenti = variazioni.filter((v) => v.riga.ha_livello).map(voce)
  const nuove = variazioni.filter((v) => !v.riga.ha_livello).map(voce)
  if (esistenti.length) await updateInventoryLevelsWorkflow(req.scope).run({ input: { updates: esistenti } })
  if (nuove.length) await createInventoryLevelsWorkflow(req.scope).run({ input: { inventory_levels: nuove } })
}

export const ParametriMovimenti = z.object({
  q: z.string().trim().max(120).optional(),
  azienda: z.string().optional(),
  tipo: z.enum(["correzione", "conteggio"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  tutte: z.enum(["0", "1"]).optional(),
})

export function elencoMovimenti(righe: RigaInterna[], parametri: z.infer<typeof ParametriMovimenti>) {
  const testo = parametri.q?.toLowerCase()
  const voci = righe
    .filter((r) => !parametri.azienda || r.azienda_id === parametri.azienda)
    .filter((r) => !testo || [r.sku, r.prodotto, r.variante].some((v) => v?.toLowerCase().includes(testo)))
    .flatMap((r) =>
      r.movimenti.map((m) => ({
        ...m,
        articolo_id: r.articolo_id,
        sku: r.sku,
        prodotto: r.prodotto,
        variante: r.variante,
        deposito: r.deposito,
        azienda: r.azienda,
      }))
    )
    .filter((m) => !parametri.tipo || m.tipo === parametri.tipo)
    .sort((a, b) => b.quando.localeCompare(a.quando))
  return {
    movimenti: parametri.tutte === "1" ? voci : voci.slice(parametri.offset, parametri.offset + parametri.limit),
    conteggio: voci.length,
    limite: parametri.limit,
    posizione: parametri.offset,
  }
}
