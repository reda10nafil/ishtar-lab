import { useEffect, useLayoutEffect, useRef } from "react"
import { NavLink } from "react-router-dom"
import { entraSottovoci, scorri, type Bordi } from "../movimenti"
import { appartiene, type Gruppo, type Voce } from "./voci"

const RAGGIO = 13
const MARGINE = 12
const DURATA_PILLOLA = 560

type Proprieta = { gruppi: Gruppo[]; pathname: string; stretta: boolean; conteggi: Record<string, { valore: number; caldo?: boolean } | undefined> }

/** Pillola della voce attiva: copre tutto il menu e si ritaglia sulla voce, così si allunga mentre scorre. */
function usePillola(corpo: React.RefObject<HTMLDivElement>, chiave: string) {
  const pillola = useRef<HTMLSpanElement>(null)
  const bordi = useRef<Bordi | null>(null)
  const ferma = useRef<() => void>(() => undefined)
  const inMoto = useRef(0)

  const ritaglia = ({ inizio, fine }: Bordi) => {
    if (!pillola.current || !corpo.current) return
    pillola.current.style.clipPath = `inset(${inizio}px ${MARGINE}px ${corpo.current.clientHeight - fine}px round ${RAGGIO}px)`
  }

  const misura = () => {
    const attiva = corpo.current?.querySelector<HTMLElement>(".voce.active")
    if (!attiva || !attiva.offsetParent) return null
    return { inizio: attiva.offsetTop, fine: attiva.offsetTop + attiva.offsetHeight }
  }

  useLayoutEffect(() => {
    const destino = misura()
    if (pillola.current) pillola.current.style.visibility = destino ? "" : "hidden"
    if (!destino) {
      bordi.current = null
      return
    }
    ferma.current()
    const partenza = bordi.current
    bordi.current = destino
    corpo.current?.querySelector(".voce.active")?.scrollIntoView({ block: "nearest" })
    if (partenza) {
      ferma.current = scorri(partenza, destino, ritaglia)
      inMoto.current = performance.now() + DURATA_PILLOLA
    } else {
      ritaglia(destino)
    }
  }, [chiave]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!corpo.current) return
    const spia = new ResizeObserver(() => {
      // Le sotto-voci che si aprono cambiano l'altezza: la pillola in movimento va già al posto giusto.
      if (performance.now() < inMoto.current) return
      const destino = misura()
      if (!destino) return
      ferma.current()
      bordi.current = destino
      ritaglia(destino)
    })
    spia.observe(corpo.current)
    return () => spia.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return pillola
}

function Sottovoci({ voce }: { voce: Voce }) {
  const nodo = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (nodo.current) entraSottovoci(nodo.current)
  }, [])
  return (
    <div className="sottovoci" ref={nodo}>
      {voce.sotto?.map((sotto) => (
        <NavLink key={sotto.a} to={sotto.a} className={({ isActive }) => `sottovoce${isActive ? " sottovoce--attiva" : ""}`}>
          {sotto.etichetta}
        </NavLink>
      ))}
    </div>
  )
}

export default function Menu({ gruppi, pathname, stretta, conteggi }: Proprieta) {
  const corpo = useRef<HTMLDivElement>(null)
  const attiva = gruppi.flatMap((g) => g.voci).find((v) => appartiene(v, pathname))
  const pillola = usePillola(corpo, `${attiva?.a}|${stretta}`)

  return (
    <nav aria-label="Main">
      <div className="menu-corpo" ref={corpo}>
        <span className="menu-pillola" ref={pillola} aria-hidden="true" />
        {gruppi.map((gruppo) => (
          <div key={gruppo.titolo} style={{ display: "contents" }}>
            <p className="menu-gruppo">{gruppo.titolo}</p>
            {gruppo.voci.map((voce) => {
              const conteggio = conteggi[voce.a]
              const aperta = voce === attiva && !stretta && Boolean(voce.sotto?.length)
              return (
                <div key={voce.a} style={{ display: "contents" }}>
                  <NavLink to={voce.a} end={voce.a === "/"} className={() => `voce${voce === attiva ? " active" : ""}`} title={stretta ? voce.etichetta : undefined}>
                    <voce.icona size={20} strokeWidth={1.8} aria-hidden="true" />
                    <span>{voce.etichetta}</span>
                    {conteggio?.valore ? <em className={`contatore${conteggio.caldo ? " contatore--caldo" : ""}`}>{conteggio.valore}</em> : null}
                  </NavLink>
                  {aperta ? <Sottovoci voce={voce} /> : null}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}
