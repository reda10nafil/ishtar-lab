import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import type { Stato } from "../../lingua"
import { useSessione } from "../../sessione"

export const PER_PAGINA = 25

export const STATI_SCORTA: Record<string, Stato> = {
  disponibile: { testo: "In stock", tono: "ok" },
  esaurimento: { testo: "Low stock", tono: "attesa" },
  esaurito: { testo: "Out of stock", tono: "errore" },
}

export const TIPI_MOVIMENTO: Record<string, Stato> = {
  correzione: { testo: "Adjustment", tono: "neutro" },
  conteggio: { testo: "Stock count", tono: "attesa" },
}

export const MOTIVI = [
  { valore: "rifornimento", testo: "Restock" },
  { valore: "reso", testo: "Return" },
  { valore: "danneggiato", testo: "Damaged" },
  { valore: "smarrito", testo: "Lost" },
  { valore: "rettifica", testo: "Correction" },
  { valore: "altro", testo: "Other" },
]

export const testoMotivo = (valore: string | null) => MOTIVI.find((m) => m.valore === valore)?.testo ?? "–"

export const ORIGINI_SOGLIA: Record<string, string> = {
  articolo: "Set on this item",
  azienda: "Company level",
  predefinita: "Default",
}

/** Stessa pagina per i due profili: cambia solo l'indirizzo, il limite lo mette il server. */
export function useMagazzino() {
  const { sessione } = useSessione()
  const admin = sessione?.tipo === "admin"
  return { admin, base: admin ? "/admin/magazzino" : "/vendor/magazzino" }
}

export function useAggiornaMagazzino() {
  const client = useQueryClient()
  return useCallback(() => client.invalidateQueries({ queryKey: ["magazzino"] }), [client])
}

export function interrogazione(valori: Record<string, string | number | undefined>) {
  const parametri = new URLSearchParams()
  for (const [chiave, valore] of Object.entries(valori)) {
    if (valore !== undefined && valore !== "") parametri.set(chiave, String(valore))
  }
  return parametri.toString()
}

/** Evita una richiesta a ogni lettera digitata nella ricerca. */
export function useRitardato<T>(valore: T, attesa = 250) {
  const [ritardato, setRitardato] = useState(valore)
  useEffect(() => {
    const timer = setTimeout(() => setRitardato(valore), attesa)
    return () => clearTimeout(timer)
  }, [valore, attesa])
  return ritardato
}
