export type Negozio = {
  nome: string
  email: string
  telefono: string
  indirizzo: string
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

export type RispostaSpedizioni = { regole: { giorni_max_evasione: number | null; soglia_gratuita: number | null }; opzioni: Opzione[] }

export type FonteAvvisi = { id: string; etichetta: string; descrizione: string; attiva: boolean }

export type Conteggi = { ordini: number; prodotti: number; aziende: number; clienti: number }

export type Tabella = {
  intestazioni: string[]
  righe: (string | number | boolean | null)[][]
  dati: unknown[]
}

/** Dal campo di testo all'importo: vuoto vale «non impostato». */
export const importoDa = (testo: string) => (testo.trim() === "" ? null : Number(testo.replace(",", ".")))

export const testoDa = (valore: number | null) => (valore === null ? "" : String(valore))

/** Simbolo di una valuta, ricavato dal formattatore: non è mai scritto a mano nel codice. */
export const simboloDi = (codice: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: codice }).formatToParts(0).find((p) => p.type === "currency")?.value ?? codice
