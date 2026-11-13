import { invalido } from "../../../utili"
import type { ConteggioPannello, MovimentoPannello } from "../../../../workflows/catalogo/movimenti"
import { trovaRiga, type RigaInterna } from "./scorte"

/*
 * Correzioni e conteggi del Magazzino delle aziende tradotti in operazioni sulle scorte, senza database (verificati in
 * __tests__/operazioni.unit.spec.ts). Le applica il workflow «ishtar-scorte» sotto il lucchetto di ogni voce, lo stesso
 * di evasioni e resi: una variazione si somma alla giacenza del momento, una quantità scritta vale solo se la giacenza
 * è ancora quella da cui la console è partita.
 */

/** Pagina della console con il codice di prima: manda quantità senza il valore di partenza. */
export const RICARICA = "The console was updated: reload the page to save your changes"

export type OperazioneScorte = {
  voce: string
  deposito: string
  azienda: string
  nome_deposito: string
  movimenti: MovimentoPannello[]
  conteggio?: ConteggioPannello
}

type Correzione = { quantita?: number; variazione?: number; prima?: number; id?: string; motivo: string; nota?: string }

const base = (riga: RigaInterna) => ({ voce: riga.articolo_id, deposito: riga.deposito_id, azienda: riga.azienda_id, nome_deposito: riga.deposito })

/**
 * «Change» (+/− unità) o «New quantity» della finestra di correzione. Le scorte sotto zero le rifiuta il workflow, sotto
 * il lucchetto della voce e dopo aver riconosciuto un invio ripetuto: qui una correzione già applicata, rimandata dopo una
 * risposta persa, sembrerebbe portare la giacenza sotto zero.
 */
export function pianoCorrezione(corpo: Correzione, riga: RigaInterna, nuovoId: () => string): OperazioneScorte {
  const id = corpo.id ?? nuovoId()
  const nota = corpo.nota || null
  if (corpo.variazione !== undefined) {
    if (corpo.variazione === 0) throw invalido("Stock is already at this quantity")
    return { ...base(riga), movimenti: [{ id, differenza: corpo.variazione, in_arrivo: 0, motivo: corpo.motivo, nota }] }
  }
  if (corpo.prima === undefined) throw invalido(RICARICA)
  // Già così adesso (anche se la finestra mostrava altro): niente da scrivere. Uguale solo al valore mostrato, mentre la
  // giacenza è cambiata intanto: il workflow risponde 412 con quella attuale.
  if (corpo.quantita === riga.giacenza) throw invalido("Stock is already at this quantity")
  return { ...base(riga), movimenti: [], conteggio: { id, prima: [corpo.prima], dopo: corpo.quantita!, tipo: "correzione", motivo: corpo.motivo, nota } }
}

export type ConflittoConteggio = { articolo_id: string; deposito_id: string; sku: string | null; prodotto: string | null; attuale: number; prima: number }

type Conteggio = { righe: { articolo_id: string; deposito_id: string; contata: number; prima?: number }[]; nota?: string }

/**
 * Conteggio di più righe: ognuna con la giacenza mostrata quando si è iniziato a contare. Le righe la cui giacenza è
 * cambiata nel frattempo (una vendita, un reso) sono conflitti e non si scrive nulla; una riga che ha già la quantità
 * contata non lo è (anche un nuovo invio dopo una risposta persa).
 */
export function pianoConteggio(corpo: Conteggio, righe: RigaInterna[], nuovoId: () => string) {
  if (corpo.righe.some((r) => r.prima === undefined)) throw invalido(RICARICA)
  const conflitti: ConflittoConteggio[] = []
  const operazioni: OperazioneScorte[] = corpo.righe.map((r) => {
    const riga = trovaRiga(righe, r.articolo_id, r.deposito_id)
    if (riga.giacenza !== r.prima && riga.giacenza !== r.contata) {
      conflitti.push({ articolo_id: r.articolo_id, deposito_id: r.deposito_id, sku: riga.sku, prodotto: riga.prodotto, attuale: riga.giacenza, prima: r.prima! })
    }
    return {
      ...base(riga),
      movimenti: [],
      conteggio: { id: nuovoId(), prima: [r.prima!], dopo: r.contata, tipo: "conteggio", motivo: "rettifica", nota: corpo.nota || null },
    }
  })
  return { operazioni, conflitti }
}

/**
 * Conflitto rilevato dentro il workflow (una vendita arrivata fra la lettura e il lucchetto della voce): la riga contata,
 * come quelli del piano, così la console la segna e il messaggio la nomina. null se la voce non è fra le righe.
 */
export function conflittoInConteggio(conflitto: { attuale?: unknown; articolo_id?: string; deposito_id?: string }, corpo: Conteggio, righe: RigaInterna[]): ConflittoConteggio | null {
  const stessa = (r: { articolo_id: string; deposito_id: string }) => r.articolo_id === conflitto.articolo_id && r.deposito_id === conflitto.deposito_id
  const contata = corpo.righe.find(stessa)
  const riga = righe.find(stessa)
  if (!contata || !riga || contata.prima === undefined) return null
  return { articolo_id: riga.articolo_id, deposito_id: riga.deposito_id, sku: riga.sku, prodotto: riga.prodotto, attuale: Number(conflitto.attuale), prima: contata.prima }
}

/** Messaggio per la console: quante righe sono cambiate e quali, con il valore attuale. */
export function messaggioConteggio(conflitti: ConflittoConteggio[]) {
  const una = conflitti.length === 1
  const elenco = conflitti.slice(0, 5).map((c) => `${c.sku ?? c.prodotto ?? c.articolo_id} now ${c.attuale}`).join(", ")
  const altri = conflitti.length > 5 ? ` and ${conflitti.length - 5} more` : ""
  return `Count not recorded: stock changed for ${conflitti.length} ${una ? "item" : "items"} since you started counting (${elenco}${altri}). ` +
    `Check ${una ? "it" : "them"} and record the count again.`
}
