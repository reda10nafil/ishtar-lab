import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useOutletContext } from "react-router-dom"
import { numero, STATI_EVASIONE, stato, type Stato } from "../../lingua"
import type { TonoPillola } from "./Pezzi"
import type { AzioneEvasione, Canale, FaseReso, Filtro, StatoRichiesta } from "./tipi"

export const PASSO = 25

export const FILTRI: { valore: Filtro; testo: string }[] = [
  { valore: "tutti", testo: "All" },
  { valore: "da_preparare", testo: "To pack" },
  { valore: "preparati", testo: "Packed" },
  { valore: "spediti", testo: "Shipped" },
  { valore: "consegnati", testo: "Delivered" },
  { valore: "non_pagati", testo: "Unpaid" },
  { valore: "rimborsati", testo: "Refunded" },
]

export const CANALI: { valore: Canale; testo: string }[] = [
  { valore: "online", testo: "Online" },
  { valore: "cassa", testo: "Shop" },
  { valore: "ingrosso", testo: "Wholesale" },
]

export const NOME_CANALE: Record<Canale, string> = { online: "Online shop", cassa: "Shop till", ingrosso: "Wholesale" }

const TONI_EVASIONE: Record<string, TonoPillola> = {
  not_fulfilled: "errore",
  partially_fulfilled: "errore",
  fulfilled: "attesa",
  partially_shipped: "attesa",
  shipped: "info",
  partially_delivered: "info",
  delivered: "ok",
  canceled: "neutro",
  collected: "neutro",
}

export const evasioneDi = (valore: string): { testo: string; tono: TonoPillola } => ({ testo: valore === "collected" ? "Collected" : stato(STATI_EVASIONE, valore).testo, tono: TONI_EVASIONE[valore] ?? "neutro" })

export const STATI_RICHIESTA: Record<StatoRichiesta, { testo: string; tono: TonoPillola }> = {
  da_confermare: { testo: "To confirm", tono: "errore" },
  confermata: { testo: "To pack", tono: "errore" },
  preparata: { testo: "Packed", tono: "attesa" },
  spedita: { testo: "Shipped", tono: "info" },
  consegnata: { testo: "Delivered", tono: "ok" },
  annullata: { testo: "Cancelled", tono: "neutro" },
}

export const PASSI: Record<AzioneEvasione, string> = {
  conferma: "Confirm",
  prepara: "Mark packed",
  spedisci: "Mark shipped",
  consegna: "Mark delivered",
  riapri: "Undo packing",
}

export const prossimaAzione = (stato: StatoRichiesta): AzioneEvasione | null => {
  if (stato === "da_confermare") return "conferma"
  if (stato === "confermata") return "prepara"
  if (stato === "preparata") return "spedisci"
  return stato === "spedita" ? "consegna" : null
}

export const STATI_RESO: Record<FaseReso, Stato> = {
  richiesto: { testo: "Requested", tono: "attesa" },
  approvato: { testo: "Approved", tono: "attesa" },
  ricevuto: { testo: "Received", tono: "attesa" },
  rimborsato: { testo: "Refunded", tono: "ok" },
  annullato: { testo: "Cancelled", tono: "neutro" },
}

const ORA = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" })
const GIORNO = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })

const stessoGiorno = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/** Oggi e ieri a parole, poi giorno e mese: sempre con l'ora. */
export function quando(valore: string) {
  const data = new Date(valore)
  const adesso = new Date()
  const ieri = new Date(adesso.getTime() - 86_400_000)
  const giorno = stessoGiorno(data, adesso) ? "Today" : stessoGiorno(data, ieri) ? "Yesterday" : GIORNO.format(data)
  return `${giorno}, ${ORA.format(data)}`
}

export const giorno = (valore: string) => GIORNO.format(new Date(valore))

/** Per `Cifra`: mentre sale il numero resta intero. */
export const intero = (valore: number) => numero(Math.round(valore))

export const iniziali = (testo: string) =>
  testo
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "–"

export const lineaIndirizzo = (i: { indirizzo?: string | null; indirizzo_2?: string | null; cap?: string | null; citta?: string | null; provincia?: string | null; paese?: string | null }) =>
  [[i.indirizzo, i.indirizzo_2].filter(Boolean).join(", "), [i.cap, i.citta, i.provincia].filter(Boolean).join(" "), i.paese?.toUpperCase()].filter(Boolean).join(", ")

/** Tutte le pagine degli ordini leggono sotto la chiave `ordini`: dopo un'azione si aggiornano insieme. */
export function useAggiorna() {
  const client = useQueryClient()
  return useCallback(() => client.invalidateQueries({ queryKey: ["ordini"] }), [client])
}

export type Contesto = { esporta: { current: (() => void) | null } }

export const useGuscio = () => useOutletContext<Contesto>()
