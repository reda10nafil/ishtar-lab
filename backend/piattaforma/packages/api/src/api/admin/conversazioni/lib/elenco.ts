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

type MessaggioLetto = {
  id: string
  direzione: string
  testo: string
  quando: Date | string
  stato_consegna: string
  errore: string | null
  autore_nome: string | null
  chiave_unica?: string | null
  dettagli?: unknown
}

const USCITA = "uscita:"
const VERIFICHE = new Set(["verificato", "non_verificato", "sconosciuto"])
const testoO = (valore: unknown) => (typeof valore === "string" ? valore : null)
const allegato = (a: unknown): a is { nome: string; byte: number } => {
  const x = a as { nome?: unknown; byte?: unknown } | null
  return !!x && typeof x === "object" && typeof x.nome === "string" && typeof x.byte === "number" && Number.isFinite(x.byte) && x.byte >= 0
}

/**
 * Dettagli di un'email per il pannello: oggetto, indirizzo di risposta chiesto (solo da mostrare), verifica del mittente,
 * allegati e testo intero con le citazioni. Le intestazioni del filo (Message-ID, In-Reply-To, References) restano nel
 * server. Dal JSON salvato si leggono solo i campi con il tipo giusto.
 */
function vistaEmail(dettagli: unknown) {
  if (!dettagli || typeof dettagli !== "object" || Array.isArray(dettagli)) return null
  const d = dettagli as Record<string, unknown>
  return {
    oggetto: testoO(d.oggetto),
    reply_to: testoO(d.reply_to),
    verifica: typeof d.verifica === "string" && VERIFICHE.has(d.verifica) ? d.verifica : null,
    allegati: Array.isArray(d.allegati) ? d.allegati.filter(allegato).map((a) => ({ nome: a.nome, byte: a.byte })) : [],
    testo_completo: testoO(d.testo_completo),
  }
}

/**
 * `id_client`: l'id che il pannello ha dato alla risposta. Con questo il pannello riconosce la propria risposta nella
 * conversazione riletta e la ritenta con lo stesso id. La chiave dei messaggi in arrivo non si espone. `email`: solo per
 * i messaggi con i dettagli di un'email.
 */
export const vistaMessaggio = (m: MessaggioLetto) => {
  const email = vistaEmail(m.dettagli)
  return {
    id: m.id,
    direzione: m.direzione,
    testo: m.testo,
    quando: m.quando,
    stato_consegna: m.stato_consegna,
    errore: m.errore,
    autore_nome: m.autore_nome,
    id_client: m.direzione === "uscita" && m.chiave_unica?.startsWith(USCITA) ? m.chiave_unica.slice(USCITA.length) : null,
    ...(email ? { email } : {}),
  }
}

/** Testo cercato con ILIKE: `%` e `_` scritti dall'utente valgono come caratteri, non come jolly. */
export const simile = (q: string) => ({ $ilike: `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` })
