import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { leggiImpostazioni, leggiStore } from "../../impostazioni/lettura"
import { prossimoPasso } from "./evasione"
import type { Indirizzo, OrdineGrezzo } from "./lettura"
import { puoAnnullare, puoIncassare } from "./pagamento"
import { faseDi, leggiResi, type ResoGrezzo } from "./resi"
import { rigaDiRichiesta, type Richiesta } from "./richieste"
import { riga, type Unico } from "./unico"

export type Nota = { id: string; testo: string; chi: string; quando: string }
type Voce = { titolo: string; dettaglio: string | null; quando: string; importo?: number }

export const noteDi = (o: OrdineGrezzo) => (Array.isArray(o.metadata?.note) ? (o.metadata?.note as Nota[]) : [])

const indirizzoDi = (a: Indirizzo | null | undefined) =>
  a?.address_1
    ? {
        nome: [a.first_name, a.last_name].filter(Boolean).join(" ") || null,
        azienda: a.company,
        indirizzo: a.address_1,
        indirizzo_2: a.address_2,
        citta: a.city,
        cap: a.postal_code,
        provincia: a.province,
        paese: a.country_code,
        telefono: a.phone,
      }
    : null

type VocePagamento = { id: string; fornitore: string; importo: number; incassato_il: string | null; rimborsato: number; rimborsi: { importo: number; quando: string }[] }

function pagamentiDi(u: Unico): VocePagamento[] {
  const visti = new Map<string, VocePagamento>()
  for (const o of u.ordini) {
    for (const c of o.payment_collections ?? []) {
      for (const p of c.payments ?? []) {
        const rimborsi = (p.refunds ?? []).map((r) => ({ importo: Number(r.amount), quando: r.created_at }))
        visti.set(p.id, { id: p.id, fornitore: p.provider_id, importo: Number(p.amount), incassato_il: p.captured_at, rimborsato: rimborsi.reduce((s, r) => s + r.importo, 0), rimborsi })
      }
    }
  }
  return [...visti.values()]
}

const INIZIO = { online: "Order placed on the online shop", cassa: "Sold on the shop till", ingrosso: "Order placed through wholesale" }

function cronologia(u: Unico, resi: ResoGrezzo[], pagamenti: VocePagamento[]): Voce[] {
  const voci: Voce[] = [{ titolo: INIZIO[u.canale], dettaglio: null, quando: u.creato_il }]
  const unaSola = u.richieste.length <= 1
  for (const r of u.richieste) {
    const chi = unaSola ? null : r.azienda
    if (r.confermata_il) voci.push({ titolo: `Confirmed by ${r.confermata_da ?? r.azienda}`, dettaglio: chi, quando: r.confermata_il })
    for (const c of r.colli) {
      if (c.preparato_il) voci.push({ titolo: `Packed by ${r.preparata_da ?? r.azienda}`, dettaglio: chi, quando: c.preparato_il })
      if (c.spedito_il) voci.push({ titolo: c.tracking ? `Shipped · ${[c.corriere, c.tracking].filter(Boolean).join(" ")}` : "Shipped", dettaglio: chi, quando: c.spedito_il })
      if (c.consegnato_il) voci.push({ titolo: "Delivered", dettaglio: chi, quando: c.consegnato_il })
    }
  }
  for (const p of pagamenti) {
    if (p.incassato_il) voci.push({ titolo: "Payment received", dettaglio: null, quando: p.incassato_il, importo: p.importo })
    for (const x of p.rimborsi) voci.push({ titolo: "Refund issued", dettaglio: null, quando: x.quando })
  }
  for (const o of u.ordini) {
    if (o.canceled_at) voci.push({ titolo: "Order cancelled", dettaglio: unaSola ? null : `#${o.display_id}`, quando: o.canceled_at })
    for (const n of noteDi(o)) voci.push({ titolo: `Note from ${n.chi}`, dettaglio: n.testo, quando: n.quando })
  }
  for (const r of resi) {
    voci.push({ titolo: `Return R-${r.display_id} requested`, dettaglio: null, quando: r.created_at })
    if (r.received_at) voci.push({ titolo: `Return R-${r.display_id} received`, dettaglio: null, quando: r.received_at })
    if (faseDi(r) === "annullato" && r.canceled_at) voci.push({ titolo: `Return R-${r.display_id} cancelled`, dettaglio: null, quando: r.canceled_at })
  }
  return voci.sort((a, b) => b.quando.localeCompare(a.quando))
}

const passoDi = (richieste: Richiesta[]) => {
  const passi = richieste.map(prossimoPasso)
  return (["prepara", "spedisci", "consegna"] as const).find((p) => passi.includes(p)) ?? null
}

export async function mittente(scope: MedusaContainer) {
  const [store, impostazioni] = await Promise.all([leggiStore(scope), leggiImpostazioni(scope)])
  return { nome: store.name, indirizzo: impostazioni.negozio.indirizzo }
}

export async function scheda(req: AuthenticatedMedusaRequest, u: Unico) {
  const [resi, da] = await Promise.all([leggiResi(req.scope, { order_id: u.ordini.map((o) => o.id) }), mittente(req.scope)])
  const pagamenti = pagamentiDi(u)
  const [primo] = u.ordini
  const somma = (campo: "item_total" | "shipping_total" | "tax_total" | "discount_total") => u.ordini.reduce((s, o) => s + Number(o[campo] ?? 0), 0)
  return {
    ...riga(u),
    gruppo_id: u.gruppo_id,
    ordini: u.ordini.map((o) => ({ id: o.id, numero: o.display_id, stato: o.status })),
    righe: u.ordini.flatMap((o) => (o.items ?? []).map((r) => ({ ...rigaDiRichiesta(r), azienda_id: u.richieste.find((x) => x.righe.some((y) => y.id === r.id))?.azienda_id ?? null }))),
    richieste: u.richieste,
    citta: u.citta,
    telefono: primo.shipping_address?.phone ?? primo.customer?.phone ?? null,
    indirizzo: indirizzoDi(primo.shipping_address),
    fatturazione: indirizzoDi(primo.billing_address),
    consegna: u.ordini.flatMap((o) => (o.shipping_methods ?? []).map((m) => ({ nome: m.name, importo: Number(m.amount) }))),
    importi: { articoli: somma("item_total"), spedizione: somma("shipping_total"), tasse: somma("tax_total"), sconti: somma("discount_total"), totale: u.totale },
    pagamenti,
    incassato: pagamenti.filter((p) => p.incassato_il).reduce((s, p) => s + p.importo, 0),
    rimborsato: pagamenti.reduce((s, p) => s + p.rimborsato, 0),
    senza_azienda: u.ordini
      .flatMap((o) => o.items ?? [])
      .filter((r) => !u.richieste.some((x) => x.righe.some((y) => y.id === r.id)))
      .map((r) => r.product_title ?? r.title),
    cronologia: cronologia(u, resi, pagamenti),
    note: u.ordini.flatMap(noteDi).sort((a, b) => b.quando.localeCompare(a.quando)),
    nota: (primo.metadata?.nota as string | undefined) ?? null,
    pagato_con: u.canale === "cassa" ? ((primo.metadata?.pagamento as string | undefined) ?? null) : null,
    resi: resi.map((r) => ({ id: r.id, numero: r.display_id, fase: faseDi(r) })),
    azioni: { incassa: puoIncassare(u), annulla: puoAnnullare(u), passo: passoDi(u.richieste) },
    mittente: da,
  }
}
