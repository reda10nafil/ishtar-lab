export type TipoSconto = "percentuale" | "importo" | "spedizione"
export type StatoSconto = "attivo" | "programmato" | "in_pausa" | "terminato"

export type Codice = {
  id: string
  codice: string
  descrizione: string | null
  tipo: TipoSconto
  valore: number | null
  limite_usi: number | null
  usi: number
  inizio: string | null
  fine: string | null
  stato: StatoSconto
  prodotti: number
  azienda: string | null
  proposta_id: string | null
  creato_il: string
}

export type ElencoCodici = { codici: Codice[]; conteggio: number; conteggi: Record<"tutti" | StatoSconto, number> }

export type StatoCarta = "attiva" | "esaurita" | "scaduta" | "annullata" | "congelata"

export type Carta = {
  id: string
  codice: string
  importo_iniziale: number
  saldo: number
  valuta: string
  scadenza: string | null
  stato: StatoCarta
  destinatario_nome: string | null
  destinatario_email: string | null
  nota: string | null
  annullata_il: string | null
  motivo_annullamento: string | null
  creata_il: string
}

export type TipoMovimento = "emissione" | "rettifica" | "annullamento"
export type Movimento = { id: string; tipo: TipoMovimento; importo: number; saldo_dopo: number; nota: string | null; attore: string; quando: string }
export type CartaCompleta = Carta & { movimenti: Movimento[] }
export type ElencoCarte = { carte: Carta[]; conteggio: number; conteggi: Record<"tutte" | StatoCarta, number>; saldo_attivo: number }
export type Cliente = { id: string; nome: string; email: string }

export type StatoProposta = "in_attesa" | "approvata" | "rifiutata"

export type Proposta = {
  id: string
  titolo: string
  tipo: "percentuale" | "importo"
  valore: number
  inizio: string
  fine: string
  motivo: string
  prodotti: string[]
  stato: StatoProposta
  nota: string | null
  codice: string | null
  stato_sconto: StatoSconto | "eliminato" | null
  creata_il: string
  decisa_il: string | null
  azienda?: string
  deciso_da?: string | null
}

export type ElencoProposte = { proposte: Proposta[]; in_attesa?: number }
