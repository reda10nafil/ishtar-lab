import type { Tono } from "../../lingua"

export type StatoRichiesta = "aperta" | "in_attesa" | "chiusa"

export type Richiesta = {
  id: string
  codice: string
  oggetto: string
  categoria: string
  stato: StatoRichiesta
  azienda: string | null
  aperta_il: string
  ultimo_messaggio_il: string
}

export type Messaggio = { id: string; da_staff: boolean; autore: string; testo: string; quando: string }

export type DettaglioRichiesta = {
  id: string
  codice: string
  oggetto: string
  categoria: string
  stato: StatoRichiesta
  azienda: string | null
  aperta_da: string
  aperta_il: string
  messaggi: Messaggio[]
}

export const CATEGORIE: Record<string, string> = {
  ordini: "Orders",
  prodotti: "Products",
  magazzino: "Stock",
  spedizioni: "Shipping",
  fatturazione: "Billing",
  altro: "Something else",
}

/** Lo stesso stato si legge in modo diverso da chi deve rispondere e da chi aspetta. */
export const statoRichiesta = (stato: StatoRichiesta, staff: boolean): { testo: string; tono: Tono } => {
  if (stato === "chiusa") return { testo: "Closed", tono: "neutro" }
  if (stato === "aperta") return staff ? { testo: "To handle", tono: "attesa" } : { testo: "Awaiting reply", tono: "neutro" }
  return staff ? { testo: "Replied", tono: "ok" } : { testo: "New reply", tono: "attesa" }
}
