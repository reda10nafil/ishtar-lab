const LINGUA = "en-GB"

let formato = new Intl.NumberFormat(LINGUA, { style: "currency", currency: "EUR" })
let corrente = "EUR"

/** La valuta del negozio si sceglie in Settings e vale per tutta l'interfaccia. Non converte i prezzi. */
export function impostaValuta(codice: string) {
  const nuovo = codice.toUpperCase()
  if (nuovo === corrente) return
  corrente = nuovo
  formato = new Intl.NumberFormat(LINGUA, { style: "currency", currency: nuovo })
}

export const formattaImporto = (valore: number) => formato.format(valore)
