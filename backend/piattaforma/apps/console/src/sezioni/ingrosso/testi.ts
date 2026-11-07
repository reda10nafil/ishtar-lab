import { numero } from "../../lingua"
import { euro } from "../../ui"
import type { Fase, Rivenditore } from "./tipi"

export const FASI: { id: Fase; titolo: string }[] = [
  { id: "richiesta", titolo: "Enquiry" },
  { id: "trattativa", titolo: "Negotiation" },
  { id: "campione", titolo: "Samples sent" },
  { id: "accordo", titolo: "Agreed" },
  { id: "perso", titolo: "Lost" },
]

export const PAESI: Record<string, string> = {
  it: "Italy",
  fr: "France",
  de: "Germany",
  es: "Spain",
  gb: "United Kingdom",
  dk: "Denmark",
  se: "Sweden",
}

export const PAGAMENTI = ["Prepaid", "Net 14", "Net 30", "Net 60"]

export function condizioni(r: Pick<Rivenditore, "condizione" | "listino" | "sconto_percentuale">): string {
  if (r.condizione === "listino") return r.listino ? `Price list ${r.listino}` : "Price list to agree"
  return r.sconto_percentuale === null ? "Discount to agree" : `${numero(r.sconto_percentuale)}% off`
}

export const minimo = (valore: number | null) => (valore ? euro(valore) : "None")

export const sigla = (nome: string) => {
  const parole = nome.trim().split(/\s+/)
  return (parole.length > 1 ? `${parole[0][0]}${parole[1][0]}` : nome.slice(0, 2)).toUpperCase()
}

export const conteggioDi = (quanti: number, uno: string, molti = `${uno}s`) => `${numero(quanti)} ${quanti === 1 ? uno : molti}`

/** Campo numerico vuoto o non valido: `null`, così il back-end risponde con il suo messaggio. */
export function numeroDa(testo: string): number | null {
  const valore = Number(testo.replace(",", "."))
  return testo.trim() === "" || Number.isNaN(valore) ? null : valore
}
