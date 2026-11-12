export type CampoConnettore = {
  chiave: string
  etichetta: string
  segreto: boolean
  segnaposto: string | null
  aiuto: string | null
  facoltativo: boolean
  impostato: boolean
  valore: string | null
}

export type StatoConnettore = "non_collegato" | "da_collegare" | "collegato" | "errore"

export type Connettore = {
  id: string
  nome: string
  fornitore: string
  categoria: string
  descrizione: string
  accesso: "login" | "chiave"
  documentazione: string
  iscrizione: string | null
  fase: "vendite" | null
  confermato: boolean
  ambiti: string[]
  indirizzo_ritorno: string | null
  richiede_dominio: boolean
  campi: CampoConnettore[]
  stato: StatoConnettore
  account: string | null
  ultimo_controllo: string | null
  scadenza: string | null
  errore: string | null
}

export type EsitoProva = { ok: true; account?: string } | { ok: false; errore: string }

export type Azienda = {
  id: string
  name: string
  email: string
  status: string
  created_at: string
}

export type Prodotto = {
  id: string
  title: string
  status: string
  thumbnail: string | null
  description?: string | null
  created_at?: string
  variants?: { id: string; title: string; sku: string | null }[]
}

export type ModificaProdotto = {
  id: string
  product_id: string
  status: string
  type: string
  product_title: string
  product_thumbnail: string | null
  seller_name: string | null
  created_at: string
}

export type Ordine = {
  id: string
  display_id: number
  status: string
  total?: number
  currency_code?: string
  created_at: string
}

export type RuoloProfilo = { id: string; etichetta: string; descrizione: string }
