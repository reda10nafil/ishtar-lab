export type StatoOutfit = "bozza" | "pubblicato" | "archiviato"
export type ModalitaPrezzo = "somma" | "fisso"
export type CaricoSconto = "negozio" | "aziende" | "ripartito"

export type Variante = {
  id: string
  titolo: string
  sku: string | null
  prezzo: number | null
  /** `null`: l'azienda non gestisce le scorte di questa offerta. */
  quantita: number | null
  disponibile: boolean
  costo?: number | null
}

/** Un prodotto con l'azienda che lo vende: voce di catalogo o capo dell'outfit. */
export type Sorgente = {
  product_id: string
  azienda_id: string
  titolo: string
  foto: string | null
  azienda_nome: string
  acquistabile: boolean
  problema: string | null
  prezzo: number | null
  prezzo_varia: boolean
  varianti: Variante[]
  costo?: number | null
}

export type Capo = Sorgente & {
  id: string
  x: number
  y: number
  larghezza: number
  livello: number
  in_sostituzione: boolean
  alternativa: Sorgente | null
}

export type Disponibilita = { acquistabile: boolean; motivi: string[]; capi_sostituiti: number }

export type Prezzo = {
  somma: number | null
  finale: number | null
  sconto: number
  sconto_negozio: number
  sconto_aziende: number
  varia_con_taglia: boolean
  sopra_somma: boolean
}

export type Economia = {
  costo_capi: number | null
  sconto_aziende: number
  costo_netto: number | null
  margine: number | null
  margine_percentuale: number | null
  mancanti: string[]
}

export type Outfit = {
  id: string
  nome: string
  descrizione: string | null
  stato: StatoOutfit
  modalita_prezzo: ModalitaPrezzo
  prezzo_fisso: number | null
  sconto_a_carico: CaricoSconto
  quota_negozio: number
  pubblicato_il: string | null
  created_at: string
  updated_at: string
  capi: Capo[]
  disponibilita: Disponibilita
  prezzo: Prezzo
  /** C'è solo per chi ha il permesso `margini`. */
  economia?: Economia
}

/** Nell'elenco i capi arrivano senza taglie e alternative. */
export type CapoSintesi = Omit<Capo, "varianti" | "alternativa">
export type OutfitSintesi = Omit<Outfit, "capi"> & { capi: CapoSintesi[] }

export type Conteggi = Record<StatoOutfit, number>

export type RispostaElenco = { outfit: OutfitSintesi[]; count: number; conteggi: Conteggi; limit: number; aziende: { id: string; nome: string; outfit: number }[] }

export type RispostaCatalogo = { capi: Sorgente[]; aziende: { id: string; nome: string }[]; count: number; limit: number }

/** Solo ciò che si salva: la tela e le impostazioni. I numeri tornano sempre dal server. */
export type Posto = {
  product_id: string
  azienda_id: string
  alternativa_product_id: string | null
  alternativa_azienda_id: string | null
  x: number
  y: number
  larghezza: number
  livello: number
}

export type Composizione = {
  nome: string
  descrizione: string | null
  modalita_prezzo: ModalitaPrezzo
  prezzo_fisso: number | null
  sconto_a_carico: CaricoSconto
  quota_negozio: number
  capi: Posto[]
}

/** Per ogni variante l'azienda vede un solo valore: la sua cessione o, se manca, il prezzo della sua offerta. */
export type TipoValore = "cessione" | "offerta"

export type VarianteAzienda = {
  id: string
  titolo: string
  sku: string | null
  quantita: number | null
  disponibile: boolean
  valore: number | null
  valore_tipo: TipoValore
}

export type CapoAzienda = {
  id: string
  ruolo: "capo" | "alternativa"
  x: number
  y: number
  larghezza: number
  livello: number
  titolo: string
  foto: string | null
  acquistabile: boolean
  problema: string | null
  valore: number | null
  valore_tipo: TipoValore
  sconto_a_carico: number
  varianti: VarianteAzienda[]
}

export type OutfitAzienda = {
  id: string
  nome: string
  descrizione: string | null
  stato: StatoOutfit
  pubblicato_il: string | null
  capi: CapoAzienda[]
  altri_capi: number
}

export type RispostaElencoAzienda = { outfit: OutfitAzienda[]; count: number; limit: number }

/** Il minimo che serve per disegnare un capo sulla tela o nella foto composta. */
export type PezzoTela = { chiave: string; titolo: string; foto: string | null; x: number; y: number; larghezza: number; livello: number }
