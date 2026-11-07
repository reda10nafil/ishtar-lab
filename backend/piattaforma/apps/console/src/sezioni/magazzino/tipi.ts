export type StatoScorta = "disponibile" | "esaurimento" | "esaurito"

export type Riga = {
  id: string
  articolo_id: string
  deposito_id: string
  deposito: string
  azienda_id: string
  azienda: string
  sku: string | null
  prodotto: string | null
  prodotto_id: string | null
  variante: string | null
  miniatura: string | null
  giacenza: number
  riservate: number
  in_arrivo: number
  disponibili: number
  soglia: number
  origine_soglia: "articolo" | "azienda" | "predefinita"
  stato: StatoScorta
  ultimo_conteggio: string | null
  costo_unitario: number | null
  valore: number | null
}

export type Riepilogo = {
  articoli: number
  giacenza: number
  disponibili: number
  riservate: number
  in_esaurimento: number
  esauriti: number
  valore: number | null
  senza_costo: number | null
}

export type Deposito = { id: string; nome: string; citta: string | null; azienda_id: string | null; azienda: string | null }

export type ElencoScorte = {
  righe: Riga[]
  conteggio: number
  riepilogo: Riepilogo
  soglia_predefinita: number
  vede_valore: boolean
  depositi: Deposito[]
  aziende?: { id: string; nome: string }[]
}

export type Movimento = {
  id: string
  quando: string
  chi: string
  tipo: "correzione" | "conteggio"
  prima: number
  dopo: number
  differenza: number
  motivo: string | null
  nota: string | null
  articolo_id: string
  sku: string | null
  prodotto: string | null
  variante: string | null
  deposito: string
  azienda: string
}

export type ElencoMovimenti = { movimenti: Movimento[]; conteggio: number }

export type Riserva = {
  id: string
  articolo_id: string
  sku: string | null
  prodotto: string | null
  variante: string | null
  azienda_id: string
  azienda: string
  deposito_id: string
  deposito: string
  quantita: number
  origine: "ordine" | "manuale"
  descrizione: string | null
  creata_il: string
}

export type ElencoRiserve = { riserve: Riserva[]; conteggio: number; unita: number }

export type Scheda = {
  livelli: Riga[]
  soglia_articolo: number | null
  riserve: Riserva[]
  movimenti: Movimento[]
  vede_valore: boolean
}

export type SoglieAzienda = { id: string; nome: string; soglia: number | null; articoli: number; sotto_soglia: number }

export type Soglie = { soglia_predefinita: number; aziende: SoglieAzienda[]; articoli: Riga[] }
