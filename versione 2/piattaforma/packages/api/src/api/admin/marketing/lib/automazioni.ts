/** Cosa fa ogni regola e, se non può ancora partire, il motivo vero. */
const REGOLE: Record<string, { nome: string; inizio: string; attesa: string; bloccata: string | null }> = {
  benvenuto: { nome: "Welcome", inizio: "New subscriber", attesa: "Straight away", bloccata: null },
  carrello: {
    nome: "Abandoned basket",
    inizio: "Basket left for 2 hours",
    attesa: "2 hours",
    bloccata: "The online shop isn't live yet, so there are no baskets to watch.",
  },
  riacquisto: {
    nome: "Time for a new look",
    inizio: "40 days after an order",
    attesa: "40 days",
    bloccata: "Nothing checks past orders on a schedule yet, so this can't start.",
  },
  recupero: {
    nome: "Win-back",
    inizio: "No order in 120 days",
    attesa: "120 days",
    bloccata: "Nothing checks past orders on a schedule yet, so this can't start.",
  },
  recensione: {
    nome: "Review request",
    inizio: "7 days after delivery",
    attesa: "7 days",
    bloccata: "There's no review page yet for this email to open.",
  },
}

export const descriviAutomazione = (chiave: string) => REGOLE[chiave]
