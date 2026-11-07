export type GruppoBreve = { id: string; nome: string | null }

export type Cliente = {
  id: string
  email: string | null
  nome: string | null
  cognome: string | null
  azienda: string | null
  telefono: string | null
  registrato: boolean
  newsletter: boolean
  newsletter_data: string | null
  rivenditore: boolean
  note: string | null
  creato_il: string
  citta: string | null
  gruppi: GruppoBreve[]
  ordini: number
  speso: number
  ultimo_ordine: string | null
  nuovo: boolean
  abituale: boolean
  grande: boolean
  inattivo: boolean
}

export type Filtro = "tutti" | "abituali" | "nuovi" | "newsletter" | "rivenditori"

export type ElencoClienti = { clienti: Cliente[]; conteggio: number; conteggi: Record<Filtro, number> }

export type Indirizzo = {
  id: string
  etichetta: string | null
  nome: string | null
  cognome: string | null
  azienda: string | null
  indirizzo: string | null
  indirizzo_2: string | null
  citta: string | null
  provincia: string | null
  cap: string | null
  paese: string | null
  telefono: string | null
  predefinito_spedizione: boolean
  predefinito_fatturazione: boolean
}

export type OrdineCliente = {
  id: string
  numero: number | null
  stato: string | null
  bozza: boolean
  totale: number
  valuta: string | null
  creato_il: string
}

export type SchedaCliente = { cliente: Cliente; indirizzi: Indirizzo[]; ordini: OrdineCliente[] }

export type Membro = { id: string; email: string | null; nome: string | null; cognome: string | null }

export type Gruppo = { id: string; nome: string | null; creato_il: string; membri: Membro[] }

export type DatiSegmenti = {
  totale: number
  regole: { giorni_nuovo: number; ordini_abituale: number; spesa_grande: number; giorni_inattivo: number }
  segmenti: {
    chiave: string
    nome: string
    conteggio: number
    media: number | null
    anteprima: { id: string; nome: string | null; cognome: string | null; email: string | null }[]
  }[]
  citta: { nome: string; conteggio: number }[]
  gruppi: { id: string; nome: string | null; conteggio: number }[]
}
