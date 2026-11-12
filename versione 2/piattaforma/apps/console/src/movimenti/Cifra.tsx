import { useEffect, useRef } from "react"
import { movimentoRidotto } from "./anima"
import { FUNZIONI, TEMPI } from "./curve"

type Proprieta = {
  valore: number
  /** Come mostrare il numero: `euro`, `numero`, `percentuale`... */
  formato?: (valore: number) => string
  className?: string
}

const INTERO = (valore: number) => String(Math.round(valore))

/**
 * Numero che sale da zero alla prima comparsa, con la curva del pannello.
 * Se il dato cambia dopo, parte dal valore mostrato: un aggiornamento non riparte mai da zero.
 */
export function Cifra({ valore, formato = INTERO, className }: Proprieta) {
  const nodo = useRef<HTMLSpanElement>(null)
  const mostrato = useRef(0)
  const scrivi = useRef(formato)
  scrivi.current = formato

  useEffect(() => {
    const elemento = nodo.current
    if (!elemento) return
    const da = mostrato.current
    if (da === valore || movimentoRidotto()) {
      mostrato.current = valore
      elemento.textContent = scrivi.current(valore)
      return
    }
    const inizio = performance.now()
    let giro = 0
    const passo = (adesso: number) => {
      const u = Math.min(1, Math.max(0, (adesso - inizio) / TEMPI.cifra))
      mostrato.current = u === 1 ? valore : da + (valore - da) * FUNZIONI.fuori3(u)
      elemento.textContent = scrivi.current(mostrato.current)
      if (u < 1) giro = requestAnimationFrame(passo)
    }
    giro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(giro)
  }, [valore])

  return <span ref={nodo} className={className ? `cifra ${className}` : "cifra"}>{formato(movimentoRidotto() ? valore : 0)}</span>
}
