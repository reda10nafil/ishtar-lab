import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useReducer } from "react"
import { api } from "../../api/client"
import { euro } from "../../ui"
import type { Conto, Prodotto, RigaCestino, StatoCassa, Taglia } from "./tipi"

export const CHIAVE_CASSA = ["cassa", "stato"]

export const useStatoCassa = () => useQuery({ queryKey: CHIAVE_CASSA, queryFn: () => api<StatoCassa>("/admin/cassa") })

const percorsoConto = (righe: RigaCestino[], codice: string | null) => {
  const parametri = new URLSearchParams()
  for (const riga of righe) parametri.append("riga", `${riga.offerta_id}:${riga.quantita}`)
  if (codice) parametri.set("codice", codice)
  return `/admin/cassa/anteprima?${parametri}`
}

export const leggiConto = (righe: RigaCestino[], codice: string | null) => api<Conto>(percorsoConto(righe, codice))

/** Il conto viene sempre dal server. `in corso` blocca l'incasso finché il totale non è aggiornato. */
export function useConto(righe: RigaCestino[], codice: string | null) {
  const firma = righe.map((r) => `${r.offerta_id}:${r.quantita}`).join(",")
  return useQuery({
    queryKey: ["cassa", "conto", firma, codice],
    queryFn: () => leggiConto(righe, codice),
    enabled: righe.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: false,
    retry: false,
  })
}

type Azione =
  | { tipo: "aggiungi"; riga: Omit<RigaCestino, "quantita"> }
  | { tipo: "quantita"; offerta_id: string; variazione: number }
  | { tipo: "svuota" }

function cestino(stato: RigaCestino[], azione: Azione): RigaCestino[] {
  if (azione.tipo === "svuota") return []
  if (azione.tipo === "aggiungi") {
    const presente = stato.some((r) => r.offerta_id === azione.riga.offerta_id)
    if (!presente) return [...stato, { ...azione.riga, quantita: 1 }]
    return stato.map((r) => (r.offerta_id === azione.riga.offerta_id ? { ...r, quantita: Math.min(r.quantita + 1, r.disponibili) } : r))
  }
  return stato
    .map((r) => (r.offerta_id === azione.offerta_id ? { ...r, quantita: Math.min(r.quantita + azione.variazione, r.disponibili) } : r))
    .filter((r) => r.quantita > 0)
}

export function useCestino() {
  const [righe, invia] = useReducer(cestino, [])
  const aggiungi = useCallback((riga: Omit<RigaCestino, "quantita">) => invia({ tipo: "aggiungi", riga }), [])
  const cambia = useCallback((offerta_id: string, variazione: number) => invia({ tipo: "quantita", offerta_id, variazione }), [])
  const svuota = useCallback(() => invia({ tipo: "svuota" }), [])
  const pezzi = useMemo(() => righe.reduce((totale, r) => totale + r.quantita, 0), [righe])
  return { righe, pezzi, aggiungi, cambia, svuota }
}

/** Tutte le offerte di un prodotto, dalla più conveniente con scorte. */
const offerteOrdinate = (taglia: Taglia) => [...taglia.offerte].sort((a, b) => Number(b.disponibili > 0) - Number(a.disponibili > 0) || a.prezzo - b.prezzo)

export const primaOfferta = (taglia: Taglia) => offerteOrdinate(taglia)[0]

/** Con una sola scelta possibile il prodotto entra subito nel cestino, senza chiedere la taglia. */
export function sceltaUnica(prodotto: Prodotto) {
  const vendibili = prodotto.taglie.flatMap((t) => t.offerte.filter((o) => o.disponibili > 0).map((offerta) => ({ taglia: t, offerta })))
  return vendibili.length === 1 ? vendibili[0] : null
}

export const voceDa = (prodotto: Prodotto, taglia: Taglia, offerta: Taglia["offerte"][number]): Omit<RigaCestino, "quantita"> => ({
  offerta_id: offerta.id,
  prodotto_id: prodotto.id,
  titolo: prodotto.titolo,
  taglia: taglia.titolo,
  azienda: offerta.azienda,
  foto: prodotto.foto,
  prezzo: offerta.prezzo,
  disponibili: offerta.disponibili,
})

/** Le iniziali sostituiscono la foto quando manca. */
export const iniziali = (titolo: string) =>
  titolo
    .split(/\s+/)
    .slice(0, 2)
    .map((parola) => parola[0])
    .join("")
    .toUpperCase()

/** Banconote proposte: importo esatto, poi i multipli di 5, 10 e 20 che lo coprono. */
export function tagliRapidi(totale: number) {
  const esatto = Math.ceil(totale)
  return [...new Set([esatto, ...[5, 10, 20].map((taglio) => Math.ceil(esatto / taglio) * taglio)])]
}

/** Gli importi tondi si leggono senza centesimi: £70, non £70.00. */
export const importoBreve = (valore: number) => euro(valore).replace(/[.,]00$/, "")
