import type { MedusaContainer } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { leggiCoda, type Voce } from "./coda"
import { ordineAssente } from "./lettura"
import { destinatarioDi, type StatoEvasione } from "./richieste"
import { mittente } from "./scheda"

const FILTRI = ["tutti", "da_preparare", "preparati", "spediti", "consegnati"] as const
type Filtro = (typeof FILTRI)[number]

export const ParametriAzienda = z.object({
  q: z.string().trim().max(120).optional(),
  filtro: z.enum(FILTRI, { message: "Unknown filter" }).default("tutti"),
  limit: z.coerce.number().int().min(1).max(500).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  tutte: z.enum(["0", "1"]).optional(),
})
export type ParametriAzienda = z.infer<typeof ParametriAzienda>

const NEL_FILTRO: Record<Filtro, StatoEvasione[] | null> = {
  tutti: null,
  da_preparare: ["not_fulfilled", "partially_fulfilled"],
  preparati: ["fulfilled", "partially_shipped"],
  spediti: ["shipped", "partially_delivered"],
  consegnati: ["delivered"],
}

const entra = (r: Voce, f: Filtro) => {
  const stati = NEL_FILTRO[f]
  return r.stato !== "annullata" ? !stati || stati.includes(r.evasione) : f === "tutti"
}

/** Il valore dei capi per l'azienda è il suo prezzo di cessione: se manca, non si stima. */
const valoreDi = (r: Voce) => (r.righe.every((x) => x.cessione !== null) ? r.righe.reduce((s, x) => s + (x.cessione ?? 0) * x.quantita, 0) : null)

const senzaPrezzi = (r: Voce) => r.righe.map(({ prezzo: _prezzo, totale: _totale, ...x }) => x)

const rigaAzienda = (r: Voce) => ({
  id: r.ordine_id,
  numero: r.numero,
  creato_il: r.creata_il,
  destinatario: { nome: destinatarioDi(r.ordine).nome, citta: destinatarioDi(r.ordine).citta },
  articoli: r.righe.reduce((s, x) => s + x.quantita, 0),
  anteprime: r.righe.slice(0, 3).map((x) => ({ titolo: x.titolo, miniatura: x.miniatura })),
  evasione: r.evasione,
  stato: r.stato,
  scadenza: r.scadenza,
  in_ritardo: r.in_ritardo,
  valore: valoreDi(r),
  valuta: r.ordine.currency_code,
})

export async function elencoAzienda(scope: MedusaContainer, azienda: string, p: ParametriAzienda) {
  const voci = await leggiCoda(scope, azienda)
  const testo = p.q?.toLowerCase().replace(/^#/, "")
  const cerca = (r: Voce) => [String(r.numero), destinatarioDi(r.ordine).nome, ...r.righe.flatMap((x) => [x.titolo, x.sku])].filter(Boolean).join(" ").toLowerCase()
  const scelte = voci.filter((r) => entra(r, p.filtro)).filter((r) => !testo || cerca(r).includes(testo))
  return {
    ordini: (p.tutte === "1" ? scelte : scelte.slice(p.offset, p.offset + p.limit)).map(rigaAzienda),
    conteggio: scelte.length,
    conteggi: Object.fromEntries(FILTRI.map((f) => [f, voci.filter((r) => entra(r, f)).length])) as Record<Filtro, number>,
  }
}

/** Solo le righe dell'azienda e solo il destinatario: niente email, prezzi di vendita o altre aziende. */
export async function schedaAzienda(scope: MedusaContainer, azienda: string, id: string) {
  const voce = (await leggiCoda(scope, azienda)).find((r) => r.ordine_id === id)
  if (!voce) throw ordineAssente()
  const { ordine, ...r } = voce
  const cronologia = [
    { titolo: "Request received", dettaglio: null, quando: r.creata_il },
    ...(r.confermata_il ? [{ titolo: `Confirmed by ${r.confermata_da ?? "the company"}`, dettaglio: null, quando: r.confermata_il }] : []),
    ...r.colli.flatMap((c) => [
      ...(c.preparato_il ? [{ titolo: `Packed by ${r.preparata_da ?? "the company"}`, dettaglio: null, quando: c.preparato_il }] : []),
      ...(c.spedito_il ? [{ titolo: c.tracking ? `Shipped · ${[c.corriere, c.tracking].filter(Boolean).join(" ")}` : "Shipped", dettaglio: null, quando: c.spedito_il }] : []),
      ...(c.consegnato_il ? [{ titolo: "Delivered", dettaglio: null, quando: c.consegnato_il }] : []),
    ]),
    ...(ordine.canceled_at ? [{ titolo: "Order cancelled", dettaglio: null, quando: ordine.canceled_at }] : []),
  ].sort((a, b) => b.quando.localeCompare(a.quando))
  return {
    ...rigaAzienda(voce),
    azienda: r.azienda,
    destinatario: destinatarioDi(ordine),
    consegna: (ordine.shipping_methods ?? []).map((m) => ({ nome: m.name })),
    richiesta: { ...r, righe: senzaPrezzi(voce) },
    cronologia,
    mittente: await mittente(scope),
  }
}
