import { elaboraAggiornamenti, leggiGiri } from "../ricezione"

describe("elaboraAggiornamenti", () => {
  it("tutti registrati: cursore all'ultimo + 1, in ordine", async () => {
    const visti: number[] = []
    const esito = await elaboraAggiornamenti([{ update_id: 10 }, { update_id: 11 }, { update_id: 12 }], async (u) => {
      visti.push(u.update_id)
    })
    expect(esito).toEqual({ prossimo: 13, errore: null })
    expect(visti).toEqual([10, 11, 12])
  })

  it("errore sull'11: si ferma e il cursore resta sull'11, che si rilegge la volta dopo", async () => {
    const visti: number[] = []
    const guasto = new Error("database occupato")
    const esito = await elaboraAggiornamenti([{ update_id: 10 }, { update_id: 11 }, { update_id: 12 }], async (u) => {
      visti.push(u.update_id)
      if (u.update_id === 11) throw guasto
    })
    expect(esito).toEqual({ prossimo: 11, errore: guasto })
    expect(visti).toEqual([10, 11])
  })

  it("niente da leggere: nessun cursore nuovo", async () => {
    expect(await elaboraAggiornamenti([], async () => undefined)).toEqual({ prossimo: null, errore: null })
  })
})

/**
 * Telegram finto con le regole documentate: getUpdates(offset) conferma (toglie) gli aggiornamenti con id minore
 * dell'offset e restituisce gli altri; senza offset restituisce tutti quelli non confermati.
 */
function telegramFinto(iniziali: number[]) {
  let coda = iniziali.map((update_id) => ({ update_id }))
  const offsets: (number | null)[] = []
  return {
    offsets,
    aggiungi: (update_id: number) => coda.push({ update_id }),
    leggi: async (offset: number | null) => {
      offsets.push(offset)
      if (offset !== null) coda = coda.filter((u) => u.update_id >= offset)
      return [...coda].sort((a, b) => a.update_id - b.update_id)
    },
  }
}

describe("leggiGiri", () => {
  it("dentro un giro conferma con l'offset; ogni esecuzione riparte senza offset", async () => {
    const tg = telegramFinto([100, 101])
    const registrati: number[] = []
    const registra = async (u: { update_id: number }) => { registrati.push(u.update_id) }
    expect(await leggiGiri(tg.leggi, registra, 2)).toEqual({ errore: null })
    expect(tg.offsets).toEqual([null, 102])
    expect(registrati).toEqual([100, 101])
  })

  it("dopo una settimana senza messaggi l'id del nuovo aggiornamento è più basso: arriva lo stesso", async () => {
    const tg = telegramFinto([900000])
    const registrati: number[] = []
    const registra = async (u: { update_id: number }) => { registrati.push(u.update_id) }
    await leggiGiri(tg.leggi, registra, 2)
    tg.aggiungi(123)
    await leggiGiri(tg.leggi, registra, 2)
    expect(registrati).toEqual([900000, 123])
  })

  it("un errore di registrazione ferma il giro: l'aggiornamento resta da confermare e si rilegge", async () => {
    const tg = telegramFinto([10, 11])
    let rotto = true
    const registrati: number[] = []
    const registra = async (u: { update_id: number }) => {
      if (u.update_id === 11 && rotto) throw new Error("database occupato")
      registrati.push(u.update_id)
    }
    const primo = await leggiGiri(tg.leggi, registra, 2)
    rotto = false
    await leggiGiri(tg.leggi, registra, 2)
    expect(primo.errore).toBeInstanceOf(Error)
    // Il 10 si rilegge (lo ferma la chiave unica del messaggio); l'11, rimasto da confermare, arriva una volta.
    expect(registrati).toEqual([10, 10, 11])
  })
})
