import { useState, type FormEvent } from "react"
import { Campo, Modale } from "../../ui"

type Proprieta = { titolo: string; rifiuto: boolean; attesa: boolean; onChiudi: () => void; onInvia: (messaggio: string) => void }

/** Nota per l'azienda quando un prodotto viene rifiutato o rimandato indietro. */
export function ModaleDecisione({ titolo, rifiuto, attesa, onChiudi, onInvia }: Proprieta) {
  const [messaggio, setMessaggio] = useState("")
  const invia = (e: FormEvent) => {
    e.preventDefault()
    onInvia(messaggio.trim())
  }
  return (
    <Modale titolo={rifiuto ? "Reject product" : "Request changes"} sottotitolo={titolo} onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Note for the company">
          <textarea required rows={4} value={messaggio} onChange={(e) => setMessaggio(e.target.value)} />
        </Campo>
        <button className="primario" type="submit" disabled={attesa}>{rifiuto ? "Reject" : "Send request"}</button>
      </form>
    </Modale>
  )
}
