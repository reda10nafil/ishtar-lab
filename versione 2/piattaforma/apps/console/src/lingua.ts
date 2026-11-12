/** Stati del back-end in un solo punto: le pagine non mostrano mai il valore tecnico. */
export type Tono = "ok" | "attesa" | "errore" | "neutro"
export type Stato = { testo: string; tono: Tono }

const SCONOSCIUTO: Stato = { testo: "Unknown", tono: "neutro" }

export const STATI_ORDINE: Record<string, Stato> = {
  pending: { testo: "In progress", tono: "attesa" },
  completed: { testo: "Completed", tono: "ok" },
  draft: { testo: "Draft", tono: "neutro" },
  archived: { testo: "Archived", tono: "neutro" },
  canceled: { testo: "Cancelled", tono: "errore" },
  requires_action: { testo: "Action needed", tono: "attesa" },
}

export const STATI_PAGAMENTO: Record<string, Stato> = {
  not_paid: { testo: "Unpaid", tono: "attesa" },
  awaiting: { testo: "Awaiting payment", tono: "attesa" },
  authorized: { testo: "Authorised", tono: "attesa" },
  partially_authorized: { testo: "Partly authorised", tono: "attesa" },
  captured: { testo: "Paid", tono: "ok" },
  partially_captured: { testo: "Partly paid", tono: "attesa" },
  refunded: { testo: "Refunded", tono: "neutro" },
  partially_refunded: { testo: "Partly refunded", tono: "neutro" },
  canceled: { testo: "Cancelled", tono: "errore" },
  requires_action: { testo: "Action needed", tono: "attesa" },
}

export const STATI_EVASIONE: Record<string, Stato> = {
  not_fulfilled: { testo: "To pack", tono: "attesa" },
  partially_fulfilled: { testo: "Partly packed", tono: "attesa" },
  fulfilled: { testo: "Packed", tono: "attesa" },
  partially_shipped: { testo: "Partly shipped", tono: "attesa" },
  shipped: { testo: "Shipped", tono: "ok" },
  partially_delivered: { testo: "Partly delivered", tono: "attesa" },
  delivered: { testo: "Delivered", tono: "ok" },
  canceled: { testo: "Cancelled", tono: "errore" },
}

export const STATI_PRODOTTO: Record<string, Stato> = {
  published: { testo: "On sale", tono: "ok" },
  proposed: { testo: "In review", tono: "attesa" },
  requires_action: { testo: "Changes requested", tono: "attesa" },
  rejected: { testo: "Rejected", tono: "errore" },
  draft: { testo: "Draft", tono: "neutro" },
}

export const STATI_AZIENDA: Record<string, Stato> = {
  open: { testo: "Active", tono: "ok" },
  pending_approval: { testo: "Awaiting approval", tono: "attesa" },
  suspended: { testo: "Suspended", tono: "errore" },
  terminated: { testo: "Closed", tono: "errore" },
}

export const stato = (mappa: Record<string, Stato>, valore: string | null | undefined): Stato =>
  (valore ? mappa[valore] : undefined) ?? SCONOSCIUTO

const FORMATO_NUMERO = new Intl.NumberFormat("en-GB")
const FORMATO_PERCENTUALE = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 })
const FORMATO_RELATIVO = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" })

export const numero = (valore: number | null | undefined) => (valore === null || valore === undefined ? "–" : FORMATO_NUMERO.format(valore))

/** Accetta una frazione: 0.25 diventa 25%. */
export const percentuale = (valore: number | null | undefined) => (valore === null || valore === undefined ? "–" : FORMATO_PERCENTUALE.format(valore))

export function fa(valore: string | Date): string {
  const minuti = Math.round((new Date(valore).getTime() - Date.now()) / 60_000)
  if (Math.abs(minuti) < 60) return FORMATO_RELATIVO.format(minuti, "minute")
  const ore = Math.round(minuti / 60)
  if (Math.abs(ore) < 24) return FORMATO_RELATIVO.format(ore, "hour")
  return FORMATO_RELATIVO.format(Math.round(ore / 24), "day")
}
