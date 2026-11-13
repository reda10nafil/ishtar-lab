import { elaboraAggiornamenti } from "../ricezione"

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
