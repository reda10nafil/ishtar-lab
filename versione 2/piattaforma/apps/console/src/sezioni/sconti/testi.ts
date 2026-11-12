import { numero, type Stato } from "../../lingua"
import { dataBreve, euro } from "../../ui"
import type { StatoCarta, StatoProposta, StatoSconto, TipoMovimento, TipoSconto } from "./tipi"

export const STATI_CARTA: Record<StatoCarta, Stato> = {
  attiva: { testo: "Active", tono: "ok" },
  esaurita: { testo: "Used up", tono: "neutro" },
  scaduta: { testo: "Expired", tono: "attesa" },
  annullata: { testo: "Cancelled", tono: "errore" },
  congelata: { testo: "Frozen", tono: "neutro" },
}

export const STATI_PROPOSTA: Record<StatoProposta, Stato> = {
  in_attesa: { testo: "Pending", tono: "attesa" },
  approvata: { testo: "Approved", tono: "ok" },
  rifiutata: { testo: "Rejected", tono: "errore" },
}

/** Che fine ha fatto lo sconto nato da una proposta approvata. */
export const STATI_SCONTO_NATO: Record<StatoSconto | "eliminato", string> = {
  attivo: "Live",
  programmato: "Goes live on its start date",
  in_pausa: "Paused",
  terminato: "Ended",
  eliminato: "Deleted by the administrator",
}

export const TIPI_MOVIMENTO: Record<TipoMovimento, string> = {
  emissione: "Issued",
  rettifica: "Adjustment",
  annullamento: "Cancelled",
}

export function valoreSconto(tipo: TipoSconto, valore: number | null): string {
  if (tipo === "spedizione") return "Free postage"
  return tipo === "importo" ? `${euro(valore)} off` : `${numero(valore)}% off`
}

export function periodo(inizio: string | null, fine: string | null): string {
  if (inizio && fine) return `${dataBreve(inizio)} to ${dataBreve(fine)}`
  if (fine) return `Until ${dataBreve(fine)}`
  return inizio ? `From ${dataBreve(inizio)}` : "No end date"
}

export const conteggioDi = (quanti: number, uno: string, molti = `${uno}s`) => `${numero(quanti)} ${quanti === 1 ? uno : molti}`

/** Importi tondi senza decimali, nel formato della valuta del negozio. */
export const importoTondo = (valore: number) => euro(valore).replace(/[.,]00(?=\D*$)/, "")

/** Giorno e mese soltanto: «27 Oct». */
export const giornoMese = (valore: string | Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(valore))

const GIORNO = 86_400_000

export const giorniRimasti = (fine: string) => Math.ceil((new Date(fine).getTime() - Date.now()) / GIORNO)

const due = (valore: number) => String(valore).padStart(2, "0")

/** Il campo data lavora in ora locale: l'inizio è il primo istante del giorno, la fine l'ultimo. */
export const inizioGiorno = (giorno: string) => (giorno ? new Date(`${giorno}T00:00:00`).toISOString() : null)
export const fineGiorno = (giorno: string) => (giorno ? new Date(`${giorno}T23:59:59`).toISOString() : null)

export function perCampoData(valore: string | null): string {
  if (!valore) return ""
  const data = new Date(valore)
  return `${data.getFullYear()}-${due(data.getMonth() + 1)}-${due(data.getDate())}`
}

/** Campo numerico vuoto o non valido: `null`, così il back-end risponde con il suo messaggio. */
export function numeroDa(testo: string): number | null {
  const valore = Number(testo.replace(",", "."))
  return testo.trim() === "" || Number.isNaN(valore) ? null : valore
}
