import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import type { Stato } from "../../lingua"
import { useSessione } from "../../sessione"
import type { Riga } from "./tipi"

export const PER_PAGINA = 20

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

const ATTESA_CONTATORE = 400

/**
 * Il contatore risponde al primo tocco: le unità si sommano e partono insieme quando ci si ferma.
 * La riga mostra subito il numero nuovo, senza aspettare il server.
 */
export function useContatori(base: string) {
  const aggiorna = useAggiornaMagazzino()
  const { segnalaErrore } = useAvvisi()
  const [attese, setAttese] = useState<Record<string, number>>({})
  const pendenti = useRef<Record<string, number>>({})
  const timer = useRef<Record<string, number>>({})

  const cambia = useCallback(
    (riga: Riga, unita: number) => {
      pendenti.current[riga.id] = (pendenti.current[riga.id] ?? 0) + unita
      setAttese((a) => ({ ...a, [riga.id]: (a[riga.id] ?? 0) + unita }))
      window.clearTimeout(timer.current[riga.id])
      timer.current[riga.id] = window.setTimeout(async () => {
        const variazione = pendenti.current[riga.id] ?? 0
        pendenti.current[riga.id] = 0
        if (!variazione) return
        try {
          await api(`${base}/articoli/${riga.articolo_id}/correzione`, { corpo: { deposito_id: riga.deposito_id, variazione, motivo: "rettifica" } })
          await aggiorna()
        } catch (errore) {
          segnalaErrore(errore)
        }
        setAttese((a) => ({ ...a, [riga.id]: (a[riga.id] ?? 0) - variazione }))
      }, ATTESA_CONTATORE)
    },
    [aggiorna, base, segnalaErrore]
  )

  return { attesa: (riga: Riga) => attese[riga.id] ?? 0, cambia }
}
