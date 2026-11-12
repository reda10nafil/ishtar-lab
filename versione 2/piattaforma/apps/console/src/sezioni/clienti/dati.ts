import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { euro } from "../../ui"
import type { DatiSegmenti, Filtro, Indirizzo } from "./tipi"

export const PER_PAGINA = 20

export const FILTRI: { valore: Filtro; testo: string }[] = [
  { valore: "tutti", testo: "Everyone" },
  { valore: "abituali", testo: "Regulars" },
  { valore: "nuovi", testo: "New" },
  { valore: "newsletter", testo: "Subscribed" },
  { valore: "rivenditori", testo: "Stockists" },
]

export const ORDINI = [
  { valore: "speso", testo: "Most spent" },
  { valore: "ordini", testo: "Most orders" },
  { valore: "ultimo", testo: "Latest order" },
  { valore: "nome", testo: "Name" },
]

export const SEGMENTI: Record<string, string> = {
  nuovi: "First-timers",
  abituali: "Regulars",
  grandi: "Big spenders",
  inattivi: "Gone quiet",
}

/** La regola nasce qui: gli importi passano sempre dal formattatore della valuta. */
export function regolaSegmento(chiave: string, r: DatiSegmenti["regole"], casa: string | null) {
  const regole: Record<string, string> = {
    nuovi: `Joined in the last ${r.giorni_nuovo} days`,
    abituali: `${r.ordini_abituale} or more orders`,
    grandi: `Spent ${euro(r.spesa_grande)} or more`,
    newsletter: "Said yes to emails",
    locali: casa ? `Living in ${casa}` : "No town yet",
    inattivi: `No order in ${r.giorni_inattivo} days`,
  }
  return regole[chiave] ?? ""
}

export const PAESI = ["it", "at", "be", "ch", "de", "es", "fr", "gb", "nl", "pt", "us"]

const NOMI_PAESI = new Intl.DisplayNames(["en-GB"], { type: "region" })

export const nomePaese = (codice: string | null) => {
  if (!codice) return ""
  try {
    return NOMI_PAESI.of(codice.toUpperCase()) ?? codice
  } catch {
    return codice
  }
}

export const nomeCompleto = (c: { nome: string | null; cognome: string | null; email?: string | null }) =>
  [c.nome, c.cognome].filter(Boolean).join(" ") || c.email || "Unnamed customer"

export const iniziali = (c: { nome: string | null; cognome: string | null; email?: string | null }) => {
  const parti = [c.nome, c.cognome].filter(Boolean) as string[]
  const lettere = parti.length > 1 ? parti.map((p) => p[0]).join("") : (parti[0] ?? c.email ?? "?").slice(0, 2)
  return lettere.toUpperCase()
}

/** Sempre lo stesso colore per la stessa persona. */
export const tonoIniziali = (id: string) => [...id].reduce((somma, c) => somma + c.charCodeAt(0), 0) % 6

export const lineaIndirizzo = (i: Indirizzo) =>
  [
    [i.indirizzo, i.indirizzo_2].filter(Boolean).join(", "),
    [i.cap, i.citta, i.provincia ? `(${i.provincia})` : ""].filter(Boolean).join(" "),
    nomePaese(i.paese),
  ]
    .filter(Boolean)
    .join(" · ")

export function useAggiornaClienti() {
  const client = useQueryClient()
  return useCallback(() => client.invalidateQueries({ queryKey: ["clienti"] }), [client])
}

const GIORNO_MESE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })
const GIORNO_MESE_ANNO = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
const GIORNO_SETTIMANA = new Intl.DateTimeFormat("en-GB", { weekday: "short" })

const mezzanotte = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const orario = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`

/** Le date recenti si leggono come tempo trascorso, le altre come giorno: l'anno solo quando serve. */
export function quandoBreve(valore: string, adesso = new Date()): string {
  const data = new Date(valore)
  const giorni = Math.round((mezzanotte(adesso) - mezzanotte(data)) / 86_400_000)
  if (giorni <= 0) {
    const ore = Math.floor((adesso.getTime() - data.getTime()) / 3_600_000)
    return ore < 1 ? "Just now" : `${ore} h ago`
  }
  if (giorni === 1) return `Yesterday, ${orario(data)}`
  if (giorni < 7) return `${GIORNO_SETTIMANA.format(data)}, ${orario(data)}`
  return (giorni > 300 ? GIORNO_MESE_ANNO : GIORNO_MESE).format(data)
}
