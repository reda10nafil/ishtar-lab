import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { anima, CURVE, useUscita } from "../movimenti"

type Proprieta = {
  etichetta: string
  classe?: string
  bottone: ReactNode
  /** Un clic su una voce chiude la tendina: per i menu, non per i pannelli con controlli. Una voce con `data-resta` la lascia aperta. */
  chiudiAlClic?: boolean
  children: ReactNode
}

/** Entra con un piccolo rimbalzo ed esce rimpicciolendo, come il pannello di riferimento. */
function PannelloTendina({ onClic, menu, children }: { onClic?: () => void; menu: boolean; children: ReactNode }) {
  const nodo = useRef<HTMLDivElement>(null)
  // Un menu si apre con il fuoco sulla prima voce, così si continua con la tastiera.
  useEffect(() => {
    if (menu) nodo.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true })
  }, [menu])
  useLayoutEffect(() => {
    if (!nodo.current) return
    const entrata = anima(nodo.current, [{ opacity: 0, transform: "translateY(-6px) scale(0.92)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: CURVE.tendina })
    return () => entrata?.cancel()
  }, [])
  useUscita(nodo, (copia) => [anima(copia, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.96)" }], { duration: 150, easing: CURVE.dentro2, fill: "forwards" })])
  return <div className="tendina__pannello" ref={nodo} onClick={(e) => (e.target as Element).closest("a, button:not([data-resta])") && onClic?.()}>{children}</div>
}

/** Pulsante con pannello a comparsa. Si chiude con Esc, cambiando pagina o cliccando fuori. */
export function Tendina({ etichetta, classe, bottone, chiudiAlClic, children }: Proprieta) {
  const [aperta, setAperta] = useState(false)
  const contenitore = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useEffect(() => setAperta(false), [pathname])

  useEffect(() => {
    if (!aperta) return
    const fuori = (e: MouseEvent) => {
      if (!contenitore.current?.contains(e.target as Node)) setAperta(false)
    }
    const tasto = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setAperta(false)
      contenitore.current?.querySelector("button")?.focus({ preventScroll: true })
    }
    document.addEventListener("mousedown", fuori)
    document.addEventListener("keydown", tasto)
    return () => {
      document.removeEventListener("mousedown", fuori)
      document.removeEventListener("keydown", tasto)
    }
  }, [aperta])

  return (
    <div className="tendina" ref={contenitore}>
      <button type="button" className={classe} aria-label={etichetta} aria-expanded={aperta} onClick={() => setAperta(!aperta)}>
        {bottone}
      </button>
      {aperta ? <PannelloTendina menu={Boolean(chiudiAlClic)} onClic={chiudiAlClic ? () => setAperta(false) : undefined}>{children}</PannelloTendina> : null}
    </div>
  )
}
