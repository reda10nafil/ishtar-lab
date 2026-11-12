import type { MedusaContainer } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { giorniMassimi, leggiLegami, leggiOrdini, ordiniDiAzienda, type OrdineGrezzo } from "./lettura"
import { destinatarioDi, richiesteDi, STATI_APERTI, type Richiesta, type StatoRichiesta } from "./richieste"

export const FILTRI_CODA = ["tutte", "da_confermare", "confermate", "preparate", "spedite", "consegnate", "in_ritardo"] as const
export type FiltroCoda = (typeof FILTRI_CODA)[number]

export const ParametriCoda = z.object({
  q: z.string().trim().max(120).optional(),
  filtro: z.enum(FILTRI_CODA, { message: "Unknown filter" }).default("tutte"),
  azienda: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})
export type ParametriCoda = z.infer<typeof ParametriCoda>

const STATO_FILTRO: Partial<Record<FiltroCoda, StatoRichiesta>> = {
  da_confermare: "da_confermare",
  confermate: "confermata",
  preparate: "preparata",
  spedite: "spedita",
  consegnate: "consegnata",
}

export const nelFiltro = (r: Richiesta, f: FiltroCoda) => {
  if (f === "tutte") return r.stato !== "annullata"
  if (f === "in_ritardo") return r.in_ritardo
  return r.stato === STATO_FILTRO[f]
}

export type Voce = Richiesta & { ordine: OrdineGrezzo }

/** Tutte le richieste, o solo quelle dell'azienda: l'azienda non riceve mai righe altrui. */
export async function leggiCoda(scope: MedusaContainer, azienda?: string): Promise<Voce[]> {
  const propri = azienda ? await ordiniDiAzienda(scope, azienda) : null
  if (propri && !propri.length) return []
  const ordini = await leggiOrdini(scope, propri ? { id: propri } : {})
  const [legami, giorni] = await Promise.all([leggiLegami(scope, ordini), giorniMassimi(scope)])
  return ordini.flatMap((ordine) => richiesteDi(ordine, legami, giorni).map((r) => ({ ...r, ordine }))).filter((r) => !azienda || r.azienda_id === azienda)
}

/** Sul profilo azienda spariscono i prezzi di vendita: resta solo il suo prezzo di cessione. */
export function pubblicaRichiesta({ ordine, ...r }: Voce, admin: boolean) {
  const destinatario = destinatarioDi(ordine)
  return {
    ...r,
    righe: r.righe.map(({ prezzo, totale, ...x }) => (admin ? { ...x, prezzo, totale } : x)),
    destinatario: { nome: destinatario.nome, citta: destinatario.citta },
  }
}

export function elencoCoda(voci: Voce[], p: ParametriCoda, admin: boolean) {
  const testo = p.q?.toLowerCase().replace(/^#/, "")
  const cerca = (r: Voce) => [String(r.numero), r.azienda, destinatarioDi(r.ordine).nome, ...r.righe.flatMap((x) => [x.titolo, x.sku])].filter(Boolean).join(" ").toLowerCase()
  const scelte = voci
    .filter((r) => nelFiltro(r, p.filtro))
    .filter((r) => !p.azienda || r.azienda_id === p.azienda)
    .filter((r) => !testo || cerca(r).includes(testo))
    .sort((a, b) => Number(b.in_ritardo) - Number(a.in_ritardo) || (a.scadenza ?? a.creata_il).localeCompare(b.scadenza ?? b.creata_il))
  const conta = (f: FiltroCoda) => voci.filter((r) => nelFiltro(r, f)).length
  return {
    richieste: scelte.slice(p.offset, p.offset + p.limit).map((r) => pubblicaRichiesta(r, admin)),
    conteggio: scelte.length,
    conteggi: Object.fromEntries(FILTRI_CODA.map((f) => [f, conta(f)])) as Record<FiltroCoda, number>,
    riquadri: {
      da_confermare: conta("da_confermare"),
      da_preparare: voci.filter((r) => r.stato === "da_confermare" || r.stato === "confermata").length,
      da_spedire: conta("preparate"),
      in_ritardo: conta("in_ritardo"),
    },
    aziende: admin ? [...new Map(voci.map((r) => [r.azienda_id, { id: r.azienda_id, nome: r.azienda }])).values()] : [],
    aperte: voci.filter((r) => STATI_APERTI.includes(r.stato)).length,
  }
}
