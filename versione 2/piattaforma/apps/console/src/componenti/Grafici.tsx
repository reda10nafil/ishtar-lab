import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { anima, CURVE, movimentoRidotto } from "../movimenti"
import { euro } from "../ui"
import "../sezioni/analisi/grafici.css"

export type SerieGrafico = { id: string; nome: string; colore: string; valori: number[] }
export type PuntoAsse = { etichetta: string; dettaglio: string; futuro?: boolean }

type Punto = [x: number, y: number]

const ALTO = 14
const SOTTO = 26
const DURATA_PRIMA = 1100
const DURATA_CAMBIO = 620
const RITARDO_PRIMA = 150

const fuori5 = (u: number) => 1 - (1 - u) ** 5

/** Importo breve per assi e pillole: passa dal formattatore unico, quindi segue la valuta del negozio. */
export function compatto(valore: number) {
  const assoluto = Math.abs(valore)
  if (assoluto >= 10_000) return euro(Math.round(valore / 1000)).replace(/\.00$/, "") + "k"
  if (assoluto >= 1000) return euro(valore / 1000).replace(/(\.\d)\d$/, "$1") + "k"
  return euro(Math.round(valore)).replace(/\.00$/, "")
}

/** Curva morbida che passa da tutti i punti: non scende mai sotto la linea di base. */
export function curva(punti: Punto[], base = Infinity) {
  if (!punti.length) return ""
  const cifra = (n: number) => n.toFixed(1)
  let d = `M${cifra(punti[0][0])},${cifra(punti[0][1])}`
  for (let i = 0; i < punti.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [punti[i - 1] ?? punti[i], punti[i], punti[i + 1], punti[i + 2] ?? punti[i + 1]]
    const c1y = Math.min(base, p1[1] + (p2[1] - p0[1]) / 6)
    const c2y = Math.min(base, p2[1] - (p3[1] - p1[1]) / 6)
    d += ` C${cifra(p1[0] + (p2[0] - p0[0]) / 6)},${cifra(c1y)} ${cifra(p2[0] - (p3[0] - p1[0]) / 6)},${cifra(c2y)} ${cifra(p2[0])},${cifra(p2[1])}`
  }
  return d
}

/** Passo pulito degli assi: quattro intervalli, con passi da 1, 2 o 5 per potenza di dieci. */
export function passoAsse(massimo: number, interi = false) {
  const voluto = Math.max(massimo, 1) / 4
  const potenza = 10 ** Math.floor(Math.log10(voluto))
  const scelta = [1, 2, 5, 10].find((p) => p * potenza >= voluto) ?? 10
  return interi ? Math.max(1, scelta * potenza) : scelta * potenza
}

function useMisura<T extends HTMLElement>() {
  const nodo = useRef<T>(null)
  const [misura, setMisura] = useState({ larghezza: 0, altezza: 0 })
  useLayoutEffect(() => {
    const elemento = nodo.current
    if (!elemento) return
    const leggi = () => setMisura({ larghezza: elemento.clientWidth, altezza: elemento.clientHeight })
    leggi()
    const spia = new ResizeObserver(leggi)
    spia.observe(elemento)
    return () => spia.disconnect()
  }, [])
  return [nodo, misura] as const
}

/** Quante etichette ci stanno dipende dallo spazio: mai due attaccate, l'ultima sempre presente. */
function indiciEtichette(quanti: number, piano: number) {
  const spazio = piano / Math.max(quanti - 1, 1)
  const passo = spazio >= 80 ? 1 : spazio >= 40 ? 2 : spazio >= 18 ? 3 : Math.ceil(60 / spazio)
  const scelti = Array.from({ length: quanti }, (_, i) => i).filter((i) => i % passo === 0 && i <= quanti - 1 - passo)
  return quanti ? [...scelti, quanti - 1] : []
}

const ricampiona = (valori: number[], quanti: number) =>
  Array.from({ length: quanti }, (_, i) => {
    if (valori.length < 2) return valori[0] ?? 0
    const posizione = (i / Math.max(quanti - 1, 1)) * (valori.length - 1)
    const sotto = Math.floor(posizione)
    return valori[sotto] + (valori[Math.min(sotto + 1, valori.length - 1)] - valori[sotto]) * (posizione - sotto)
  })

/** Porta le altezze disegnate verso le nuove, fotogramma per fotogramma: `disegna` scrive direttamente nei tracciati. */
function usePassaggio(arrivo: number[][], disegna: (livelli: number[][]) => void, pronto: boolean) {
  const attuali = useRef<number[][] | null>(null)
  useLayoutEffect(() => {
    if (!pronto) return
    const prima = attuali.current
    const lunghezza = arrivo[0]?.length ?? 0
    const partenza = arrivo.map((serie, i) => (prima?.[i] ? ricampiona(prima[i], lunghezza) : serie.map(() => 0)))
    if (movimentoRidotto()) {
      attuali.current = arrivo
      disegna(arrivo)
      return
    }
    const durata = prima ? DURATA_CAMBIO : DURATA_PRIMA
    const ritardo = prima ? 0 : RITARDO_PRIMA
    const inizio = performance.now()
    disegna(partenza)
    let giro = 0
    const passo = (adesso: number) => {
      const u = Math.min(1, Math.max(0, (adesso - inizio - ritardo) / durata))
      const k = fuori5(u)
      const livelli = arrivo.map((serie, i) => serie.map((v, j) => partenza[i][j] + (v - partenza[i][j]) * k))
      attuali.current = livelli
      disegna(livelli)
      if (u < 1) giro = requestAnimationFrame(passo)
    }
    giro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(giro)
    // `arrivo` cambia con i dati; `disegna` legge sempre i tracciati correnti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivo, pronto])
}

type ProprietaAree = {
  assi: PuntoAsse[]
  serie: SerieGrafico[]
  formato?: (valore: number) => string
  tacca?: (valore: number) => string
  etichetta: string
  /** Area appena accennata sotto la linea: per una misura sola, come nel report. */
  tenue?: boolean
  /** Per ciò che si conta a pezzi: niente tacche come 0,5. */
  interi?: boolean
  /** Linea tratteggiata del periodo di confronto, sopra le aree. */
  confronto?: number[]
}

/** Aree impilate con mirino e riquadro: mouse, tocco e frecce della tastiera danno gli stessi valori. */
export function GraficoAree({ assi, serie, formato = euro, tacca = compatto, etichetta, tenue = false, interi = false, confronto }: ProprietaAree) {
  const [guscio, { larghezza, altezza }] = useMisura<HTMLDivElement>()
  const riempimenti = useRef<(SVGPathElement | null)[]>([])
  const linee = useRef<(SVGPathElement | null)[]>([])
  const tratteggio = useRef<SVGPathElement>(null)
  const [scelto, setScelto] = useState<number | null>(null)
  const sinistra = larghezza < 500 ? 38 : 46
  const piano = Math.max(larghezza - sinistra, 1)
  const base = Math.max(altezza - SOTTO, ALTO + 1)
  const quanti = assi.length
  const disegnati = assi.filter((a) => !a.futuro).length
  const asseX = (i: number) => (quanti > 1 ? (i / (quanti - 1)) * piano : 0)

  const pile = useMemo(() => {
    let sotto = Array.from({ length: disegnati }, () => 0)
    return serie.map((s) => {
      sotto = sotto.map((v, i) => v + (s.valori[i] ?? 0))
      return sotto
    })
  }, [serie, disegnati])

  const massimo = Math.max(0, ...(pile.at(-1) ?? []), ...(confronto ?? []))
  const passo = passoAsse(massimo, interi)
  const cima = passo * 4
  const asseY = (v: number) => base - (v / cima) * (base - ALTO)
  const arrivo = useMemo(() => [...pile, ...(confronto ? [confronto] : [])].map((p) => p.map((v) => v / cima)), [pile, confronto, cima])

  const disegna = (livelli: number[][]) => {
    livelli.forEach((pila, i) => {
      const y = (q: number) => base - q * (base - ALTO)
      const sopra = pila.map((q, j): Punto => [asseX(j), y(q)])
      if (i >= serie.length) {
        tratteggio.current?.setAttribute("d", curva(sopra, base))
        return
      }
      const sotto = (livelli[i - 1] ?? pila.map(() => 0)).map((q, j): Punto => [asseX(j), y(q)])
      const ritorno = curva([...sotto].reverse(), base).replace(/^M/, "L")
      riempimenti.current[i]?.setAttribute("d", sopra.length ? `${curva(sopra, base)} ${ritorno} Z` : "")
      linee.current[i]?.setAttribute("d", curva(sopra, base))
    })
  }
  usePassaggio(arrivo, disegna, larghezza > 0 && altezza > 0)

  const daPuntatore = (e: PointerEvent<HTMLDivElement>) => {
    const posizione = e.clientX - e.currentTarget.getBoundingClientRect().left - sinistra
    const indice = Math.round((posizione / piano) * (quanti - 1))
    setScelto(Math.min(Math.max(indice, 0), disegnati - 1))
  }
  const daTastiera = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") setScelto(null)
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    const verso = e.key === "ArrowLeft" ? -1 : 1
    setScelto((i) => Math.min(Math.max((i ?? disegnati - 1) + (i === null ? 0 : verso), 0), disegnati - 1))
  }

  const scala = [4, 3, 2, 1, 0].map((n) => n * passo)
  const quante = serie.map((s) => (scelto === null ? 0 : s.valori[scelto] ?? 0))
  const totale = quante.reduce((a, b) => a + b, 0)
  const puntoX = scelto === null ? 0 : asseX(scelto)
  const aDestra = puntoX + 190 < piano
  const etichette = indiciEtichette(quanti, piano)

  return (
    <div
      ref={guscio}
      className="graf"
      style={{ paddingLeft: sinistra }}
      tabIndex={0}
      role="img"
      aria-label={etichetta}
      onPointerMove={daPuntatore}
      onPointerLeave={() => setScelto(null)}
      onBlur={() => setScelto(null)}
      onKeyDown={daTastiera}
    >
      <div className="graf__griglia" aria-hidden="true">
        {scala.map((v) => (
          <div key={v} className="graf__linea" style={{ top: asseY(v) }}>
            <span>{tacca(v)}</span>
          </div>
        ))}
      </div>
      <svg className="graf__tela" width={piano} height={altezza} viewBox={`0 0 ${piano} ${altezza}`} aria-hidden="true">
        <defs>
          {serie.map((s) => (
            <linearGradient key={s.id} id={`graf-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.colore} stopOpacity={tenue ? 0.26 : 0.9} />
              <stop offset="1" stopColor={s.colore} stopOpacity={tenue ? 0.03 : 0.62} />
            </linearGradient>
          ))}
        </defs>
        {serie.map((s, i) => (
          <path key={s.id} ref={(n) => { riempimenti.current[i] = n }} fill={`url(#graf-${s.id})`} className={tenue ? undefined : "graf__area"} />
        ))}
        {confronto ? <path ref={tratteggio} fill="none" className="graf__confronto" /> : null}
        {serie.map((s, i) => (
          <path key={s.id} ref={(n) => { linee.current[i] = n }} fill="none" stroke={s.colore} className="graf__tratto" />
        ))}
      </svg>
      <div className="graf__asse" aria-hidden="true" style={{ left: sinistra }}>
        {etichette.map((i) => (
          <span key={i} style={{ left: asseX(i), transform: i === 0 ? undefined : i === quanti - 1 ? "translateX(-100%)" : "translateX(-50%)" }}>{assi[i].etichetta}</span>
        ))}
      </div>
      {scelto !== null ? (
        <div aria-hidden="true">
          <i className="graf__mirino" style={{ left: sinistra + puntoX }} />
          <i className="graf__segno" style={{ left: sinistra + puntoX, top: asseY(totale) }} />
          <div className="graf__nota" style={{ left: sinistra + puntoX, top: Math.max(0, asseY(totale) - 130), transform: aDestra ? "translateX(16px)" : "translateX(calc(-100% - 16px))" }}>
            <small>{assi[scelto].dettaglio}</small>
            <strong>{tacca(totale)}</strong>
            {serie.length > 1
              ? [...serie].reverse().map((s) => (
                  <span key={s.id}>
                    <i style={{ background: s.colore }} /> {s.nome} <b>{tacca(s.valori[scelto] ?? 0)}</b>
                  </span>
                ))
              : null}
            {confronto ? <span><i style={{ background: "var(--testo-2)" }} /> A month earlier <b>{tacca(confronto[scelto] ?? 0)}</b></span> : null}
          </div>
        </div>
      ) : null}
      <table className="nascosto">
        <caption>{etichetta}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {serie.map((s) => <th key={s.id} scope="col">{s.nome}</th>)}
          </tr>
        </thead>
        <tbody data-fermo>
          {assi.slice(0, disegnati).map((a, i) => (
            <tr key={`${a.etichetta}-${i}`} data-fermo>
              <th scope="row">{a.dettaglio}</th>
              {serie.map((s) => <td key={s.id}>{formato(s.valori[i] ?? 0)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Linea singola del report, con la stessa tela delle aree. */
export function GraficoLinea({ assi, nome, colore, valori, formato, tacca, etichetta, interi, confronto }: { assi: PuntoAsse[]; nome: string; colore: string; valori: number[]; formato: (v: number) => string; tacca?: (v: number) => string; etichetta: string; interi?: boolean; confronto?: number[] }) {
  const serie = useMemo(() => [{ id: "unica", nome, colore, valori }], [nome, colore, valori])
  return <GraficoAree assi={assi} serie={serie} formato={formato} tacca={tacca ?? formato} etichetta={etichetta} interi={interi} confronto={confronto} tenue />
}

/** Colonne verticali: una per voce, che salgono in sequenza. */
export function GraficoColonne({ voci, colore, formato, tacca, etichetta, interi = false }: { voci: { id: string; nome: string; valore: number }[]; colore: string; formato: (v: number) => string; tacca?: (v: number) => string; etichetta: string; interi?: boolean }) {
  const [guscio, { larghezza, altezza }] = useMisura<HTMLDivElement>()
  const [scelta, setScelta] = useState<string | null>(null)
  const colonne = useRef<(HTMLElement | null)[]>([])
  const sinistra = larghezza < 500 ? 38 : 46
  const piano = Math.max(larghezza - sinistra, 1)
  const base = Math.max(altezza - SOTTO, ALTO + 1)
  const massimo = Math.max(0, ...voci.map((v) => v.valore))
  const passo = passoAsse(massimo, interi)
  const cima = passo * 4
  const asseY = (v: number) => base - (v / cima) * (base - ALTO)
  const fascia = voci.length ? piano / voci.length : piano
  const spessore = Math.min(32, Math.max(8, fascia * 0.5))

  useEffect(() => {
    colonne.current.forEach((c, i) => {
      if (c) anima(c, [{ transform: "scaleY(0)" }, { transform: "none" }], { duration: 900, delay: 200 + i * 45, easing: CURVE.entrata })
    })
  }, [voci])

  const etichette = indiciEtichette(voci.length + 1, piano).filter((i) => i < voci.length)
  return (
    <div ref={guscio} className="graf" style={{ paddingLeft: sinistra }} role="img" aria-label={etichetta}>
      <div className="graf__griglia" aria-hidden="true">
        {[4, 3, 2, 1, 0].map((n) => (
          <div key={n} className="graf__linea" style={{ top: asseY(n * passo) }}>
            <span>{(tacca ?? formato)(n * passo)}</span>
          </div>
        ))}
      </div>
      {voci.map((v, i) => (
        <button
          key={v.id}
          type="button"
          className="graf__colonna"
          aria-label={`${v.nome}: ${formato(v.valore)}`}
          style={{ left: sinistra + fascia * i, width: fascia, top: ALTO, height: base - ALTO }}
          onPointerEnter={() => setScelta(v.id)}
          onPointerLeave={() => setScelta(null)}
          onFocus={() => setScelta(v.id)}
          onBlur={() => setScelta(null)}
        >
          <i
            ref={(n) => { colonne.current[i] = n }}
            style={{ width: spessore, height: Math.max(v.valore ? 3 : 0, base - asseY(v.valore)), background: `linear-gradient(180deg, ${colore}, color-mix(in srgb, ${colore} 42%, transparent))`, opacity: scelta && scelta !== v.id ? 0.55 : 1 }}
          />
        </button>
      ))}
      <div className="graf__asse" aria-hidden="true" style={{ left: sinistra }}>
        {etichette.map((i) => (
          <span key={voci[i].id} style={{ left: fascia * i + fascia / 2, transform: "translateX(-50%)" }} className={scelta === voci[i].id || (!scelta && voci[i].valore === massimo && massimo > 0) ? "attivo" : undefined}>{voci[i].nome}</span>
        ))}
      </div>
      {scelta ? (() => {
        const i = voci.findIndex((v) => v.id === scelta)
        const voce = voci[i]
        const x = sinistra + fascia * i + fascia / 2
        return (
          <div className="graf__nota" aria-hidden="true" style={{ left: x, top: Math.max(0, asseY(voce.valore) - 74), transform: x + 190 < larghezza ? "translateX(12px)" : "translateX(calc(-100% - 12px))" }}>
            <small>{voce.nome}</small>
            <strong>{formato(voce.valore)}</strong>
          </div>
        )
      })() : null}
    </div>
  )
}

/** Piccolo andamento delle schede: la linea si disegna da sinistra, l'area compare insieme. */
export function Scintilla({ valori, colore, larghezza = 86, altezza = 28, base: baseVista = { l: 92, a: 30 } }: { valori: number[]; colore: string; larghezza?: number; altezza?: number; base?: { l: number; a: number } }) {
  const linea = useRef<SVGPathElement>(null)
  const area = useRef<SVGPathElement>(null)
  const { l, a } = baseVista
  const minimo = Math.min(...valori, 0)
  const massimo = Math.max(...valori, 0)
  const y = (v: number) => (massimo === minimo ? a - 3 : a - 3 - ((v - minimo) / (massimo - minimo)) * (a - 6))
  const punti = valori.map((v, i): Punto => [2 + (i / Math.max(valori.length - 1, 1)) * (l - 4), y(v)])
  const d = curva(punti, a - 2)

  useEffect(() => {
    const tratto = linea.current
    if (!tratto || movimentoRidotto()) return
    const lunghezza = tratto.getTotalLength()
    tratto.style.strokeDasharray = String(lunghezza)
    const moto = anima(tratto, [{ strokeDashoffset: lunghezza }, { strokeDashoffset: 0 }], { duration: 1200, delay: 300, easing: "cubic-bezier(0.65, 0, 0.35, 1)" })
    if (area.current) anima(area.current, [{ opacity: 0 }, { opacity: 0.14 }], { duration: 900, delay: 500, easing: "ease-out" })
    if (moto) moto.onfinish = () => { tratto.style.strokeDasharray = "" }
    return () => moto?.cancel()
  }, [])

  return (
    <svg className="scintilla" width={larghezza} height={altezza} viewBox={`0 0 ${l} ${a}`} preserveAspectRatio="none" aria-hidden="true">
      <path ref={area} d={`${d} L${l - 2},${a} L2,${a} Z`} fill={colore} opacity="0.14" />
      <path ref={linea} d={d} fill="none" stroke={colore} strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const CERCHIO = 2 * Math.PI * 28.5

/** Anello dell'obiettivo: `quota` è una frazione fra 0 e 1. */
export function Anello({ quota, testo }: { quota: number; testo: string }) {
  const valore = useRef<SVGCircleElement>(null)
  const scarto = CERCHIO * (1 - Math.min(Math.max(quota, 0), 1))
  useEffect(() => {
    if (valore.current) anima(valore.current, [{ strokeDashoffset: CERCHIO }, { strokeDashoffset: scarto }], { duration: 1000, delay: 200, easing: CURVE.fuori4 })
  }, [scarto])
  return (
    <span className="anello">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="28.5" className="anello__fondo" />
        <circle ref={valore} cx="32" cy="32" r="28.5" className="anello__valore" strokeDasharray={CERCHIO} strokeDashoffset={scarto} transform="rotate(-90 32 32)" />
      </svg>
      <b>{testo}</b>
    </span>
  )
}

/** Barra che si riempie da sinistra. `quota` è una frazione fra 0 e 1. */
export function Barra({ quota, colore, ritardo = 0, classe }: { quota: number; colore?: string; ritardo?: number; classe?: string }) {
  const riempimento = useRef<HTMLElement>(null)
  useEffect(() => {
    if (riempimento.current) anima(riempimento.current, [{ transform: "scaleX(0)" }, { transform: "none" }], { duration: 850, delay: ritardo, easing: CURVE.entrata })
  }, [ritardo])
  return (
    <span className={classe ? `barra ${classe}` : "barra"} aria-hidden="true">
      <i ref={riempimento} style={{ width: `${Math.min(Math.max(quota, 0), 1) * 100}%`, background: colore }} />
    </span>
  )
}
