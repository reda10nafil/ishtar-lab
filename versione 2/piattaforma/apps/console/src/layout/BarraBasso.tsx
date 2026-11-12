import { MoreHorizontal } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { scorri, type Bordi } from "../movimenti"
import type { Voce } from "./voci"

const MARGINE = 6
const RAGGIO = 18

/** Su telefono: quattro voci principali e «More» per il menu completo; la pillola scorre fra le voci. */
export default function BarraBasso({ voci, onAltro }: { voci: Voce[]; onAltro: () => void }) {
  const barra = useRef<HTMLElement>(null)
  const pillola = useRef<HTMLSpanElement>(null)
  const bordi = useRef<Bordi | null>(null)
  const ferma = useRef<() => void>(() => undefined)
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const riquadro = barra.current
    const forma = pillola.current
    if (!riquadro || !forma) return
    const attiva = riquadro.querySelector<HTMLElement>("a.active")
    forma.style.visibility = attiva?.offsetWidth ? "" : "hidden"
    if (!attiva?.offsetWidth) {
      bordi.current = null
      return
    }
    const ritaglia = ({ inizio, fine }: Bordi) => {
      forma.style.clipPath = `inset(${MARGINE}px ${riquadro.clientWidth - fine}px ${MARGINE}px ${inizio}px round ${RAGGIO}px)`
    }
    const destino = { inizio: attiva.offsetLeft, fine: attiva.offsetLeft + attiva.offsetWidth }
    ferma.current()
    if (bordi.current) ferma.current = scorri(bordi.current, destino, ritaglia)
    else ritaglia(destino)
    bordi.current = destino
  }, [pathname, voci.length])

  return (
    <nav className="barra-basso vetro" ref={barra} aria-label="Quick navigation">
      <span className="barra-basso__pillola" ref={pillola} aria-hidden="true" />
      {voci.slice(0, 4).map(({ a, etichetta, icona: Icona, anche }) => (
        <NavLink key={a} to={a} end={a === "/"} className={({ isActive }) => (isActive || anche?.some((altro) => pathname.startsWith(altro)) ? "active" : "")}>
          <Icona size={21} strokeWidth={1.8} aria-hidden="true" />
          <span>{a === "/" ? "Home" : etichetta === "My products" ? "Products" : etichetta}</span>
        </NavLink>
      ))}
      <button type="button" onClick={onAltro}>
        <MoreHorizontal size={21} strokeWidth={1.8} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  )
}
