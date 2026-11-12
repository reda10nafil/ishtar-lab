export type OffertaTaglia = { id: string; azienda: string; prezzo: number; disponibili: number }
export type Taglia = { id: string; titolo: string; offerte: OffertaTaglia[] }

export type Prodotto = {
  id: string
  titolo: string
  foto: string | null
  categorie: { id: string; nome: string }[]
  prezzo_min: number
  prezzo_max: number
  disponibili: number
  taglie: Taglia[]
}

export type StatoCassa = {
  mancanti: string[]
  prodotti: Prodotto[]
  oggi: { vendite: number; incassato: number }
  indirizzo: string
}

export type Conto = { subtotale: number; sconto: number; iva: number | null; totale: number; codice: string | null }

export type RigaCestino = {
  offerta_id: string
  prodotto_id: string
  titolo: string
  taglia: string
  azienda: string
  foto: string | null
  prezzo: number
  quantita: number
  disponibili: number
}

export type Cliente = { id: string; email: string; nome: string }

export type Metodo = "contanti" | "carta"

export type Vendita = {
  id: string
  numero: number
  data: string
  negozio: string
  indirizzo: string
  cliente: { nome: string; email: string } | null
  righe: { prodotto: string; taglia: string; quantita: number; totale: number }[]
  subtotale: number
  sconto: number
  codice: string | null
  iva: number | null
  totale: number
  metodo: Metodo
  ricevuto: number
  resto: number
}
