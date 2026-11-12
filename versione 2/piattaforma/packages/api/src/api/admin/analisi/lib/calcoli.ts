import { dentro, type Intervallo, type Secchio } from "./periodi"
import type { Ordine, Riga } from "./ordini"

export const CANALI = [
  { id: "online", nome: "Online" },
  { id: "cassa", nome: "Shop" },
  { id: "ingrosso", nome: "Wholesale" },
] as const

/** Calcoli sugli ordini: funzioni pure, provate con ordini di esempio solo in memoria. */
export const somma = (valori: number[]) => valori.reduce((totale, valore) => totale + valore, 0)

export const unitaDi = (o: Ordine) => somma(o.righe.map((r) => r.quantita))

/** Gli importi in altre valute non si possono sommare: restano fuori e si contano a parte. */
export const contabili = (ordini: Ordine[], valuta: string) => ordini.filter((o) => o.valido && o.valuta?.toLowerCase() === valuta.toLowerCase())

export const nelPeriodo = (ordini: Ordine[], intervallo: Intervallo) => ordini.filter((o) => dentro(o.creato_il, intervallo))

export type Totali = { vendite: number; ordini: number; unita: number; ordine_medio: number | null }

/** Un acquisto diviso fra più aziende resta un ordine solo, come nella sezione Orders. */
export const acquisti = (ordini: Ordine[]) => new Set(ordini.map((o) => o.gruppo_id ?? o.id)).size

export function totali(ordini: Ordine[]): Totali {
  const vendite = somma(ordini.map((o) => o.totale))
  const quanti = acquisti(ordini)
  return {
    vendite,
    ordini: quanti,
    unita: somma(ordini.map(unitaDi)),
    ordine_medio: quanti ? vendite / quanti : null,
  }
}

/** Frazione di variazione. Senza un periodo di confronto non c'è percentuale da mostrare. */
export const variazione = (attuale: number, precedente: number | null) => (precedente ? (attuale - precedente) / precedente : null)

export const perSecchio = <T>(ordini: Ordine[], secchi: Secchio[], misura: (gruppo: Ordine[]) => T): T[] =>
  secchi.map((s) => misura(ordini.filter((o) => dentro(o.creato_il, s))))

/** Chi ha ordinato nel periodo e aveva già ordinato prima che il periodo iniziasse. */
export function clientiDiRitorno(tutti: Ordine[], intervallo: Intervallo) {
  const prima = new Set(tutti.filter((o) => o.creato_il < intervallo.inizio && o.cliente_id).map((o) => o.cliente_id))
  const clienti = new Set(nelPeriodo(tutti, intervallo).map((o) => o.cliente_id).filter(Boolean))
  const tornati = [...clienti].filter((c) => prima.has(c)).length
  return { clienti: clienti.size, tornati, quota: clienti.size ? tornati / clienti.size : null }
}

export type Voce = { id: string; nome: string; miniatura: string | null; unita: number; importo: number }

export function perProdotto(ordini: Ordine[]): Voce[] {
  const mappa = new Map<string, Voce>()
  for (const riga of ordini.flatMap((o) => o.righe)) {
    const id = riga.prodotto_id ?? riga.titolo
    const voce = mappa.get(id) ?? { id, nome: riga.titolo, miniatura: riga.miniatura, unita: 0, importo: 0 }
    mappa.set(id, { ...voce, unita: voce.unita + riga.quantita, importo: voce.importo + riga.importo })
  }
  return [...mappa.values()].sort((a, b) => b.unita - a.unita || b.importo - a.importo)
}

export const costoRiga = (riga: Riga, costi: Map<string, number>) => {
  const costo = riga.offerta_id ? costi.get(riga.offerta_id) : undefined
  return costo === undefined ? null : costo * riga.quantita
}

/** Il margine conta solo le righe con un prezzo di cessione noto: le altre si dichiarano, non si stimano. */
export function margine(ordini: Ordine[], costi: Map<string, number>) {
  let valore = 0
  let senza_costo = 0
  for (const riga of ordini.flatMap((o) => o.righe)) {
    const costo = costoRiga(riga, costi)
    if (costo === null) senza_costo += 1
    else valore += riga.netto - costo
  }
  return { valore, senza_costo }
}
