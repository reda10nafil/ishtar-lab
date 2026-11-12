import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  beginReceiveReturnWorkflow,
  beginReturnOrderWorkflow,
  cancelReturnRequestWorkflow,
  cancelReturnWorkflow,
  confirmReturnRequestWorkflow,
  receiveItemReturnRequestWorkflow,
  refundPaymentWorkflow,
  requestItemReturnWorkflow,
} from "@medusajs/medusa/core-flows"
import { confirmReturnReceiveWorkflow } from "@mercurjs/core/workflows"
import { valida } from "../../../utili"
import { autore, inFilaOrdine, nonValido, servizioOrdini } from "./comune"
import { conStorico } from "./evasione"
import { dati, leggiLegami, leggiOrdini, MASSIMO_ORDINI, ordineAssente, type Metadati, type OrdineGrezzo, type Riga } from "./lettura"
import { aziendaDellaRiga } from "./richieste"

export type FaseReso = "richiesto" | "approvato" | "ricevuto" | "rimborsato" | "annullato"

type VoceGrezza = { id: string; item_id: string; quantity: number; note?: string | null; reason?: { id: string; label: string } | null }

export type ResoGrezzo = {
  id: string
  display_id: number
  status: string
  order_id: string
  location_id: string | null
  created_at: string
  requested_at: string | null
  received_at: string | null
  canceled_at: string | null
  metadata: Metadati
  items?: VoceGrezza[] | null
}

type Rimborso = { importo: number; quando: string; chi: string; nota?: string | null }

/** Finché il reso non è approvato Medusa tiene le righe nella modifica in sospeso: la richiesta sta qui. */
type VoceRichiesta = { riga_id: string; quantita: number; motivo: string | null; nota: string | null }

const vociRichieste = (r: ResoGrezzo): VoceRichiesta[] =>
  Array.isArray(r.metadata?.voci)
    ? (r.metadata?.voci as VoceRichiesta[])
    : (r.items ?? []).map((v) => ({ riga_id: v.item_id, quantita: Number(v.quantity), motivo: v.reason?.label ?? null, nota: v.note ?? null }))

const CAMPI = ["id", "display_id", "status", "order_id", "location_id", "created_at", "requested_at", "received_at", "canceled_at", "metadata", "items.*", "items.reason.id", "items.reason.label"]

export async function leggiResi(scope: MedusaContainer, filtri: Record<string, unknown> = {}): Promise<ResoGrezzo[]> {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "return",
    fields: CAMPI,
    filters: filtri,
    pagination: { take: 500, order: { created_at: "DESC" } },
  })
  return dati<ResoGrezzo[]>(data)
}

const rimborsoDi = (r: ResoGrezzo) => (r.metadata?.rimborso ?? null) as Rimborso | null

export function faseDi(r: ResoGrezzo): FaseReso {
  if (r.status === "canceled" || r.canceled_at) return "annullato"
  if (rimborsoDi(r)) return "rimborsato"
  if (r.status === "received" || r.status === "partially_received") return "ricevuto"
  return r.status === "requested" ? "approvato" : "richiesto"
}

const aperto = (r: ResoGrezzo) => ["richiesto", "approvato", "ricevuto"].includes(faseDi(r))

export const contaAperti = async (scope: MedusaContainer) => (await leggiResi(scope)).filter(aperto).length

const unitario = (riga: Riga) => {
  // Dopo la ricezione Medusa toglie dal totale della riga ciò che è rientrato.
  const totale = Number(riga.total)
  return totale > 0 ? totale / Number(riga.quantity) : Number(riga.unit_price)
}

const importoReso = (r: ResoGrezzo, ordine: OrdineGrezzo | undefined) =>
  vociRichieste(r).reduce((somma, voce) => {
    const riga = ordine?.items?.find((i) => i.id === voce.riga_id)
    return riga ? somma + unitario(riga) * voce.quantita : somma
  }, 0)

function aziendaDelReso(r: ResoGrezzo, ordine: OrdineGrezzo | undefined, aziende: string[]) {
  const riga = ordine?.items?.find((i) => i.id === vociRichieste(r)[0]?.riga_id)
  return riga ? aziendaDellaRiga(riga, aziende) : (aziende[0] ?? null)
}

function schedaReso(r: ResoGrezzo, ordine: OrdineGrezzo | undefined, nomi: Map<string, string>, aziende: string[]) {
  const voci = vociRichieste(r).map((voce) => {
    const riga = ordine?.items?.find((i) => i.id === voce.riga_id)
    return {
      id: voce.riga_id,
      titolo: riga?.product_title ?? riga?.title ?? "Item",
      variante: riga?.variant_title ?? null,
      miniatura: riga?.thumbnail ?? null,
      quantita: voce.quantita,
      motivo: voce.motivo,
      nota: voce.nota,
    }
  })
  const azienda = aziendaDelReso(r, ordine, aziende)
  const dovuto = -Number(ordine?.summary?.pending_difference ?? 0)
  return {
    id: r.id,
    numero: r.display_id,
    ordine_id: r.order_id,
    ordine_numero: ordine?.display_id ?? null,
    cliente: [ordine?.shipping_address?.first_name, ordine?.shipping_address?.last_name].filter(Boolean).join(" ") || ordine?.email || "Guest",
    azienda: azienda ? (nomi.get(azienda) ?? null) : null,
    creato_il: r.created_at,
    ricevuto_il: r.received_at,
    fase: faseDi(r),
    importo: importoReso(r, ordine),
    rimborsabile: dovuto > 0 ? dovuto : 0,
    rimborso: rimborsoDi(r),
    voci,
  }
}

export const ParametriResi = z.object({ vista: z.enum(["aperti", "tutti"], { message: "Unknown view" }).default("aperti") })

export async function elencoResi(req: AuthenticatedMedusaRequest, vista: "aperti" | "tutti") {
  const resi = await leggiResi(req.scope)
  const ids = [...new Set(resi.map((r) => r.order_id))]
  const ordini = ids.length ? await leggiOrdini(req.scope, { id: ids }) : []
  const legami = await leggiLegami(req.scope, ordini)
  const perId = new Map(ordini.map((o) => [o.id, o]))
  const inizioMese = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const rimborsato = resi
    .map(rimborsoDi)
    .filter((x) => x && new Date(x.quando).getTime() >= inizioMese)
    .reduce((s, x) => s + (x?.importo ?? 0), 0)
  const trenta = new Date(Date.now() - 30 * 86_400_000)
  const recenti = resi.filter((r) => new Date(r.created_at) >= trenta && faseDi(r) !== "annullato").length
  const { data: recentiOrdini } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "order", fields: ["id", "status"], filters: { is_draft_order: false, created_at: { $gte: trenta.toISOString() } }, pagination: { take: MASSIMO_ORDINI } })
  const venduti = (recentiOrdini as unknown as { status: string }[]).filter((o) => o.status !== "canceled").length
  const scelti = vista === "aperti" ? resi.filter(aperto) : resi
  return {
    resi: scelti.map((r) => schedaReso(r, perId.get(r.order_id), legami.nomi, legami.aziende.get(r.order_id) ?? [])),
    riquadri: { aperti: resi.filter(aperto).length, rimborsato, tasso: venduti ? recenti / venduti : null },
    conteggio: scelti.length,
  }
}

export const NuovoReso = z.object({
  ordine_id: z.string({ error: "Choose the order" }).min(1, "Choose the order"),
  motivo_id: z.string().min(1).optional(),
  nota: z.string().trim().max(500, "The note is too long").optional(),
  righe: z
    .array(z.object({ id: z.string().min(1), quantita: z.number({ error: "Enter a quantity" }).int("Enter a whole quantity").min(1, "Enter a quantity") }), { error: "Choose at least one item" })
    .min(1, "Choose at least one item"),
})

/** Un reso torna a una sola azienda: ogni capo rientra da chi lo ha spedito. */
async function depositoDelReso(req: AuthenticatedMedusaRequest, ordine: OrdineGrezzo, righe: string[]) {
  const legami = await leggiLegami(req.scope, [ordine])
  const aziende = legami.aziende.get(ordine.id) ?? []
  const coinvolte = new Set((ordine.items ?? []).filter((r) => righe.includes(r.id)).map((r) => aziendaDellaRiga(r, aziende)))
  if (coinvolte.size !== 1) throw nonValido("A return goes back to one company: start one return per company")
  const [azienda] = [...coinvolte]
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "stock_location", fields: ["id", "seller.id"] })
  return (data as unknown as { id: string; seller?: { id: string } | null }[]).find((l) => l.seller?.id === azienda)?.id
}

export function creaReso(req: AuthenticatedMedusaRequest, corpo: unknown) {
  const scelta = valida(NuovoReso, corpo)
  return inFilaOrdine(req, scelta.ordine_id, async () => {
    const [ordine] = await leggiOrdini(req.scope, { id: scelta.ordine_id })
    if (!ordine) throw ordineAssente()
    for (const voce of scelta.righe) {
      const riga = ordine.items?.find((r) => r.id === voce.id)
      if (!riga) throw nonValido("This item is not in the order")
      const d = riga.detail
      const libere = Number(d?.shipped_quantity ?? 0) - Number(d?.return_requested_quantity ?? 0) - Number(d?.return_received_quantity ?? 0)
      if (voce.quantita > libere) throw nonValido(libere > 0 ? `Only ${libere} of this item can be returned` : "This item has not been shipped yet, or is already being returned")
    }
    const deposito = await depositoDelReso(req, ordine, scelta.righe.map((r) => r.id))
    const motivo = scelta.motivo_id ? (await servizioOrdini(req).retrieveReturnReason(scelta.motivo_id)).label : null
    try {
      const { result } = await beginReturnOrderWorkflow(req.scope).run({ input: { order_id: ordine.id, location_id: deposito, created_by: req.auth_context.actor_id } })
      const return_id = (result as unknown as { return_id: string }).return_id
      await requestItemReturnWorkflow(req.scope).run({
        input: { return_id, items: scelta.righe.map((r) => ({ id: r.id, quantity: r.quantita, reason_id: scelta.motivo_id, internal_note: scelta.nota })) },
      })
      const voci: VoceRichiesta[] = scelta.righe.map((r) => ({ riga_id: r.id, quantita: r.quantita, motivo, nota: scelta.nota ?? null }))
      await servizioOrdini(req).updateReturns([{ id: return_id, metadata: { voci } }] as never)
      return return_id
    } catch (errore) {
      if (/active|existing/i.test((errore as Error).message)) throw nonValido("Finish the return already open on this order first")
      throw errore
    }
  })
}

async function resoConOrdine(req: AuthenticatedMedusaRequest, id: string) {
  const [reso] = await leggiResi(req.scope, { id })
  if (!reso) throw ordineAssente()
  const [ordine] = await leggiOrdini(req.scope, { id: reso.order_id })
  if (!ordine) throw ordineAssente()
  return { reso, ordine }
}

async function approva(req: AuthenticatedMedusaRequest, reso: ResoGrezzo) {
  if (faseDi(reso) !== "richiesto") throw nonValido("This return has already been approved")
  await confirmReturnRequestWorkflow(req.scope).run({ input: { return_id: reso.id, confirmed_by: req.auth_context.actor_id } })
  // Medusa riscrive i metadati del reso quando applica la modifica.
  await servizioOrdini(req).updateReturns([{ id: reso.id, metadata: reso.metadata }] as never)
}

async function ricevi(req: AuthenticatedMedusaRequest, reso: ResoGrezzo, ordine: OrdineGrezzo) {
  if (faseDi(reso) !== "approvato") throw nonValido("Approve this return before marking it received")
  const voci = (reso.items ?? []).map((v) => ({ id: v.item_id, quantity: Number(v.quantity) }))
  const legami = await leggiLegami(req.scope, [ordine])
  const prima = ordine.items?.find((r) => r.id === voci[0]?.id)
  const azienda = prima ? aziendaDellaRiga(prima, legami.aziende.get(ordine.id) ?? []) : null
  const lavoro = async () => {
    await beginReceiveReturnWorkflow(req.scope).run({ input: { return_id: reso.id, created_by: req.auth_context.actor_id } as never })
    await receiveItemReturnRequestWorkflow(req.scope).run({ input: { return_id: reso.id, items: voci } })
    await confirmReturnReceiveWorkflow(req.scope).run({ input: { return_id: reso.id, confirmed_by: req.auth_context.actor_id } })
  }
  const righe = voci.map((v) => ({ id: v.id, quantita: v.quantity }))
  if (azienda) await conStorico(req, { azienda, deposito: reso.location_id ?? undefined, righe, segno: 1, motivo: "reso", nota: `Return R-${reso.display_id}, order #${ordine.display_id}` }, lavoro)
  else await lavoro()
  await servizioOrdini(req).updateReturns([{ id: reso.id, metadata: reso.metadata }] as never)
}

const DatiRimborso = z.object({
  importo: z.number({ error: "Enter the amount" }).positive("Enter an amount above zero"),
  motivo_id: z.string().min(1).optional(),
  nota: z.string().trim().max(500, "The note is too long").optional(),
})

async function rimborsa(req: AuthenticatedMedusaRequest, reso: ResoGrezzo, ordine: OrdineGrezzo, corpo: unknown) {
  if (faseDi(reso) !== "ricevuto") throw nonValido("Mark this return received before refunding it")
  const { importo, motivo_id, nota } = valida(DatiRimborso, corpo)
  const pagamenti = (ordine.payment_collections ?? []).flatMap((c) => c.payments ?? []).filter((p) => p.captured_at)
  const pagamento = pagamenti.find((p) => Number(p.amount) - (p.refunds ?? []).reduce((s, x) => s + Number(x.amount), 0) >= importo)
  if (!pagamento) throw nonValido(pagamenti.length ? "This amount is more than what can be refunded" : "Take the payment before refunding it")
  try {
    await refundPaymentWorkflow(req.scope).run({ input: { payment_id: pagamento.id, amount: importo, created_by: req.auth_context.actor_id, note: nota, refund_reason_id: motivo_id } })
  } catch (errore) {
    if (/refund more|outstanding/i.test((errore as Error).message)) throw nonValido("This amount is more than what is owed to the customer")
    throw errore
  }
  const rimborso: Rimborso = { importo, quando: new Date().toISOString(), chi: await autore(req), nota: nota ?? null }
  await servizioOrdini(req).updateReturns([{ id: reso.id, metadata: { ...reso.metadata, rimborso } }] as never)
}

async function annullaReso(req: AuthenticatedMedusaRequest, reso: ResoGrezzo) {
  const fase = faseDi(reso)
  if (fase === "richiesto") {
    await cancelReturnRequestWorkflow(req.scope).run({ input: { return_id: reso.id } })
    return
  }
  if (fase !== "approvato") throw nonValido("This return can no longer be cancelled")
  await cancelReturnWorkflow(req.scope).run({ input: { return_id: reso.id, canceled_by: req.auth_context.actor_id } })
}

export const AZIONI_RESO = ["approva", "ricevi", "rimborsa", "annulla"] as const
export type AzioneReso = (typeof AZIONI_RESO)[number]

export async function eseguiReso(req: AuthenticatedMedusaRequest, id: string, azione: AzioneReso, corpo: unknown) {
  const { reso, ordine } = await resoConOrdine(req, id)
  return inFilaOrdine(req, ordine.id, async () => {
    if (azione === "approva") return approva(req, reso)
    if (azione === "ricevi") return ricevi(req, reso, ordine)
    if (azione === "rimborsa") return rimborsa(req, reso, ordine, corpo)
    return annullaReso(req, reso)
  })
}
