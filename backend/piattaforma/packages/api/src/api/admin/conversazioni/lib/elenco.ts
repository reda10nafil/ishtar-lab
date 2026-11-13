import { invalido } from "../../../utili"
import { CANALI, type Canale } from "../../../../modules/conversazioni/tipi"

/*
 * Elenco della casella dei clienti: filtri della richiesta (verificati in __tests__/elenco.unit.spec.ts) e forma delle
 * righe e dei messaggi restituiti al pannello.
 */

export type FiltriElenco = { stato: "aperte" | "chiuse"; canale: Canale | null; q: string | null; limit: number; offset: number }

const intero = (valore: unknown, predefinito: number) => {
  const n = Number.parseInt(String(valore ?? ""), 10)
  return Number.isFinite(n) ? n : predefinito
}

export function filtriElenco(query: Record<string, unknown>): FiltriElenco {
  const stato = query.stato ?? "aperte"
  if (stato !== "aperte" && stato !== "chiuse") throw invalido("Unknown status: use aperte or chiuse")
  const canale = query.canale ? String(query.canale) : null
  if (canale && !CANALI.includes(canale as Canale)) throw invalido("Unknown channel")
  const q = typeof query.q === "string" && query.q.trim() ? query.q.trim() : null
  return {
    stato,
    canale: canale as Canale | null,
    q,
    limit: Math.min(200, Math.max(1, intero(query.limit, 50))),
    offset: Math.max(0, intero(query.offset, 0)),
  }
}

type IdentitaLetta = { id: string; canale: string; nome: string | null; recapito: string | null; cliente_id: string | null }
type ConversazioneLetta = {
  id: string
  canale: string
  stato: string
  oggetto: string | null
  ultimo_estratto: string
  non_letti: number
  ultimo_messaggio_il: Date | string
  identita?: IdentitaLetta | null
}

export const rigaConversazione = (c: ConversazioneLetta) => ({
  id: c.id,
  canale: c.canale,
  stato: c.stato,
  nome: c.identita?.nome ?? null,
  recapito: c.identita?.recapito ?? null,
  estratto: c.ultimo_estratto,
  oggetto: c.oggetto ?? null,
  non_letti: c.non_letti,
  ultimo_messaggio_il: c.ultimo_messaggio_il,
  cliente_id: c.identita?.cliente_id ?? null,
})

export const vistaIdentita = (i: IdentitaLetta) => ({ id: i.id, canale: i.canale, nome: i.nome, recapito: i.recapito, cliente_id: i.cliente_id })

type MessaggioLetto = { id: string; direzione: string; testo: string; quando: Date | string; stato_consegna: string; errore: string | null; autore_nome: string | null }

export const vistaMessaggio = (m: MessaggioLetto) => ({
  id: m.id,
  direzione: m.direzione,
  testo: m.testo,
  quando: m.quando,
  stato_consegna: m.stato_consegna,
  errore: m.errore,
  autore_nome: m.autore_nome,
})

/** Testo cercato con ILIKE: `%` e `_` scritti dall'utente valgono come caratteri, non come jolly. */
export const simile = (q: string) => ({ $ilike: `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` })
