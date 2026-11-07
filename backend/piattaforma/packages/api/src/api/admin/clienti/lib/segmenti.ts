/**
 * Regole dei segmenti, senza dipendenze: si provano anche con ordini di esempio,
 * che non vanno mai creati nel database che l'utente guarda.
 */
export const REGOLE = { giorni_nuovo: 30, ordini_abituale: 2, spesa_grande: 500, giorni_inattivo: 90 }

const GIORNO = 86_400_000

export type OrdineCliente = {
  id: string
  display_id?: number | null
  customer_id?: string | null
  status?: string | null
  is_draft_order?: boolean | null
  total?: unknown
  currency_code?: string | null
  created_at: string | Date
}

export type Statistiche = { ordini: number; speso: number; ultimo_ordine: string | null }

/** Bozze e ordini annullati non sono acquisti. */
export const ordineValido = (ordine: OrdineCliente) =>
  !ordine.is_draft_order && ordine.status !== "draft" && ordine.status !== "canceled"

/** La spesa somma solo gli ordini in euro: importi in altre valute non sono confrontabili. */
export function statistiche(ordini: OrdineCliente[]): Statistiche {
  const validi = ordini.filter(ordineValido)
  const date = validi.map((o) => new Date(o.created_at).toISOString()).sort()
  return {
    ordini: validi.length,
    speso: validi.filter((o) => o.currency_code === "eur").reduce((totale, o) => totale + Number(o.total ?? 0), 0),
    ultimo_ordine: date.at(-1) ?? null,
  }
}

export type Appartenenze = { nuovo: boolean; abituale: boolean; grande: boolean; inattivo: boolean }

export function appartenenze(creatoIl: string | Date, dati: Statistiche, adesso = new Date()): Appartenenze {
  const giorniDa = (data: string | Date) => (adesso.getTime() - new Date(data).getTime()) / GIORNO
  const iscritto = giorniDa(creatoIl)
  return {
    nuovo: iscritto <= REGOLE.giorni_nuovo,
    abituale: dati.ordini >= REGOLE.ordini_abituale,
    grande: dati.speso >= REGOLE.spesa_grande,
    inattivo:
      iscritto > REGOLE.giorni_inattivo &&
      (dati.ultimo_ordine === null || giorniDa(dati.ultimo_ordine) > REGOLE.giorni_inattivo),
  }
}

export const SEGMENTI = ["nuovi", "abituali", "grandi", "inattivi"] as const
export type Segmento = (typeof SEGMENTI)[number]

export const CAMPO_SEGMENTO: Record<Segmento, keyof Appartenenze> = {
  nuovi: "nuovo",
  abituali: "abituale",
  grandi: "grande",
  inattivi: "inattivo",
}

/** Il testo della regola lo compone l'interfaccia: gli importi passano dal formattatore della valuta. */
export const SEGMENTI_DESCRITTI: { chiave: Segmento; nome: string }[] = [
  { chiave: "abituali", nome: "Regulars" },
  { chiave: "grandi", nome: "Big spenders" },
  { chiave: "nuovi", nome: "New customers" },
  { chiave: "inattivi", nome: "Gone quiet" },
]
