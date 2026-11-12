/** Le colonne della bacheca, nell'ordine in cui si mostrano. */
export const FASI = ["richiesta", "campione", "accordo", "spedito"] as const
export type Fase = (typeof FASI)[number]
