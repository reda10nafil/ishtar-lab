import { useQuery } from "@tanstack/react-query"
import { Minus, Plus, X } from "lucide-react"
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as EventoPuntatore, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import { api } from "../../api/client"
import { Schede, type VoceScheda } from "../../componenti"
import { numero, STATI_PRODOTTO } from "../../lingua"
import { anima, Cifra, CURVE, scorri, type Bordi } from "../../movimenti"
import { usePermessi } from "../../permessi"
import { euro } from "../../ui"

const TINTE = 6
const DURATA_CHIUSURA = 170

/** «Archiviato» esiste solo nel catalogo: per Medusa è una bozza. */
export const STATI_CATALOGO = { ...STATI_PRODOTTO, archived: { testo: "Archived", tono: "neutro" as const } }

/** Senza una tinta scelta, stessa tinta per lo stesso nome: il prodotto senza foto resta riconoscibile. */
const tintaDi = (titolo: string) => [...titolo].reduce((somma, lettera) => somma + lettera.charCodeAt(0), 0) % TINTE

/** Foto del prodotto; se manca o non si carica mostra un riquadro con le iniziali. */
export function FotoProdotto({ url, titolo, tinta, classe = "" }: { url: string | null; titolo: string; tinta?: number | null; classe?: string }) {
  const [rotta, setRotta] = useState(false)
  if (url && !rotta) return <img className={`foto-prodotto ${classe}`} src={url} alt="" onError={() => setRotta(true)} />
  return (
    <span className={`foto-prodotto foto-prodotto--vuota foto-prodotto--t${tinta ?? tintaDi(titolo)} ${classe}`} aria-hidden="true">
      <b>{titolo.slice(0, 2).toUpperCase()}</b>
    </span>
  )
}

/** Colore della tessera mostrata quando il prodotto non ha una foto. */
export function ScegliTinta({ valore, onCambia }: { valore: number; onCambia: (tinta: number) => void }) {
  const etichetta = useId()
  return (
    <div className="campo">
      <span id={etichetta}>Tile colour</span>
      <div className="tinte" role="radiogroup" aria-labelledby={etichetta}>
        {Array.from({ length: TINTE }, (_, indice) => (
          <button key={indice} type="button" role="radio" className={`tinta foto-prodotto--t${indice}`} aria-checked={valore === indice} aria-label={`Colour ${indice + 1}`} onClick={() => onCambia(indice)} />
        ))}
      </div>
    </div>
  )
}

export function SchedeProdotti() {
  const { puo } = usePermessi()
  const basse = useQuery({
    queryKey: ["magazzino", "avvisi", "/admin/magazzino"],
    queryFn: () => api<{ conteggio: number }>("/admin/magazzino/scorte-basse"),
    enabled: puo("magazzino", "view"),
  })
  const voci: VoceScheda[] = [{ a: "/prodotti/catalogo", etichetta: "Catalogue" }]
  if (puo("magazzino", "view")) voci.push({ a: "/magazzino", etichetta: "Inventory", conteggio: basse.data?.conteggio })
  if (puo("product_collections", "view")) voci.push({ a: "/prodotti/collezioni", etichetta: "Collections" })
  return (
    <div className="schede-prodotti">
      <Schede voci={voci} etichetta="Product sections" />
    </div>
  )
}

export function prezzoDa(minimo: number | null, massimo: number | null) {
  if (minimo === null || massimo === null) return "Price to be set"
  return minimo === massimo ? euro(minimo) : `${euro(minimo)} – ${euro(massimo)}`
}

/** Una sola misura per carte e tessere: il prezzo più basso, con + se le offerte sono diverse. */
export function prezzoBreve(minimo: number | null, massimo: number | null) {
  if (minimo === null || massimo === null) return "No price"
  return minimo === massimo ? euro(minimo) : `${euro(minimo)}+`
}

/** Scorte con il pallino di colore: verde, ambra al punto di riordino, rosso se finite. */
export function ChipScorte({ scorte, bassa = false }: { scorte: number; bassa?: boolean }) {
  const tono = scorte <= 0 ? "errore" : bassa ? "attesa" : "ok"
  return <span className={`chip-scorte chip-scorte--${tono}`}>{scorte > 0 ? `${numero(scorte)} in stock` : "Sold out"}</span>
}

type VoceSegmento<T> = { valore: T; testo?: string; icona?: ReactNode; etichetta?: string }

/** Scelta a segmenti con il cursore che scorre fino alla voce attiva. */
export function Segmento<T extends string>({ voci, valore, etichetta, onCambia }: { voci: VoceSegmento<T>[]; valore: T; etichetta: string; onCambia: (valore: T) => void }) {
  const contenitore = useRef<HTMLDivElement>(null)
  const cursore = useRef<HTMLSpanElement>(null)
  const posizione = useRef<Bordi | null>(null)

  const disegna = useCallback((bordi: Bordi) => {
    posizione.current = bordi
    if (!cursore.current) return
    cursore.current.style.width = `${bordi.fine - bordi.inizio}px`
    cursore.current.style.transform = `translateX(${bordi.inizio}px)`
  }, [])
  const voce = useCallback(() => {
    const attivo = contenitore.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    return attivo ? { inizio: attivo.offsetLeft, fine: attivo.offsetLeft + attivo.offsetWidth } : null
  }, [])

  useLayoutEffect(() => {
    const arrivo = voce()
    if (!arrivo) return
    if (posizione.current) return scorri(posizione.current, arrivo, disegna)
    disegna(arrivo)
  }, [disegna, valore, voce])

  // Il carattere in ritardo, una voce in più o il telefono cambiano la misura: il cursore la segue senza scorrere.
  useEffect(() => {
    const osservatore = new ResizeObserver(() => {
      const misura = voce()
      if (misura) disegna(misura)
    })
    contenitore.current?.querySelectorAll("button").forEach((pulsante) => osservatore.observe(pulsante))
    return () => osservatore.disconnect()
  }, [disegna, voce, voci.length])

  return (
    <div className="segmento-prodotti" role="group" aria-label={etichetta} ref={contenitore}>
      <span className="segmento-prodotti__cursore" aria-hidden="true" ref={cursore} />
      {voci.map((voce) => (
        <button key={voce.valore} type="button" aria-label={voce.etichetta} aria-pressed={valore === voce.valore} onClick={() => onCambia(voce.valore)}>
          {voce.icona}
          {voce.testo}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ valore, etichetta, disattivo, onCambia }: { valore: number; etichetta: string; disattivo?: boolean; onCambia: (valore: number) => void }) {
  return (
    <span className="stepper">
      <button type="button" aria-label={`One fewer: ${etichetta}`} disabled={disattivo} onClick={() => valore > 0 && onCambia(valore - 1)}>
        <Minus size={15} aria-hidden="true" />
      </button>
      <output aria-label={etichetta}>{numero(valore)}</output>
      <button type="button" className="stepper__piu" aria-label={`One more: ${etichetta}`} disabled={disattivo} onClick={() => onCambia(valore + 1)}>
        <Plus size={15} aria-hidden="true" />
      </button>
    </span>
  )
}

const LARGO_GRAFICO = 432
const ALTO_GRAFICO = 56
const MARGINE_GRAFICO = 2

/** Curva morbida fra i punti: passa da ciascuno senza spigoli. */
function curva(punti: [number, number][]) {
  return punti.reduce((tratto, [x, y], indice) => {
    if (!indice) return `M${x} ${y}`
    const [xPrima, yPrima] = punti[indice - 1]
    const meta = (xPrima + x) / 2
    return `${tratto} C${meta} ${yPrima} ${meta} ${y} ${x} ${y}`
  }, "")
}

/** Vendite degli ultimi giorni. Senza vendite la linea resta piatta: niente numeri inventati. */
export function Grafico({ valori, etichetta }: { valori: number[]; etichetta: string }) {
  const massimo = Math.max(...valori, 1)
  const passo = (LARGO_GRAFICO - MARGINE_GRAFICO * 2) / Math.max(valori.length - 1, 1)
  const alto = ALTO_GRAFICO - MARGINE_GRAFICO * 2
  const punti = valori.map((v, i): [number, number] => [MARGINE_GRAFICO + i * passo, MARGINE_GRAFICO + alto - (v / massimo) * alto])
  const linea = curva(punti)
  return (
    <svg className="grafico" data-fermo="" viewBox={`0 0 ${LARGO_GRAFICO} ${ALTO_GRAFICO}`} preserveAspectRatio="none" role="img" aria-label={etichetta}>
      <path className="grafico__area" d={`${linea} L${LARGO_GRAFICO - MARGINE_GRAFICO} ${ALTO_GRAFICO} L${MARGINE_GRAFICO} ${ALTO_GRAFICO} Z`} />
      <path className="grafico__linea" d={linea} pathLength={1} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

type ProprietaCassetto = {
  titolo: string
  sottotitolo?: string
  onChiudi: () => void
  /** Con una finestra aperta sopra, Esc e il clic fuori chiudono solo quella. */
  bloccato?: boolean
  piede?: ReactNode
  children: ReactNode
}

const senzaMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

const SU_TELEFONO = "(max-width: 860px)"
const QUOTA_CHIUSURA = 0.3
const VELOCITA_CHIUSURA = 600
const SPOSTAMENTO_MINIMO = 60
const DURATA_RITORNO = 300

/** Su telefono il foglio segue il dito dalla testa: lontano o veloce si chiude, altrimenti torna su. */
function useTrascinamento(finestra: RefObject<HTMLElement>, onChiudi: () => void) {
  const presa = useRef<{ inizio: number; ultimo: number; tempo: number; velocita: number } | null>(null)
  const scosta = (spostamento: number) => {
    const nodo = finestra.current
    if (!nodo) return
    nodo.style.setProperty("--scosta", `${spostamento}px`)
    nodo.style.transform = spostamento ? `translateY(${spostamento}px)` : ""
  }

  const giu = (e: EventoPuntatore<HTMLElement>) => {
    const bersaglio = e.target as HTMLElement
    const sullaTesta = bersaglio === finestra.current || bersaglio.closest(".cassetto__testa")
    if (!window.matchMedia(SU_TELEFONO).matches || !sullaTesta || bersaglio.closest("button")) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    presa.current = { inizio: e.clientY, ultimo: e.clientY, tempo: e.timeStamp, velocita: 0 }
  }
  const muovi = (e: EventoPuntatore<HTMLElement>) => {
    const attuale = presa.current
    if (!attuale) return
    const passato = e.timeStamp - attuale.tempo
    if (passato > 0) attuale.velocita = ((e.clientY - attuale.ultimo) / passato) * 1000
    attuale.ultimo = e.clientY
    attuale.tempo = e.timeStamp
    scosta(Math.max(0, e.clientY - attuale.inizio))
  }
  const su = (e: EventoPuntatore<HTMLElement>) => {
    const attuale = presa.current
    if (!attuale) return
    presa.current = null
    const spostamento = Math.max(0, e.clientY - attuale.inizio)
    const altezza = finestra.current?.offsetHeight ?? 0
    if (spostamento > altezza * QUOTA_CHIUSURA || (attuale.velocita > VELOCITA_CHIUSURA && spostamento > SPOSTAMENTO_MINIMO)) return onChiudi()
    scosta(0)
    if (finestra.current && spostamento) anima(finestra.current, [{ transform: `translateY(${spostamento}px)` }, { transform: "none" }], { duration: DURATA_RITORNO, easing: CURVE.entrata })
  }
  return { onPointerDown: giu, onPointerMove: muovi, onPointerUp: su, onPointerCancel: su }
}

/** Scheda laterale sopra l'elenco: l'elenco resta dietro con i suoi filtri. */
export function Cassetto({ titolo, sottotitolo, onChiudi, bloccato = false, piede, children }: ProprietaCassetto) {
  const finestra = useRef<HTMLElement>(null)
  const [uscita, setUscita] = useState(false)

  const chiudi = useCallback(() => {
    if (senzaMovimento()) {
      onChiudi()
      return
    }
    setUscita(true)
    setTimeout(onChiudi, DURATA_CHIUSURA)
  }, [onChiudi])

  const trascina = useTrascinamento(finestra, chiudi)

  useEffect(() => {
    const precedente = document.activeElement as HTMLElement | null
    finestra.current?.focus()
    return () => precedente?.focus()
  }, [])

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !bloccato) chiudi()
    }
    document.addEventListener("keydown", tasto)
    return () => document.removeEventListener("keydown", tasto)
  }, [bloccato, chiudi])

  return createPortal(
    <div className={`velo velo--cassetto${uscita ? " velo--esce" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && !bloccato && chiudi()}>
      <aside className={`cassetto${uscita ? " cassetto--esce" : ""}`} role="dialog" aria-modal="true" aria-label={titolo} tabIndex={-1} ref={finestra} {...trascina}>
        <header className="cassetto__testa">
          <div>
            <h2>{titolo}</h2>
            {sottotitolo ? <p>{sottotitolo}</p> : null}
          </div>
          <button type="button" className="icona-pulsante icona-pulsante--piatta" onClick={chiudi} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="cassetto__corpo">{children}</div>
        {piede ? <footer className="cassetto__piede">{piede}</footer> : null}
      </aside>
    </div>,
    document.body
  )
}

export function Tessera({ etichetta, valore, conteggio }: { etichetta: string; valore?: string; conteggio?: number }) {
  return (
    <div className="tessera-prodotto">
      <small>{etichetta}</small>
      <b>{conteggio === undefined ? valore : <Cifra valore={conteggio} formato={numero} />}</b>
    </div>
  )
}

export function Dato({ etichetta, valore }: { etichetta: string; valore: string | null | undefined }) {
  return (
    <>
      <dt>{etichetta}</dt>
      <dd>{valore || "Not set"}</dd>
    </>
  )
}

export const EtichettaSezione = ({ children, azione }: { children: ReactNode; azione?: ReactNode }) => (
  <div className="etichetta-sezione">
    <span>{children}</span>
    {azione}
  </div>
)
