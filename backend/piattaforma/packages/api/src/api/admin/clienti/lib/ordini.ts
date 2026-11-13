import type { OrdineCliente } from "./segmenti"

const istante = (data: string | Date) => new Date(data).getTime()

/**
 * Ordini della scheda cliente, dal più recente. Da query.graph le date arrivano come oggetti Date: confrontarle come testo
 * le ordinerebbe per nome del giorno. Le date si restituiscono in ISO.
 */
export function ordiniRecenti(ordini: OrdineCliente[]) {
  return [...ordini]
    .sort((a, b) => istante(b.created_at) - istante(a.created_at))
    .map((o) => ({
      id: o.id,
      numero: o.display_id ?? null,
      stato: o.status ?? null,
      bozza: Boolean(o.is_draft_order),
      totale: Number(o.total ?? 0),
      valuta: o.currency_code ?? null,
      creato_il: new Date(o.created_at).toISOString(),
    }))
}
