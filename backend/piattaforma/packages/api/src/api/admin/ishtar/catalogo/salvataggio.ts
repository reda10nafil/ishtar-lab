import { invalido } from "../../../utili"

type Livello = { voce_id: string; deposito_id: string; quantita: number }
type OffertaScorte = { scorte: number; livelli: Livello[]; voci_magazzino: string[] }

export type PianoScorte =
  | { tipo: "invariate" }
  | { tipo: "livello"; voce: string; deposito: string; quantita: number }
  | { tipo: "nuovo-livello"; voce: string; quantita: number }

/**
 * Cosa scrivere nel magazzino per la quantità del pannello. Se non cambia non si scrive nulla: un salvataggio del solo
 * prezzo non deve riscrivere la giacenza (annullerebbe in silenzio vendite o resi registrati nel frattempo). Con più
 * depositi il pannello mostra il totale e non sa a quale deposito attribuire la differenza: si cambia dal Magazzino.
 */
export function pianoScorte(offerta: OffertaScorte, quantita: number): PianoScorte {
  if (quantita === offerta.scorte) return { tipo: "invariate" }
  if (offerta.livelli.length > 1) throw invalido("Questo articolo ha scorte in più depositi: cambiarle dal Magazzino")
  const [livello] = offerta.livelli
  if (livello) return { tipo: "livello", voce: livello.voce_id, deposito: livello.deposito_id, quantita }
  const [voce] = offerta.voci_magazzino
  if (!voce) throw invalido("Articolo senza voce di magazzino: scorte non salvate")
  return { tipo: "nuovo-livello", voce, quantita }
}

type Campo = { id: string; label: string; type: string; category?: string; options?: string[]; required?: boolean }
type Valori = Record<string, unknown>

const presente = (valore: unknown) => valore !== undefined && valore !== null && valore !== ""

/**
 * Controllo dei campi personalizzati. Un campo obbligatorio aggiunto dopo non deve bloccare scorte, prezzo e stato dei
 * prodotti che ancora non lo hanno: si richiede alla creazione, quando il prodotto entra nella categoria del campo o
 * quando si svuota un valore che c'era. Tipo e scelte si controllano solo sui valori nuovi o cambiati.
 * Restituisce il primo errore o null.
 */
export function controllaCampi({ campi, categoria, custom, precedente }: {
  campi: Campo[]
  categoria: string
  custom: Valori
  precedente: { categoria: string; custom: Valori } | null
}): string | null {
  for (const f of campi) {
    if (f.category && f.category !== categoria) continue
    const valore = custom[f.id]
    const prima = precedente?.custom?.[f.id]
    // Il prodotto «entra» nel campo se è nuovo o se passa nella categoria del campo; un campo valido per tutte le
    // categorie non diventa richiesto solo perché la categoria cambia.
    const entra = !precedente || (Boolean(f.category) && precedente.categoria !== categoria)
    if (f.required && !presente(valore) && (entra || presente(prima))) return `Compilare ${f.label}`
    if (!presente(valore) || (!entra && JSON.stringify(valore) === JSON.stringify(prima))) continue
    if (f.type === "number" && typeof valore !== "number") return `${f.label}: indicare un numero`
    if (f.type === "boolean" && typeof valore !== "boolean") return `${f.label}: indicare sì/no`
    if (f.type === "select" && !(f.options ?? []).includes(valore as string)) return `${f.label}: valore non valido`
  }
  return null
}

type OffertaAttuale = { prezzo: number | null; prezzo_cessione: number | null; metadata: Record<string, unknown> }

/**
 * Cosa cambia nell'offerta: null se prezzo e costo sono quelli salvati. Un prezzo o un costo assenti valgono come lo 0
 * mostrato dal pannello, così un salvataggio qualsiasi non crea un prezzo di 0 €; se cambia solo il costo i prezzi non si
 * toccano (prezzo assente nel risultato).
 */
export function modificaOfferta(offerta: OffertaAttuale, prezzo: number, costo: number): null | { prezzo?: number; metadata: Record<string, unknown> } {
  const nuovoPrezzo = (offerta.prezzo ?? 0) !== prezzo
  const nuovoCosto = (offerta.prezzo_cessione ?? 0) !== costo
  if (!nuovoPrezzo && !nuovoCosto) return null
  return { ...(nuovoPrezzo ? { prezzo } : {}), metadata: nuovoCosto ? { ...offerta.metadata, prezzo_cessione: costo } : offerta.metadata }
}
