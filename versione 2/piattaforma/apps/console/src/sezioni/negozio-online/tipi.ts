export type Accento = "rosa" | "mare" | "sabbia"

export type Vetrina = { id: string; testata: string; annuncio: string; accento: Accento; messaggio: string }

export type PaginaNegozio = { id: string; titolo: string; percorso: string; testo: string; visibile: boolean; updated_at: string }

/** Dati fittizi del negozio: `null` quando non sono stati caricati. */
export type Visite = { adesso: number; citta: { nome: string; visitatori: number }[]; pagine: Record<string, number> }

export type StatoNegozio = { vetrina: Vetrina; pagine: PaginaNegozio[]; online: boolean; massimo_annuncio: number; visite: Visite | null }

export type ProdottoVetrina = { id: string; titolo: string; foto: string | null; prezzo_min: number }

export type DatiVetrina = Pick<Vetrina, "testata" | "annuncio" | "accento" | "messaggio">
