import { Pencil } from "lucide-react"
import { numero, percentuale } from "../../lingua"
import { euro } from "../../ui"
import type { OffertaScheda, SchedaProdotto, VarianteScheda } from "./tipi"

function Valore({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="variante__valore">
      <span>{etichetta}</span>
      <strong>{valore}</strong>
    </div>
  )
}

const margineDi = (o: OffertaScheda) => (o.margine === null || o.margine === undefined ? "–" : `${euro(o.margine)} (${percentuale(o.margine_percento)})`)

type Proprieta = { scheda: SchedaProdotto; conMargini: boolean; onApri?: (variante: VarianteScheda) => void }

/** Elenco per il cassetto: una variante può avere più offerte, una per azienda. */
export function TabellaVarianti({ scheda, conMargini, onApri }: Proprieta) {
  return (
    <ul className="varianti" aria-label="Product variants">
      {scheda.varianti.map((v) => (
        <li key={v.id} className="variante">
          <div className="variante__testa">
            <strong>{v.titolo}</strong>
            <span className="codice">{v.sku ?? "No SKU"}</span>
            <span className="codice">{v.ean ?? "No EAN"}</span>
            <span className="spazio" />
            {onApri ? (
              <button type="button" className="icona-pulsante" aria-label={`Edit variant ${v.titolo}`} onClick={() => onApri(v)}>
                <Pencil size={15} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {v.offerte.length ? null : <p className="testo-tenue">No company sells this variant yet.</p>}
          {v.offerte.map((o) => (
            <div key={o.id} className="variante__offerta">
              <small>{o.azienda.nome}</small>
              <div className="variante__valori">
                <Valore etichetta="Selling" valore={o.prezzo === null ? "To be set" : euro(o.prezzo)} />
                {conMargini ? <Valore etichetta="Supply" valore={euro(o.prezzo_cessione)} /> : null}
                <Valore etichetta="Suggested" valore={euro(o.prezzo_consigliato)} />
                {conMargini ? <Valore etichetta="Margin" valore={margineDi(o)} /> : null}
                <Valore etichetta="Stock" valore={numero(o.scorte)} />
              </div>
            </div>
          ))}
        </li>
      ))}
    </ul>
  )
}
