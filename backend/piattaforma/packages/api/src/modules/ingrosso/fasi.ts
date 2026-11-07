/** Le colonne della bacheca, nell'ordine in cui si mostrano. */
export const FASI = ["richiesta", "trattativa", "campione", "accordo", "perso"] as const
export type Fase = (typeof FASI)[number]
