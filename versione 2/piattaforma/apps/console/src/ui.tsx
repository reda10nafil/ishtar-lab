import { X } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { anima, CURVE, Titolo, useUscita } from "./movimenti"
import { formattaImporto } from "./valuta"

export function Pagina({ titolo, sottotitolo, azioni, children }: { titolo: string; sottotitolo: string; azioni?: ReactNode; children: ReactNode }) {
  return (
    <div className="pagina">
      <div className="pagina__testa">
        <div className="pagina__titoli">
          <Titolo testo={titolo} />
          <p>{sottotitolo}</p>
        </div>
        {azioni}
      </div>
      {children}
    </div>
  )
}

const FOCALIZZABILE = "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])"

export function Modale({ titolo, sottotitolo, onChiudi, children }: { titolo: string; sottotitolo?: string; onChiudi: () => void; children: ReactNode }) {
  const velo = useRef<HTMLDivElement>(null)
  const finestra = useRef<HTMLDivElement>(null)
  const chiudi = useRef(onChiudi)
  chiudi.current = onChiudi

  useLayoutEffect(() => {
    if (!velo.current || !finestra.current) return
    const animazioni = [
      anima(velo.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: CURVE.fuori1 }),
      anima(finestra.current, [{ opacity: 0, transform: "scale(0.86)" }, { opacity: 1, transform: "none" }], { duration: 480, easing: CURVE.modale }),
    ]
    return () => animazioni.forEach((a) => a?.cancel())
  }, [])

  useUscita(velo, (copia) => [
    anima(copia, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: CURVE.fuori1, fill: "forwards" }),
    anima(copia.querySelector(".modale")!, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.94)" }], { duration: 200, easing: CURVE.dentro2, fill: "forwards" }),
  ])

  useEffect(() => {
    const precedente = document.activeElement as HTMLElement | null
    const primo = finestra.current?.querySelector<HTMLElement>(FOCALIZZABILE)
    ;(primo ?? finestra.current)?.focus({ preventScroll: true })
    const tasto = (e: KeyboardEvent) => e.key === "Escape" && chiudi.current()
    document.addEventListener("keydown", tasto)
    return () => {
      document.removeEventListener("keydown", tasto)
      precedente?.focus({ preventScroll: true })
    }
    // Una volta sola: se il genitore si aggiorna con i dati, il cursore resta nel campo in cui si sta scrivendo.
  }, [])

  return createPortal(
    <div className="velo" ref={velo} onMouseDown={(e) => e.target === e.currentTarget && onChiudi()}>
      <div className="modale vetro" role="dialog" aria-modal="true" aria-label={titolo} tabIndex={-1} ref={finestra}>
        <header>
          <div>
            <h2>{titolo}</h2>
            {sottotitolo ? <p>{sottotitolo}</p> : null}
          </div>
          <button type="button" className="icona-pulsante icona-pulsante--piatta" onClick={onChiudi} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="modale__corpo">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export function Etichetta({ tono, children }: { tono: "ok" | "attesa" | "errore" | "info" | "neutro"; children: ReactNode }) {
  return <span className={`etichetta etichetta--${tono}`}>{children}</span>
}

export function Stato({ caricamento, errore, vuoto, testoVuoto }: { caricamento: boolean; errore: unknown; vuoto: boolean; testoVuoto: string }) {
  if (caricamento) return <p className="avviso-stato avviso-stato--carico">Loading...</p>
  if (errore) return <p className="avviso-stato avviso-stato--errore" role="alert">{(errore as Error).message}</p>
  if (vuoto) return <p className="avviso-stato">{testoVuoto}</p>
  return null
}

export function Campo({ etichetta, aiuto, children }: { etichetta: string; aiuto?: string | null; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{etichetta}</span>
      {children}
      {aiuto ? <small>{aiuto}</small> : null}
    </label>
  )
}

export function Anteprima({ url, titolo }: { url: string | null; titolo: string }) {
  return url ? (
    <img className="anteprima" src={url} alt="" loading="lazy" />
  ) : (
    <span className="anteprima anteprima--vuota" aria-hidden="true">{titolo.slice(0, 2).toUpperCase()}</span>
  )
}

export function Conferma({ titolo, testo, azione, attesa, onConferma, onChiudi }: { titolo: string; testo: string; azione: string; attesa: boolean; onConferma: () => void; onChiudi: () => void }) {
  return (
    <Modale titolo={titolo} sottotitolo={testo} onChiudi={onChiudi}>
      <div className="riga__azioni">
        <button type="button" className="primario" disabled={attesa} onClick={onConferma}>{azione}</button>
        <button type="button" onClick={onChiudi}>Cancel</button>
      </div>
    </Modale>
  )
}

const FORMATO_DATA = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })
const FORMATO_DATA_ORA = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })

export const dataBreve = (valore: string | Date) => FORMATO_DATA.format(new Date(valore))
export const dataOra = (valore: string | Date) => FORMATO_DATA_ORA.format(new Date(valore))
export const euro = (valore: number | null | undefined) => (valore === null || valore === undefined ? "–" : formattaImporto(valore))
