export type Fase = "richiesta" | "trattativa" | "campione" | "accordo" | "perso"

export type Rivenditore = {
  id: string
  nome: string
  referente: string | null
  email: string | null
  telefono: string | null
  partita_iva: string | null
  indirizzo: string | null
  citta: string | null
  cap: string | null
  paese: string
  condizione: "listino" | "sconto"
  listino: string | null
  sconto_percentuale: number | null
  pagamento: string | null
  ordine_minimo: number | null
  appunti: string | null
  trattative: number
  trattative_aperte: number
  valore_aperto: number
}

export type Trattativa = {
  id: string
  titolo: string
  fase: Fase
  posizione: number
  valore_stimato: number | null
  ordine_id: string | null
  creata_il: string
  rivenditore: { id: string; nome: string; citta: string | null }
}

export type Nota = { id: string; testo: string; autore: string; quando: string }
export type TrattativaConNote = Trattativa & { note: Nota[] }

export type RequisitiOrdine = {
  mancanti: string[]
  avvisi: string[]
  regioni: { id: string; nome: string; valuta: string }[]
  canali: { id: string; nome: string }[]
  condizioni: {
    condizione: Rivenditore["condizione"]
    listino: string | null
    sconto_percentuale: number | null
    pagamento: string | null
    ordine_minimo: number | null
  }
  ordine: { id: string; numero: number; stato: string } | null
}

export type Variante = { id: string; titolo: string; sku: string | null; prezzo: number | null }
