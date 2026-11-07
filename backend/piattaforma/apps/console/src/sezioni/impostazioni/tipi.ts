export type Indirizzo = { via: string; cap: string; citta: string; provincia: string; paese: string }

export type Negozio = {
  nome: string
  email: string
  telefono: string
  indirizzo: Indirizzo
  partita_iva: string
  fuso: string
  obiettivo_giornaliero: number | null
  valuta: string
  prezzi_con_iva: boolean
}

export type Valuta = { codice: string; nome: string }
export type RispostaNegozio = { negozio: Negozio; valute: Valuta[] }

export type Opzione = {
  id: string
  nome: string
  azienda: string | null
  zona: string | null
  tipo: string | null
  tariffa: number | null
  soglia_gratuita: number | null
  attiva: boolean
}

export type RispostaSpedizioni = { regole: { giorni_max_evasione: number | null }; opzioni: Opzione[] }

export type FonteAvvisi = { id: string; etichetta: string; descrizione: string; attiva: boolean }

export type Conteggi = { prodotti: number; aziende: number; clienti: number }

export type Tabella = {
  intestazioni: string[]
  righe: (string | number | boolean | null)[][]
  dati: unknown[]
}

/** Dal campo di testo all'importo: vuoto vale «non impostato». */
export const importoDa = (testo: string) => (testo.trim() === "" ? null : Number(testo.replace(",", ".")))

export const testoDa = (valore: number | null) => (valore === null ? "" : String(valore))
