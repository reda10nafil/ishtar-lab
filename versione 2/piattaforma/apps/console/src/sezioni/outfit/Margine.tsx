import { Riquadro } from "../../componenti"
import { percentuale } from "../../lingua"
import { euro } from "../../ui"
import type { Economia } from "./tipi"

/** Compare solo se il server manda i dati: chi non ha il permesso `margini` non li riceve proprio. */
export default function Margine({ economia }: { economia: Economia }) {
  return (
    <Riquadro titolo="Cost and margin" testo="From the supply prices set by companies. Only visible with the margins permission.">
      {economia.mancanti.length ? (
        <p className="avviso-stato avviso-stato--attesa" role="status">
          Cost and margin cannot be worked out: the supply price is missing for {economia.mancanti.join(", ")}. No estimate is made.
        </p>
      ) : (
        <dl className="conti">
          <div><dt>Cost of pieces</dt><dd>{euro(economia.costo_capi)}</dd></div>
          {economia.sconto_aziende ? <div><dt>Discount funded by companies</dt><dd>{euro(economia.sconto_aziende)}</dd></div> : null}
          <div><dt>Net cost</dt><dd>{euro(economia.costo_netto)}</dd></div>
          <div className="conti__totale">
            <dt>Margin</dt>
            <dd>{euro(economia.margine)}{economia.margine_percentuale === null ? "" : ` (${percentuale(economia.margine_percentuale)})`}</dd>
          </div>
        </dl>
      )}
      <p className="outfit-nota">Shipping not included: parcel rates are not set yet.</p>
    </Riquadro>
  )
}
