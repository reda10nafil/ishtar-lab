import { useLayoutEffect, useRef, type RefObject } from "react"
import { movimentoRidotto } from "./anima"

/**
 * Dà un'uscita animata a ciò che React toglie subito: quando il componente sparisce ne resta per un attimo una
 * copia inerte, ignorata dalle tecnologie assistive. Funziona anche se a chiudere è il genitore, e non cambia l'API.
 */
export function useUscita(rif: RefObject<HTMLElement>, suona: (copia: HTMLElement) => (Animation | null)[]) {
  const azione = useRef(suona)
  azione.current = suona
  useLayoutEffect(() => {
    const originale = rif.current
    if (!originale) return
    return () => {
      if (movimentoRidotto()) return
      const genitore = originale.parentNode
      const copia = originale.cloneNode(true) as HTMLElement
      const campi = originale.querySelectorAll<HTMLInputElement>("input, textarea, select")
      copia.querySelectorAll<HTMLInputElement>("input, textarea, select").forEach((campo, i) => {
        campo.value = campi[i]?.value ?? ""
      })
      // In sviluppo React smonta e rimonta per prova: il nodo resta al suo posto e nessuna uscita deve partire.
      queueMicrotask(() => {
        if (originale.isConnected || !genitore?.isConnected) return
        copia.setAttribute("aria-hidden", "true")
        copia.setAttribute("inert", "")
        copia.style.pointerEvents = "none"
        genitore.appendChild(copia)
        void Promise.allSettled(azione.current(copia).map((a) => a?.finished)).then(() => copia.remove())
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
