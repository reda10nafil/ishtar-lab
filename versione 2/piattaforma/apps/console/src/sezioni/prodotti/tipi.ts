export type Riferimento = { id: string; nome: string }
export type RiferimentoCollezione = { id: string; titolo: string }

export type ProdottoElenco = {
  id: string
  titolo: string
  descrizione: string | null
  stato: string
  foto: string | null
  tinta: number | null
  brand: string | null
  categorie: Riferimento[]
  collezione: RiferimentoCollezione | null
  aziende: Riferimento[]
  varianti: number
  taglie: string[]
  creato_il: string
  aggiornato_il: string
  prezzo_min: number | null
  prezzo_max: number | null
  scorte: number
  /** Almeno una taglia è al punto di riordino o sotto. */
  scorte_basse: boolean
  sku: string | null
  venduti_30: number
  prezzo_consigliato: number | null
  /** Arriva solo a chi ha il permesso `margini`. */
  prezzo_cessione?: number | null
}

export type RispostaCatalogo = {
  prodotti: ProdottoElenco[]
  totale: number
  conteggi: Record<string, number>
  categorie: { totale: number; voci: (Riferimento & { conteggio: number })[] } | null
}

export type Proposta = { prezzo_cessione: number | null; prezzo_consigliato: number | null; proposta_il: string }

/** I campi di cessione e margine arrivano solo a chi ha il permesso `margini`. */
export type OffertaScheda = {
  id: string
  azienda: Riferimento
  sku: string
  ean: string | null
  prezzo: number | null
  prezzo_consigliato: number | null
  scorte: number
  soglia: number
  depositi: number
  prezzo_cessione?: number | null
  proposta?: Proposta | null
  margine?: number | null
  margine_percento?: number | null
}

export type VarianteScheda = { id: string; titolo: string; sku: string | null; ean: string | null; offerte: OffertaScheda[] }

export type SchedaProdotto = {
  id: string
  titolo: string
  sottotitolo: string | null
  descrizione: string | null
  handle: string
  stato: string
  copertina: string | null
  tinta: number | null
  foto: { id: string; url: string }[]
  categorie: Riferimento[]
  collezione: RiferimentoCollezione | null
  aziende: Riferimento[]
  peso: number | null
  composizione: string | null
  brand: string | null
  stagione: string | null
  genere: string | null
  cura: string | null
  seo_titolo: string | null
  seo_descrizione: string | null
  creato_il: string
  aggiornato_il: string
  modifiche_in_attesa: number
  ultima_nota: string | null
  vendite: { pezzi: number; incasso: number; giorni: number[] }
  varianti: VarianteScheda[]
  prezzo_min: number | null
  prezzo_max: number | null
  scorte: number
}

export type Collezione = {
  id: string
  title: string
  handle: string
  created_at: string
  metadata?: { descrizione?: string | null } | null
  products?: { id: string; title: string; thumbnail: string | null }[]
}

export type CartaCollezione = {
  id: string
  titolo: string
  indirizzo: string
  creata_il: string
  descrizione: string | null
  visibile: boolean
  prodotti: { id: string; titolo: string; foto: string | null; tinta: number | null }[]
  incasso: number
}

export type RigaAzienda = {
  id: string
  titolo: string
  stato: string
  foto: string | null
  categorie: Riferimento[]
  taglie: string[]
  scorte: number
  prezzo_cessione: number | null
  prezzo_consigliato: number | null
  proposta: boolean
  modifiche_richieste: boolean
}

export type SchedaAzienda = {
  id: string
  titolo: string
  descrizione: string | null
  stato: string
  copertina: string | null
  foto: { id: string; url: string }[]
  categorie: Riferimento[]
  peso: number | null
  composizione: string | null
  brand: string | null
  stagione: string | null
  genere: string | null
  cura: string | null
  prezzo_cessione: number | null
  prezzo_consigliato: number | null
  proposta: Proposta | null
  modifiche_in_attesa: number
  nota: string | null
  varianti: { id: string; titolo: string; sku: string | null; ean: string | null; quantita: number }[]
}

export type PropostaPrezzi = {
  prodotto_id: string
  azienda_id: string
  azienda: string
  titolo: string
  foto: string | null
  attuale: { prezzo_cessione?: number | null; prezzo_consigliato: number | null }
  proposta: Partial<Proposta> | null
}
