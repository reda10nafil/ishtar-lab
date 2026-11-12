export type Canale = "online" | "cassa" | "ingrosso"
export type Filtro = "tutti" | "da_preparare" | "preparati" | "spediti" | "consegnati" | "non_pagati" | "rimborsati"
export type StatoRichiesta = "da_confermare" | "confermata" | "preparata" | "spedita" | "consegnata" | "annullata"
export type AzioneEvasione = "conferma" | "prepara" | "spedisci" | "consegna" | "riapri"

export type Anteprima = { titolo: string; miniatura: string | null }

export type RigaElenco = {
  id: string
  numero: number
  creato_il: string
  cliente: { id: string | null; nome: string; email: string | null }
  canale: Canale
  anteprime: Anteprima[]
  articoli: number
  pagamento: string
  evasione: string
  annullato: boolean
  ha_nota: boolean
  totale: number
  valuta: string
  aziende: string[]
}

export type Elenco = {
  ordini: RigaElenco[]
  conteggio: number
  valore: number
  conteggi: Record<Filtro, number>
  canali: Record<Canale, number>
  riquadri: { da_preparare: number; da_spedire: number; non_pagati: number; resi_aperti: number }
  ultimi_trenta: number
}

export type Riepilogo = { bozze: number; resi: number; evasioni: number; ultimi_trenta: number }

export type RigaRichiesta = {
  id: string
  titolo: string
  variante: string | null
  sku: string | null
  miniatura: string | null
  quantita: number
  preparate: number
  spedite: number
  consegnate: number
  in_reso: number
  rese: number
  prezzo?: number
  totale?: number
  cessione: number | null
}

export type Collo = {
  id: string
  preparato_il: string | null
  spedito_il: string | null
  consegnato_il: string | null
  tracking: string | null
  tracking_url: string | null
  corriere: string | null
}

export type Richiesta = {
  id: string
  ordine_id: string
  numero: number
  azienda_id: string
  azienda: string
  creata_il: string
  scadenza: string | null
  in_ritardo: boolean
  stato: StatoRichiesta
  evasione: string
  confermata_il: string | null
  confermata_da: string | null
  righe: RigaRichiesta[]
  colli: Collo[]
  destinatario?: { nome: string; citta: string | null }
}

export type Indirizzo = {
  nome: string | null
  azienda: string | null
  indirizzo: string | null
  indirizzo_2: string | null
  citta: string | null
  cap: string | null
  provincia: string | null
  paese: string | null
  telefono: string | null
}

export type Voce = { titolo: string; dettaglio: string | null; quando: string; importo?: number }
export type Mittente = { nome: string; indirizzo: string }

export type Scheda = RigaElenco & {
  gruppo_id: string | null
  ordini: { id: string; numero: number; stato: string }[]
  righe: (RigaRichiesta & { azienda_id: string | null })[]
  richieste: Richiesta[]
  citta: string | null
  telefono: string | null
  indirizzo: Indirizzo | null
  fatturazione: Indirizzo | null
  consegna: { nome: string; importo: number }[]
  importi: { articoli: number; spedizione: number; tasse: number; sconti: number; totale: number }
  pagamenti: { id: string; fornitore: string; importo: number; incassato_il: string | null; rimborsato: number }[]
  incassato: number
  rimborsato: number
  senza_azienda: string[]
  cronologia: Voce[]
  note: { id: string; testo: string; chi: string; quando: string }[]
  nota: string | null
  pagato_con: string | null
  resi: { id: string; numero: number; fase: FaseReso }[]
  azioni: { incassa: boolean; annulla: boolean; passo: "prepara" | "spedisci" | "consegna" | null }
  mittente: Mittente
}

export type RigaBozza = { id: string; titolo: string; variante: string | null; miniatura: string | null; prezzo: number; quantita: number; totale: number }

export type Bozza = {
  id: string
  numero: number
  cliente_id: string | null
  creata_il: string
  creata_da: string | null
  cliente: string | null
  email: string | null
  ha_indirizzo: boolean
  nota: string | null
  origine: "ingrosso" | "manuale"
  consegna: string | null
  valuta: string
  totale: number
  righe: RigaBozza[]
}

export type DatiIndirizzo = { nome: string; via: string; citta: string; cap: string; paese: string; telefono: string }

export type OpzioniBozza = {
  offerte: { id: string; titolo: string; variante: string | null; sku: string | null; azienda: string | null; miniatura: string | null; prezzo: number; disponibili: number | null }[]
  clienti: { id: string; nome: string; email: string | null; indirizzo: DatiIndirizzo | null }[]
  consegne: { nome: string; importo: number }[]
}

export type FaseReso = "richiesto" | "approvato" | "ricevuto" | "rimborsato" | "annullato"

export type Reso = {
  id: string
  numero: number
  ordine_id: string
  ordine_numero: number | null
  cliente: string
  azienda: string | null
  creato_il: string
  ricevuto_il: string | null
  fase: FaseReso
  importo: number
  rimborsabile: number
  rimborso: { importo: number; quando: string; chi: string; nota?: string | null } | null
  voci: { id: string; titolo: string; variante: string | null; miniatura: string | null; quantita: number; motivo: string | null; nota: string | null }[]
}

export type ElencoResi = { resi: Reso[]; riquadri: { aperti: number; rimborsato: number; tasso: number | null }; conteggio: number }

export type RichiestaCoda = Richiesta

export type ElencoCoda = {
  richieste: Richiesta[]
  conteggio: number
  conteggi: Record<string, number>
  riquadri: { da_confermare: number; da_preparare: number; da_spedire: number; in_ritardo: number }
  aziende: { id: string; nome: string }[]
  aperte: number
}

export type RigaAzienda = {
  id: string
  numero: number
  creato_il: string
  destinatario: { nome: string; citta: string | null }
  articoli: number
  anteprime: Anteprima[]
  evasione: string
  stato: StatoRichiesta
  scadenza: string | null
  in_ritardo: boolean
  valore: number | null
  valuta: string
}

export type ElencoAzienda = { ordini: RigaAzienda[]; conteggio: number; conteggi: Record<string, number> }

export type SchedaAzienda = Omit<RigaAzienda, "destinatario"> & {
  azienda: string
  destinatario: Indirizzo & { nome: string }
  consegna: { nome: string }[]
  richiesta: Richiesta
  cronologia: Voce[]
  mittente: Mittente
}
