import { Check, Globe, Store, Truck, X, type LucideIcon } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { anima, CURVE, entraRighe, useUscita } from "../../movimenti"
import { Modale } from "../../ui"
import { iniziali } from "./dati"
import type { Canale } from "./tipi"

export type TonoPillola = "ok" | "attesa" | "errore" | "info" | "neutro"

export function Pillola({ tono, children }: { tono: TonoPillola; children: ReactNode }) {
  return <span className={`etichetta etichetta--${tono} ord-pillola`}><i aria-hidden="true" />{children}</span>
}

const ICONE_CANALE: Record<Canale, { icona: LucideIcon; testo: string }> = {
  online: { icona: Globe, testo: "Online" },
  cassa: { icona: Store, testo: "Shop" },
  ingrosso: { icona: Truck, testo: "Wholesale" },
}

export function Canale({ canale }: { canale: Canale }) {
  const { icona: Icona, testo } = ICONE_CANALE[canale]
  return <span className={`ord-canale ord-canale--${canale}`}><Icona size={14} aria-hidden="true" />{testo}</span>
}

export function Avatar({ nome, piccolo }: { nome: string; piccolo?: boolean }) {
  return <span className={piccolo ? "ord-av ord-av--s" : "ord-av"} aria-hidden="true">{iniziali(nome)}</span>
}

export function Mini({ url, titolo, misura = "s" }: { url: string | null; titolo: string; misura?: "s" | "m" | "l" }) {
  return (
    <span className={`ord-mini ord-mini--${misura}`} aria-hidden="true">
      {url ? <img src={url} alt="" loading="lazy" /> : <b>{iniziali(titolo)}</b>}
    </span>
  )
}

export function Casella({ acceso, misto, etichetta, onCambia }: { acceso: boolean; misto?: boolean; etichetta: string; onCambia: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      className={acceso || misto ? "ord-casella ord-casella--su" : "ord-casella"}
      aria-checked={misto ? "mixed" : acceso}
      aria-label={etichetta}
      onClick={(e) => {
        e.stopPropagation()
        onCambia()
      }}
    >
      {acceso ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : misto ? <i aria-hidden="true" /> : null}
    </button>
  )
}

export function Tessera({ icona: Icona, tono, valore, testo }: { icona: LucideIcon; tono: "rosso" | "giallo" | "blu" | "rosa" | "verde"; valore: ReactNode; testo: string }) {
  return (
    <div className="ord-tessera vetro">
      <span className={`ord-tessera__icona ord-tono--${tono}`}><Icona size={20} aria-hidden="true" /></span>
      <span>
        <b>{valore}</b>
        <small>{testo}</small>
      </span>
    </div>
  )
}

export function Segmenti<T extends string>({ voci, valore, etichetta, onCambia }: { voci: { valore: T; testo: string; icona?: LucideIcon }[]; valore: T; etichetta: string; onCambia: (v: T) => void }) {
  return (
    <div className="selettore" role="group" aria-label={etichetta}>
      {voci.map(({ valore: v, testo, icona: Icona }) => (
        <button key={v} type="button" className={v === valore ? "attivo" : undefined} aria-pressed={v === valore} onClick={() => onCambia(v)}>
          {Icona ? <Icona size={15} aria-hidden="true" /> : null}
          {testo}
        </button>
      ))}
    </div>
  )
}

/** Le righe scritte a mano rientrano come quelle di `Tabella` quando l'utente cambia filtro o ordinamento. */
export function useRigheRientrano(chiavi: string) {
  const guscio = useRef<HTMLDivElement>(null)
  const prima = useRef(chiavi)
  useLayoutEffect(() => {
    if (prima.current === chiavi) return
    prima.current = chiavi
    if (guscio.current) entraRighe(guscio.current)
  }, [chiavi])
  return guscio
}

const FUORI = "translateX(calc(100% + 12px))"
const SOTTO = "translateY(100%)"
const telefono = () => window.matchMedia("(max-width: 860px)").matches

/** Cassetto della scheda ordine: da destra sullo schermo largo, dal basso sul telefono. */
export function Cassetto({ titolo, sottotitolo, onChiudi, piede, children }: { titolo: string; sottotitolo?: string; onChiudi: () => void; piede?: ReactNode; children: ReactNode }) {
  const velo = useRef<HTMLDivElement>(null)
  const finestra = useRef<HTMLDivElement>(null)
  const chiusura = useRef(onChiudi)
  chiusura.current = onChiudi

  useLayoutEffect(() => {
    if (!velo.current || !finestra.current) return
    const animazioni = [
      anima(velo.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: CURVE.fuori1 }),
      anima(finestra.current, [{ transform: telefono() ? SOTTO : FUORI }, { transform: "none" }], { duration: 500, easing: CURVE.fuori3 }),
    ]
    return () => animazioni.forEach((a) => a?.cancel())
  }, [])

  useUscita(velo, (copia) => [
    anima(copia, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: CURVE.fuori1, fill: "forwards" }),
    anima(copia.querySelector(".ord-cassetto")!, [{ transform: "none" }, { transform: telefono() ? SOTTO : FUORI }], { duration: 280, easing: CURVE.dentro1, fill: "forwards" }),
  ])

  useEffect(() => {
    const precedente = document.activeElement as HTMLElement | null
    finestra.current?.focus({ preventScroll: true })
    const tasto = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector(".modale") && chiusura.current()
    document.addEventListener("keydown", tasto)
    return () => {
      document.removeEventListener("keydown", tasto)
      precedente?.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div className="velo ord-velo" ref={velo} onMouseDown={(e) => e.target === e.currentTarget && onChiudi()}>
      <div className="ord-cassetto" role="dialog" aria-modal="true" aria-label={titolo} tabIndex={-1} ref={finestra}>
        <div className="ord-cassetto__presa" aria-hidden="true"><i /></div>
        <header className="ord-cassetto__testa">
          <div>
            <h2>{titolo}</h2>
            {sottotitolo ? <p>{sottotitolo}</p> : null}
          </div>
          <button type="button" className="icona-pulsante icona-pulsante--piatta ord-icona" aria-label="Close" onClick={onChiudi}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="ord-cassetto__corpo">{children}</div>
        {piede ? <footer className="ord-cassetto__piede">{piede}</footer> : null}
      </div>
    </div>,
    document.body
  )
}

export function Finestra({ titolo, sottotitolo, stretta, onChiudi, children }: { titolo: string; sottotitolo?: string; stretta?: boolean; onChiudi: () => void; children: ReactNode }) {
  return (
    <Modale titolo={titolo} sottotitolo={sottotitolo} onChiudi={onChiudi}>
      {stretta ? <span className="ord-stretta" hidden /> : null}
      {children}
    </Modale>
  )
}

export function Domanda({ titolo, testo, azione, attesa, onConferma, onChiudi }: { titolo: string; testo: string; azione: string; attesa: boolean; onConferma: () => void; onChiudi: () => void }) {
  return (
    <Modale titolo={titolo} sottotitolo={testo} onChiudi={onChiudi}>
      <span className="ord-stretta" hidden />
      <div className="ord-piede-modulo">
        <button type="button" onClick={onChiudi}>Cancel</button>
        <button type="button" className="ord-btn--scuro" disabled={attesa} onClick={onConferma}>{azione}</button>
      </div>
    </Modale>
  )
}

export function Etichetta({ children }: { children: ReactNode }) {
  return <div className="ord-etichetta">{children}</div>
}
