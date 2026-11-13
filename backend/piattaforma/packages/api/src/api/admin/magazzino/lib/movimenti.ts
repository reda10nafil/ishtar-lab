import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { interroga } from "../../../utili"
import type { RigaInterna } from "./scorte"

/**
 * Lo storico vive nel livello di scorta, così si scrive insieme alla quantità: si tiene l'ultima parte. Correzioni e
 * conteggi si scrivono con il workflow «ishtar-scorte» (scrittura.ts), sotto il lucchetto di ogni voce.
 */
export const MOVIMENTI_PER_LIVELLO = 100

export const MOTIVI = ["rifornimento", "reso", "danneggiato", "smarrito", "rettifica", "altro"] as const

/** Email di chi scrive, per lo storico: le aziende sono membri di Mercur. */
export async function chiE(req: AuthenticatedMedusaRequest): Promise<string> {
  const { data } = await interroga(req).graph({ entity: "member", fields: ["email"], filters: { id: req.auth_context.actor_id } })
  return (data[0] as { email?: string } | undefined)?.email ?? "Company"
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
