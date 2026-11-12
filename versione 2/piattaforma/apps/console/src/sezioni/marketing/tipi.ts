export type StatoCampagna = "bozza" | "programmata" | "in_invio" | "inviata" | "fallita"

export type Campagna = {
  id: string
  nome: string
  canale: "email" | "instagram" | "sms"
  oggetto: string
  testo: string
  pubblico: string
  pubblico_ora: number
  stato: StatoCampagna
  programmata_il: string | null
  avviata_il: string | null
  conclusa_il: string | null
  destinatari: number
  inviati: number
  falliti: number
  misure: { aperture: number; clic: number | null; incasso: number | null; ordini: number | null } | null
  dimostrativa: boolean
}

export type Pubblico = { chiave: string; nome: string; regola: string; conteggio: number }

export type DatiCampagne = {
  campagne: Campagna[]
  riepilogo: { inviate: number; email_inviate: number; incasso: number | null; apertura: number | null; iscritti: number; nuovi_iscritti: number; prossima: string | null; programmate: number }
  pubblici: Pubblico[]
}

export type Automazione = {
  id: string
  chiave: "benvenuto" | "carrello" | "riacquisto" | "recensione" | "recupero"
  attiva: boolean
  oggetto: string
  testo: string
  nome: string
  inizio: string
  attesa: string
  bloccata: string | null
  inviate: number
  incasso: number | null
}
