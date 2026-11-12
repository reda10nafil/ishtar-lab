import type { PuntoAsse } from "../../componenti/Grafici"

export type Periodo = "oggi" | "7g" | "30g" | "12m"
export type Canale = "online" | "cassa" | "ingrosso"

export type SerieCanale = { id: Canale; nome: string; totale: number; precedente: number; valori: number[] }
export type VenditePeriodo = { totale: number; precedente: number; variazione: number | null; assi: PuntoAsse[]; canali: SerieCanale[] }
export type UnitaPeriodo = { totale: number; precedente: number; variazione: number | null; assi: PuntoAsse[]; valori: number[] }

export type Indicatore = { valore: number | null; precedente: number | null; variazione: number | null; serie: number[] }

export type RigaCoda = {
  id: string
  numero: number | null
  cliente: string | null
  quando: string
  pagato: boolean
  preparato: boolean
  richieste: { ordine: string; azienda: string }[]
  totale: number | null
  unita: number
  righe: { titolo: string; miniatura: string | null }[]
}

export type Coda = { da_preparare: number; pronti: number; voci: RigaCoda[] }
export type Migliore = { id: string; nome: string; miniatura: string | null; unita: number; importo?: number }

export type PanoramicaAdmin = {
  tipo: "admin"
  giorno: string
  negozio: string
  vendite: Record<Periodo, VenditePeriodo> | null
  indicatori: { ordini: Indicatore; ordine_medio: Indicatore; ritorno: Indicatore & { clienti: number } } | null
  ultime: { id: string; numero: number | null; cliente: string | null; canale: Canale; quando: string; totale: number }[] | null
  obiettivo: { meta: number | null; incasso: number; ordini: number } | null
  coda: Coda | null
  migliori: Migliore[] | null
  in_diretta: { visitatori: number; carrello: number; cassa: number; andamento?: number[] } | null
  conversione: { valore: number; variazione: number | null; serie: number[] } | null
  spunto: { titolo: string; testo: string } | null
  attivita: { persone_oggi: number; voci: VoceAttivita[] } | null
  altre_valute: number
}

export type PanoramicaAzienda = {
  tipo: "azienda"
  giorno: string
  unita: Record<Periodo, UnitaPeriodo>
  indicatori: { ordini: Indicatore; unita: Indicatore; unita_per_ordine: Indicatore }
  ultime: { id: string; numero: number | null; quando: string; unita: number }[]
  coda: Coda
  migliori: Migliore[]
}

export type VoceAttivita = { id: string; quando: string; chi: string; azione: string; a: string | null }

export type ScortaBassa = { id: string; articolo_id: string; deposito_id: string; in_arrivo: number; prodotto: string | null; variante: string | null; miniatura: string | null; disponibili: number; soglia: number; stato: string }

export type Mese = { chiave: string; etichetta: string; dettaglio: string; in_corso: boolean; totale: number; ordini: number; unita: number; canali: number[]; margine?: number }

export type AnalisiVendite = {
  valuta: string
  anno: { da: string; a: string }
  riepilogo: {
    totale: number
    corrente: { etichetta: string; totale: number; variazione: number | null; rispetto_a: string }
    migliore: { etichetta: string; dettaglio: string; totale: number } | null
    media: number | null
    mesi_con_vendite: number
  }
  canali: { id: Canale; nome: string; totale: number; quota: number }[]
  mesi: Mese[]
  aziende: { id: string | null; nome: string | null; vendite: number; ordini: number; unita: number; margine?: { valore: number; senza_costo: number } }[]
  outfit: { id: string; nome: string | null; unita: number; importo: number }[]
  prodotti: { id: string; nome: string; miniatura: string | null; unita: number; importo: number }[]
  vede_margini: boolean
  margine: { valore: number; senza_costo: number } | null
  altre_valute: number
}

export type Metrica = "vendite" | "ordini" | "ordine_medio" | "unita" | "margine" | "visite"
export type Raggruppa = "tempo" | "canale" | "azienda" | "prodotto"
export type PeriodoReport = "7g" | "14g" | "30g" | "90g" | "12m"

export type Report = {
  righe: { chiave: string; etichetta: string; dettaglio: string; valore: number }[]
  totale: number
  media: number | null
  migliore: { etichetta: string; valore: number } | null
  piu_venduto: { nome: string; unita: number } | null
  senza_costo: number | null
  ordini: number
}

type GiornoVisite = { chiave: string; etichetta: string; dettaglio: string; visite: number; precedenti: number }
type FinestraVisite = { giorni: GiornoVisite[]; visite: number; variazione: number | null }

export type DatiTraffico = {
  finestre: { "14": FinestraVisite; "30": FinestraVisite }
  conversione: number | null
  carrello: { valore: number; variazione: number | null } | null
  ora: { giorno: string; ora: string } | null
  ore: number[][] | null
  fonti: { nome: string; visite: number; quota: number }[]
  pagine: { titolo: string; percorso: string; visite: number }[]
}
