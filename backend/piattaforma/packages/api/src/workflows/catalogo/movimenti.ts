/*
 * Movimenti di scorte del primo pannello, senza database (verificati in __tests__/movimenti.unit.spec.ts).
 * I pulsanti +/−, «Ricevi», «Ordina» e «Pour» mandano variazioni relative, che si sommano alle vendite e alle modifiche
 * fatte altrove; la quantità scritta nella scheda o nel CSV è un conteggio, che vale solo se la giacenza è quella letta.
 * Ogni movimento ha un id generato dal pannello: un invio ripetuto dopo un timeout non conta due volte. Lo storico usa
 * il formato del Magazzino (tipo «correzione» o «conteggio»), quindi console e Magazzino lo mostrano già.
 */

export type MovimentoPannello = { id: string; differenza: number; in_arrivo: number; motivo: "rettifica" | "rifornimento" }
export type ConteggioPannello = { id: string; prima: number[]; dopo: number }

export type VoceStorico = {
  id: string
  quando: string
  chi: string
  tipo: "correzione" | "conteggio"
  prima: number
  dopo: number
  differenza: number
  motivo: string | null
  nota: string | null
  /** Solo se il movimento cambia la merce in arrivo («Ordina», «Pour», «Ricevi»): prima e dopo, nel livello. */
  in_arrivo_prima?: number
  in_arrivo_dopo?: number
}

export type StatoLivello = { giacenza: number; in_arrivo: number; storico: VoceStorico[]; applicati: string[] }
/** Movimento effettivamente applicato, con le differenze reali: serve per annullarlo esattamente. */
export type Applicato = { id: string; differenza: number; in_arrivo: number }

/** Come il Magazzino (movimenti.ts): lo storico tiene gli ultimi 100 movimenti per livello. */
export const STORICO_PER_LIVELLO = 100
/** Id dei movimenti già applicati da ricordare per riconoscere gli invii ripetuti. */
export const MOVIMENTI_RICORDATI = 200

/**
 * Il valore da cui il pannello è partito non c'è più: scorte (`stock`) cambiate da un ordine, da un'altra finestra o dal
 * Magazzino, oppure unità in arrivo (`incoming`) già ricevute altrove. Il nome resta anche quando il workflow serializza
 * l'errore (serializeError di Medusa copia nome e proprietà), così la rotta lo riconosce e risponde 412.
 */
export class ConflittoScorte extends Error {
  constructor(public campo: "stock" | "incoming", public attuale: number, public tuo: number | null = null) {
    super(campo === "stock" ? `Le scorte sono state cambiate altrove: ora sono ${attuale}` : `Le unità in arrivo sono state cambiate altrove: ora sono ${attuale}`)
    this.name = "ConflittoScorte"
  }
}

export class ScorteNonValide extends Error {
  constructor(messaggio: string) {
    super(messaggio)
    this.name = "ScorteNonValide"
  }
}

export function applicaMovimenti(
  stato: StatoLivello,
  { movimenti = [], conteggio }: { movimenti?: MovimentoPannello[]; conteggio?: ConteggioPannello },
  chi: string,
  quando: string
): StatoLivello & { nuovi: Applicato[]; cambiato: boolean; contato: boolean } {
  let { giacenza, in_arrivo } = stato
  const storico = [...stato.storico]
  const applicati = [...stato.applicati]
  const nuovi: Applicato[] = []
  let contato = false
  const registra = (id: string, differenza: number, arrivo: number, tipo: VoceStorico["tipo"], motivo: string | null) => {
    // «Ricevi» o annullamento di un «Pour» su unità in arrivo che non ci sono più (ricevute in un'altra finestra): caricarle
    // in giacenza le conterebbe due volte.
    if (in_arrivo + arrivo < 0) throw new ConflittoScorte("incoming", in_arrivo)
    const prima = giacenza
    const arrivoPrima = in_arrivo
    giacenza += differenza
    in_arrivo += arrivo
    // Ogni variazione nello storico del Magazzino, firmata; quella della sola merce in arrivo con differenza 0 e una nota.
    if (differenza || arrivo) {
      storico.unshift({
        id, quando, chi, tipo, prima, dopo: giacenza, differenza, motivo,
        nota: arrivo ? `In arrivo ${arrivo > 0 ? "+" : ""}${arrivo} (ora ${in_arrivo})` : null,
        ...(arrivo ? { in_arrivo_prima: arrivoPrima, in_arrivo_dopo: in_arrivo } : {}),
      })
    }
    applicati.unshift(id)
    nuovi.push({ id, differenza, in_arrivo: arrivo })
  }
  for (const m of movimenti) {
    if (applicati.includes(m.id)) continue
    registra(m.id, m.differenza, m.in_arrivo, "correzione", m.motivo)
  }
  if (conteggio && !applicati.includes(conteggio.id)) {
    // Giacenza già uguale al conteggio: niente da scrivere (un nuovo invio troverà lo stesso valore o un conflitto vero).
    if (giacenza === conteggio.dopo) {
      // nessuna scrittura
    } else if (conteggio.prima.includes(giacenza)) {
      registra(conteggio.id, conteggio.dopo - giacenza, 0, "conteggio", null)
      contato = true
    } else throw new ConflittoScorte("stock", giacenza, conteggio.dopo)
  }
  // Medusa lascia la giacenza sotto zero dopo un'evasione: si rifiuta solo ciò che la porterebbe (ancora più) giù.
  if (giacenza < 0 && giacenza < stato.giacenza) throw new ScorteNonValide("Le scorte non possono scendere sotto zero")
  return {
    giacenza,
    in_arrivo,
    storico: storico.slice(0, STORICO_PER_LIVELLO),
    applicati: applicati.slice(0, MOVIMENTI_RICORDATI),
    nuovi,
    cambiato: nuovi.length > 0,
    contato,
  }
}

/** Annulla esattamente i movimenti applicati (compensazione del workflow), lasciando quelli arrivati da altri. */
export function annullaMovimenti(stato: StatoLivello, nuovi: Applicato[]): StatoLivello {
  const ids = new Set(nuovi.map((n) => n.id))
  return {
    giacenza: stato.giacenza - nuovi.reduce((s, n) => s + n.differenza, 0),
    in_arrivo: Math.max(0, stato.in_arrivo - nuovi.reduce((s, n) => s + n.in_arrivo, 0)),
    storico: stato.storico.filter((v) => !ids.has(v.id)),
    applicati: stato.applicati.filter((id) => !ids.has(id)),
  }
}

type LivelloLetto = { stocked_quantity?: unknown; incoming_quantity?: unknown; metadata?: Record<string, unknown> | null } | null | undefined

/** Stato di un livello di magazzino (o di uno che non esiste ancora) nel formato di applicaMovimenti. */
export function statoLivello(livello: LivelloLetto): StatoLivello {
  const metadata = livello?.metadata ?? {}
  return {
    giacenza: Number(livello?.stocked_quantity ?? 0),
    in_arrivo: Number(livello?.incoming_quantity ?? 0),
    storico: Array.isArray(metadata.movimenti) ? (metadata.movimenti as VoceStorico[]) : [],
    applicati: Array.isArray(metadata.ishtar_movimenti) ? metadata.ishtar_movimenti.filter((id): id is string => typeof id === "string") : [],
  }
}

/**
 * Metadati del livello dopo i movimenti: le altre chiavi restano, storico e movimenti ricordati si sostituiscono (Medusa
 * riscrive i metadati del livello per intero). La data dell'ultimo conteggio cambia solo se indicata, come nel Magazzino.
 */
export function metadatiLivello(metadata: Record<string, unknown> | null | undefined, stato: Pick<StatoLivello, "storico" | "applicati">, ultimoConteggio?: string | null) {
  return {
    ...(metadata ?? {}),
    movimenti: stato.storico,
    ishtar_movimenti: stato.applicati,
    ...(ultimoConteggio !== undefined ? { ultimo_conteggio: ultimoConteggio } : {}),
  }
}
