import { X } from "lucide-react"
import { useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"
import { anima, CURVE, useUscita } from "../movimenti"
import { usePermessi } from "../permessi"
import { useSessione } from "../sessione"
import type { Creazione } from "./Crea"
import { vociNuovo } from "./MenuNuovo"
import { appartiene, type Gruppo } from "./voci"

type Proprieta = {
  gruppi: Gruppo[]
  pathname: string
  nome: string
  conteggi: Record<string, { valore: number; caldo?: boolean } | undefined>
  onChiudi: () => void
  onCrea: (tipo: Creazione) => void
}

/** «More» su telefono: foglio dal basso con le azioni rapide e tutte le pagine. */
export default function Foglio({ gruppi, pathname, nome, conteggi, onChiudi, onCrea }: Proprieta) {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const velo = useRef<HTMLButtonElement>(null)
  const foglio = useRef<HTMLDivElement>(null)
  const nuovi = vociNuovo(sessione?.tipo, puo).slice(0, 3)

  useLayoutEffect(() => {
    if (!velo.current || !foglio.current) return
    const animazioni = [
      anima(velo.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: CURVE.fuori1 }),
      anima(foglio.current, [{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 620, easing: CURVE.entrata }),
    ]
    return () => animazioni.forEach((a) => a?.cancel())
  }, [])
  const chiudi = useRef(onChiudi)
  chiudi.current = onChiudi
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => e.key === "Escape" && chiudi.current()
    document.addEventListener("keydown", tasto)
    return () => document.removeEventListener("keydown", tasto)
  }, [])

  useUscita(velo, (copia) => [anima(copia, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: CURVE.fuori1, fill: "forwards" })])
  useUscita(foglio, (copia) => [anima(copia, [{ transform: "none" }, { transform: "translateY(100%)" }], { duration: 240, easing: CURVE.dentro2, fill: "forwards" })])

  return createPortal(
    <>
      <button type="button" className="velo-menu" ref={velo} aria-label="Close menu" onClick={onChiudi} />
      <div className="foglio laterale--aperta" ref={foglio} role="dialog" aria-modal="true" aria-label="All pages">
        <div className="foglio__presa" aria-hidden="true"><i /></div>
        <div className="foglio__testa">
          <div>
            <h2>{nome}</h2>
            <p>Every page</p>
          </div>
          <button type="button" className="icona-pulsante icona-pulsante--piatta" aria-label="Close" onClick={onChiudi}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="foglio__corpo">
          {nuovi.length ? (
            <div className="foglio__nuovi">
              {nuovi.map(({ a, testo, icona: Icona, crea }) => (
                <Link
                  key={a}
                  to={a}
                  onClick={(e) => {
                    onChiudi()
                    if (!crea) return
                    e.preventDefault()
                    onCrea(crea)
                  }}
                >
                  <Icona size={20} strokeWidth={1.8} aria-hidden="true" /> {testo}
                </Link>
              ))}
            </div>
          ) : null}
          <nav aria-label="All pages">
            {gruppi.flatMap((g) => g.voci).map((voce) => (
              <section key={voce.a} className={`foglio__area${appartiene(voce, pathname) ? " foglio__area--attiva" : ""}`}>
                <Link to={voce.a} className="foglio__voce" onClick={onChiudi}>
                  <i aria-hidden="true"><voce.icona size={18} strokeWidth={1.8} /></i>
                  {voce.etichetta}
                  {conteggi[voce.a]?.valore ? <em className={`contatore${conteggi[voce.a]?.caldo ? " contatore--caldo" : ""}`}>{conteggi[voce.a]?.valore}</em> : null}
                </Link>
                {voce.sotto?.length ? (
                  <div className="foglio__sotto">
                    {voce.sotto.map((sotto) => <Link key={sotto.a} to={sotto.a} onClick={onChiudi}>{sotto.etichetta}</Link>)}
                  </div>
                ) : null}
              </section>
            ))}
          </nav>
        </div>
      </div>
    </>,
    document.body
  )
}
