import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { dataBreve } from "../../ui"
import { lineaIndirizzo } from "./dati"
import type { Indirizzo, Mittente, RigaRichiesta } from "./tipi"

export type Foglio = {
  numero: number
  data: string
  azienda: string
  mittente: Mittente
  destinatario: Indirizzo
  consegna: string | null
  righe: RigaRichiesta[]
}

/** Una distinta per collo. Mittente Ishtar Lab e nessun prezzo: viaggia con la merce. */
export default function Distinta({ fogli, onFine }: { fogli: Foglio[]; onFine: () => void }) {
  const fine = useRef(onFine)
  fine.current = onFine

  useEffect(() => {
    document.documentElement.classList.add("ord-in-stampa")
    const finito = () => fine.current()
    window.addEventListener("afterprint", finito)
    const lancio = window.setTimeout(() => window.print(), 80)
    return () => {
      window.clearTimeout(lancio)
      window.removeEventListener("afterprint", finito)
      document.documentElement.classList.remove("ord-in-stampa")
    }
  }, [])

  return createPortal(
    <div className="ord-stampa" aria-hidden="true">
      {fogli.map((f) => (
        <article key={`${f.numero}-${f.azienda}`} className="ord-foglio">
          <header>
            <div>
              <h1>{f.mittente.nome}</h1>
              {f.mittente.indirizzo ? <p>{f.mittente.indirizzo}</p> : null}
            </div>
            <div>
              <h2>Packing slip</h2>
              <p>Order #{f.numero} · {dataBreve(f.data)}</p>
            </div>
          </header>
          <section>
            <div>
              <h3>Deliver to</h3>
              <p><b>{f.destinatario.nome}</b></p>
              {f.destinatario.azienda ? <p>{f.destinatario.azienda}</p> : null}
              <p>{lineaIndirizzo(f.destinatario)}</p>
              {f.destinatario.telefono ? <p>{f.destinatario.telefono}</p> : null}
            </div>
            <div>
              <h3>Ships from</h3>
              <p><b>{f.azienda}</b></p>
              {f.consegna ? <p>{f.consegna}</p> : null}
            </div>
          </section>
          <table>
            <thead>
              <tr><th>Item</th><th>SKU</th><th>Quantity</th></tr>
            </thead>
            <tbody>
              {f.righe.map((r) => (
                <tr key={r.id}>
                  <td>{r.titolo}{r.variante ? ` · ${r.variante}` : ""}</td>
                  <td>{r.sku ?? "–"}</td>
                  <td>{r.quantita}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </div>,
    document.body
  )
}
