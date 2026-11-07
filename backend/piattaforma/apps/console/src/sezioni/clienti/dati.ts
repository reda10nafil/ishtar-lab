import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { euro } from "../../ui"
import type { DatiSegmenti, Filtro, Indirizzo } from "./tipi"

export const PER_PAGINA = 25

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
  nuovi: "New customers",
  abituali: "Regulars",
  grandi: "Big spenders",
  inattivi: "Gone quiet",
}

/** La regola nasce qui: gli importi passano sempre dal formattatore della valuta. */
export function regolaSegmento(chiave: string, r: DatiSegmenti["regole"]) {
  const regole: Record<string, string> = {
    nuovi: `Joined in the last ${r.giorni_nuovo} days`,
    abituali: `${r.ordini_abituale} or more orders`,
    grandi: `Spent ${euro(r.spesa_grande)} or more`,
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
