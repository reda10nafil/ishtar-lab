import { classificaEsito } from "../esito"

const invoke = (action: string, messaggio = "Offer not found") => ({ action, handlerType: "invoke", error: new Error(messaggio) })
const compensate = (action: string, messaggio: string) => ({ action, handlerType: "compensate", error: new Error(messaggio) })

describe("esito di un salvataggio a più passi", () => {
  it("riuscito o annullato del tutto", () => {
    expect(classificaEsito("done", [])).toBe("fatto")
    expect(classificaEsito("reverted", [invoke("update-offers-as-step")])).toBe("annullato")
  })
  it("workflow annidato fallito: si è già annullato da solo, la sua transazione «non si trova» più: è un annullamento riuscito", () => {
    const errori = [invoke("update-offers-as-step"), compensate("update-offers-as-step", "Transaction update-offers-as-step-auto-01X could not be found.")]
    expect(classificaEsito("failed", errori)).toBe("annullato")
  })
  it("annullamento non riuscito di un passo già completato: il salvataggio può essere rimasto a metà", () => {
    const errori = [invoke("update-offers-as-step"), compensate("update-products-as-step", "Connection terminated")]
    expect(classificaEsito("failed", errori)).toBe("a-meta")
  })
  it("errore di annullamento diverso sullo stesso passo: a metà", () => {
    expect(classificaEsito("failed", [invoke("update-offers-as-step"), compensate("update-offers-as-step", "Connection terminated")])).toBe("a-meta")
  })
  it("uno stato inatteso (per esempio ancora in corso o in compensazione) non è un salvataggio riuscito", () => {
    expect(classificaEsito("invoking", [])).toBe("a-meta")
    expect(classificaEsito("compensating", [])).toBe("a-meta")
  })
})

