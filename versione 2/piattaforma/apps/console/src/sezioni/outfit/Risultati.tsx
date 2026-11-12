import { BarChart3 } from "lucide-react"
import { Riquadro, Vuoto } from "../../componenti"
import { numero } from "../../lingua"
import { Cifra } from "../../movimenti"
import { euro } from "../../ui"
import type { RisultatiOutfit } from "./tipi"

const LARGHEZZA = 432
const ALTEZZA = 60

/** Traccia degli ultimi giorni: la linea si disegna alla comparsa, l'area la segue. */
function Andamento({ serie }: { serie: number[] }) {
  const massimo = Math.max(...serie, 1)
  const passo = LARGHEZZA / Math.max(serie.length - 1, 1)
  const punti = serie.map((valore, indice) => [indice * passo, ALTEZZA - 3 - (valore / massimo) * (ALTEZZA - 8)])
  // Curva morbida senza oscillazioni: ogni tratto parte e arriva in orizzontale.
  const linea = punti.reduce((tratto, [x, y], indice) => {
    if (!indice) return `M${x},${y}`
    const [xPrima, yPrima] = punti[indice - 1]
    const mezzo = (xPrima + x) / 2
    return `${tratto} C${mezzo},${yPrima} ${mezzo},${y} ${x},${y}`
  }, "")
  return (
    <svg className="outfit-andamento" viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`} preserveAspectRatio="none" role="img" aria-label={`Sales in the last ${numero(serie.length)} days`}>
      <path className="outfit-andamento__area" d={`${linea} L${LARGHEZZA},${ALTEZZA} L0,${ALTEZZA} Z`} />
      <path className="outfit-andamento__linea" d={linea} pathLength={1} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Viste e vendite non hanno ancora una fonte vera: arrivano dai dati dimostrativi del negozio. Senza, il blocco resta vuoto. */
export default function Risultati({ risultati }: { risultati: RisultatiOutfit | null | undefined }) {
  return (
    <Riquadro titolo="Results" testo="Views, sales, replaced pieces and revenue for this outfit.">
      {risultati ? (
        <>
          <dl className="outfit-tessere outfit-tessere--quattro">
            <div><dt>Views</dt><dd><Cifra valore={risultati.viste} formato={numero} /></dd></div>
            <div><dt>Sold · 30 days</dt><dd><Cifra valore={risultati.vendite} formato={numero} /></dd></div>
            <div><dt>Revenue</dt><dd><Cifra valore={risultati.incasso} formato={euro} /></dd></div>
            <div><dt>Replaced</dt><dd><Cifra valore={risultati.capi_sostituiti} formato={numero} /></dd></div>
          </dl>
          {risultati.serie?.length ? (
            <>
              <span className="outfit-etichetta-sezione">Last {numero(risultati.serie.length)} days</span>
              <Andamento serie={risultati.serie} />
            </>
          ) : null}
        </>
      ) : (
        <Vuoto icona={BarChart3} titolo="No data yet" testo="The shop is not online: views and sales will appear here with the first real orders." />
      )}
    </Riquadro>
  )
}
