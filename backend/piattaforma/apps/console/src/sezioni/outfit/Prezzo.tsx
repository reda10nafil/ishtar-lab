import { useEffect, useState } from "react"
import { Riquadro } from "../../componenti"
import { percentuale } from "../../lingua"
import { Campo, euro } from "../../ui"
import type { CaricoSconto, Composizione, ModalitaPrezzo, Prezzo as DatiPrezzo } from "./tipi"

const MODALITA: { id: ModalitaPrezzo; testo: string }[] = [
  { id: "somma", testo: "Sum of pieces" },
  { id: "fisso", testo: "Outfit price" },
]

const CARICHI: { id: CaricoSconto; testo: string; spiega: string }[] = [
  { id: "negozio", testo: "Shop", spiega: "Companies are paid in full: the discount comes out of your margin." },
  { id: "aziende", testo: "Companies", spiega: "The discount is split between companies in proportion to the price of their pieces." },
  { id: "ripartito", testo: "Shared", spiega: "One share stays with the shop, the rest is split between companies." },
]

type Proprieta = {
  composizione: Composizione
  prezzo: DatiPrezzo
  modificabile: boolean
  onCambia: (modifica: Partial<Composizione>) => void
}

export default function Prezzo({ composizione, prezzo, modificabile, onCambia }: Proprieta) {
  const fisso = composizione.modalita_prezzo === "fisso"
  // Il testo resta quello scritto: «12,» non deve diventare 12 mentre si digita.
  const [importo, setImporto] = useState(composizione.prezzo_fisso?.toString() ?? "")
  useEffect(() => {
    if (Number(importo) !== (composizione.prezzo_fisso ?? 0)) setImporto(composizione.prezzo_fisso?.toString() ?? "")
    // Solo un cambiamento arrivato da fuori riscrive il campo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composizione.prezzo_fisso])

  const scriviImporto = (testo: string) => {
    setImporto(testo)
    const valore = Number(testo)
    onCambia({ prezzo_fisso: testo.trim() && Number.isFinite(valore) && valore > 0 ? valore : null })
  }

  const carico = CARICHI.find((c) => c.id === composizione.sconto_a_carico)

  return (
    <Riquadro titolo="Price" testo="The sum of the pieces, or one price for the whole outfit.">
      <div className="selettore selettore--stretto" role="group" aria-label="How the price is worked out">
        {MODALITA.map((m) => (
          <button key={m.id} type="button" className={composizione.modalita_prezzo === m.id ? "attivo" : undefined} aria-pressed={composizione.modalita_prezzo === m.id} disabled={!modificabile} onClick={() => onCambia({ modalita_prezzo: m.id })}>
            {m.testo}
          </button>
        ))}
      </div>

      {fisso ? (
        <Campo etichetta="Price for the whole outfit">
          <input type="number" inputMode="decimal" min="0" step="0.01" value={importo} disabled={!modificabile} onChange={(e) => scriviImporto(e.target.value)} />
        </Campo>
      ) : null}

      <dl className="conti">
        <div><dt>Sum of pieces</dt><dd>{euro(prezzo.somma)}</dd></div>
        {prezzo.sconto ? (
          <div>
            <dt>Outfit discount</dt>
            <dd>{euro(prezzo.sconto)}{prezzo.somma ? ` (${percentuale(prezzo.sconto / prezzo.somma)})` : ""}</dd>
          </div>
        ) : null}
        <div className="conti__totale"><dt>Customer price</dt><dd>{prezzo.finale === null ? "To be set" : `${prezzo.varia_con_taglia && !fisso ? "from " : ""}${euro(prezzo.finale)}`}</dd></div>
      </dl>

      {prezzo.varia_con_taglia ? <p className="outfit-nota">The price changes with the size: totals use the cheapest available size of each piece.</p> : null}
      {prezzo.sopra_somma ? <p className="avviso-stato avviso-stato--attesa">The outfit price is above the sum of the pieces: buying them together costs the customer more.</p> : null}

      {fisso ? (
        <div className="prezzo-carico">
          <span className="prezzo-carico__titolo" id="chi-sostiene">Who funds the discount</span>
          <div className="selettore selettore--stretto" role="group" aria-labelledby="chi-sostiene">
            {CARICHI.map((c) => (
              <button key={c.id} type="button" className={composizione.sconto_a_carico === c.id ? "attivo" : undefined} aria-pressed={composizione.sconto_a_carico === c.id} disabled={!modificabile} onClick={() => onCambia({ sconto_a_carico: c.id })}>
                {c.testo}
              </button>
            ))}
          </div>
          {carico ? <p className="outfit-nota">{carico.spiega}</p> : null}
          {composizione.sconto_a_carico === "ripartito" ? (
            <Campo etichetta="Shop share (%)">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="100"
                step="1"
                value={composizione.quota_negozio}
                disabled={!modificabile}
                onChange={(e) => onCambia({ quota_negozio: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
              />
            </Campo>
          ) : null}
          {prezzo.sconto ? (
            <dl className="conti">
              <div><dt>Funded by the shop</dt><dd>{euro(prezzo.sconto_negozio)}</dd></div>
              <div><dt>Funded by companies</dt><dd>{euro(prezzo.sconto_aziende)}</dd></div>
            </dl>
          ) : null}
        </div>
      ) : null}
    </Riquadro>
  )
}
