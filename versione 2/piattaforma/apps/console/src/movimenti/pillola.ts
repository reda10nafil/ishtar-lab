import { movimentoRidotto } from "./anima"
import { FUNZIONI } from "./curve"

export type Bordi = { inizio: number; fine: number }

/**
 * Pillola che scorre come una goccia: il bordo davanti parte subito, quello dietro lo raggiunge.
 * `applica` riceve i due bordi a ogni fotogramma; il risultato è la funzione che ferma il movimento.
 */
export function scorri(da: Bordi, a: Bordi, applica: (bordi: Bordi) => void, tempi = { davanti: 360, dietro: 550 }) {
  if (movimentoRidotto() || (da.inizio === a.inizio && da.fine === a.fine)) {
    applica(a)
    return () => undefined
  }
  const avanti = a.inizio >= da.inizio
  const partenza = performance.now()
  let giro = 0
  const passo = (adesso: number) => {
    const t = Math.max(0, adesso - partenza)
    const svelto = FUNZIONI.fuori3(Math.min(1, t / tempi.davanti))
    const lento = FUNZIONI.dentroFuori3(Math.min(1, t / tempi.dietro))
    applica({
      inizio: da.inizio + (a.inizio - da.inizio) * (avanti ? lento : svelto),
      fine: da.fine + (a.fine - da.fine) * (avanti ? svelto : lento),
    })
    if (t < tempi.dietro) giro = requestAnimationFrame(passo)
  }
  giro = requestAnimationFrame(passo)
  return () => cancelAnimationFrame(giro)
}
