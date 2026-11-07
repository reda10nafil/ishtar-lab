import { useEffect, useRef, useState, type ReactNode } from "react"
import { useLocation } from "react-router-dom"

type Proprieta = {
  etichetta: string
  classe?: string
  bottone: ReactNode
  children: ReactNode
}

/** Pulsante con pannello a comparsa. Si chiude con Esc, cambiando pagina o cliccando fuori. */
export function Tendina({ etichetta, classe, bottone, children }: Proprieta) {
  const [aperta, setAperta] = useState(false)
  const contenitore = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useEffect(() => setAperta(false), [pathname])

  useEffect(() => {
    if (!aperta) return
    const fuori = (e: MouseEvent) => {
      if (!contenitore.current?.contains(e.target as Node)) setAperta(false)
    }
    const tasto = (e: KeyboardEvent) => e.key === "Escape" && setAperta(false)
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
      {aperta ? <div className="tendina__pannello">{children}</div> : null}
    </div>
  )
}
