import { useState } from "react"
import { numero } from "../../lingua"
import { euro, Modale } from "../../ui"
import { primaOfferta } from "./dati"
import type { OffertaTaglia, Prodotto, Taglia } from "./tipi"

type Proprieta = {
  prodotto: Prodotto
  onScelta: (taglia: Taglia, offerta: OffertaTaglia) => void
  onChiudi: () => void
}

const vendibile = (taglia: Taglia) => taglia.offerte.some((o) => o.disponibili > 0)

/** Taglia e, se più aziende hanno quella taglia, da chi prenderla. Parte dall'offerta più conveniente. */
export function ModaleTaglia({ prodotto, onScelta, onChiudi }: Proprieta) {
  const iniziale = prodotto.taglie.find(vendibile) ?? prodotto.taglie[0]
  const [taglia, setTaglia] = useState(iniziale)
  const [offerta, setOfferta] = useState(primaOfferta(iniziale))

  const scegliTaglia = (nuova: Taglia) => {
    setTaglia(nuova)
    setOfferta(primaOfferta(nuova))
  }

  const offerte = taglia.offerte.filter((o) => o.disponibili > 0)

  return (
    <Modale titolo={prodotto.titolo} sottotitolo="Choose a size" onChiudi={onChiudi}>
      <div className="filtri cassa-taglie" role="group" aria-label="Size">
        {prodotto.taglie.map((voce) => (
          <button key={voce.id} type="button" className={voce.id === taglia.id ? "attivo" : undefined} aria-pressed={voce.id === taglia.id} disabled={!vendibile(voce)} onClick={() => scegliTaglia(voce)}>
            {voce.titolo}
          </button>
        ))}
      </div>
      {offerte.length > 1 ? (
        <div className="cassa-offerte" role="radiogroup" aria-label="Sold by">
          {offerte.map((voce) => (
            <button key={voce.id} type="button" role="radio" aria-checked={voce.id === offerta.id} className="cassa-offerta" onClick={() => setOfferta(voce)}>
              <span>
                <b>{voce.azienda}</b>
                <small>{numero(voce.disponibili)} left</small>
              </span>
              <b>{euro(voce.prezzo)}</b>
            </button>
          ))}
        </div>
      ) : null}
      <div className="cassa-piede">
        <button type="button" onClick={onChiudi}>Cancel</button>
        <button type="button" className="primario" onClick={() => onScelta(taglia, offerta)}>Add to basket · {euro(offerta.prezzo)}</button>
      </div>
    </Modale>
  )
}
