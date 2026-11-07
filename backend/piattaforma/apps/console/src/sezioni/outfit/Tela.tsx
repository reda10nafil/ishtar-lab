import { ArrowDownToLine, ArrowUpToLine, Maximize2, Minimize2, Trash2 } from "lucide-react"
import { useRef, type KeyboardEvent, type PointerEvent } from "react"
import { FotoPezzo, RAPPORTO_TELA, stileTela } from "./comuni"
import type { PezzoTela } from "./tipi"

export const LARGHEZZA_MINIMA = 15
export const LARGHEZZA_MASSIMA = 90

type Modifica = { x?: number; y?: number; larghezza?: number }

type Proprieta = {
  pezzi: PezzoTela[]
  selezionato: string | null
  modificabile: boolean
  onSeleziona: (chiave: string | null) => void
  onModifica: (chiave: string, modifica: Modifica) => void
  onLivello: (chiave: string, verso: "avanti" | "indietro") => void
  onTogli: (chiave: string) => void
}

/** Tiene il capo dentro la tela: la posizione è in percentuale, quindi vale a ogni dimensione. */
export function dentroTela(x: number, y: number, larghezza: number) {
  return {
    x: Math.round(Math.min(Math.max(0, x), 100 - larghezza) * 10) / 10,
    y: Math.round(Math.min(Math.max(0, y), 100 - larghezza * RAPPORTO_TELA) * 10) / 10,
  }
}

const PASSI: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

export default function Tela({ pezzi, selezionato, modificabile, onSeleziona, onModifica, onLivello, onTogli }: Proprieta) {
  const tela = useRef<HTMLDivElement>(null)
  const presa = useRef<{ chiave: string; dx: number; dy: number } | null>(null)

  const puntoInPercentuale = (e: PointerEvent) => {
    const area = tela.current?.getBoundingClientRect()
    if (!area) return null
    return { x: ((e.clientX - area.left) / area.width) * 100, y: ((e.clientY - area.top) / area.height) * 100 }
  }

  const inizia = (e: PointerEvent<HTMLDivElement>, pezzo: PezzoTela) => {
    onSeleziona(pezzo.chiave)
    if (!modificabile) return
    const punto = puntoInPercentuale(e)
    if (!punto) return
    e.currentTarget.setPointerCapture(e.pointerId)
    presa.current = { chiave: pezzo.chiave, dx: punto.x - pezzo.x, dy: punto.y - pezzo.y }
  }

  const trascina = (e: PointerEvent<HTMLDivElement>, pezzo: PezzoTela) => {
    if (presa.current?.chiave !== pezzo.chiave) return
    const punto = puntoInPercentuale(e)
    if (punto) onModifica(pezzo.chiave, dentroTela(punto.x - presa.current.dx, punto.y - presa.current.dy, pezzo.larghezza))
  }

  const lascia = () => {
    presa.current = null
  }

  const ridimensiona = (pezzo: PezzoTela, differenza: number) => {
    const larghezza = Math.min(LARGHEZZA_MASSIMA, Math.max(LARGHEZZA_MINIMA, pezzo.larghezza + differenza))
    onModifica(pezzo.chiave, { larghezza, ...dentroTela(pezzo.x, pezzo.y, larghezza) })
  }

  const tasto = (e: KeyboardEvent<HTMLDivElement>, pezzo: PezzoTela) => {
    if (e.key === "Escape") return onSeleziona(null)
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      return onSeleziona(pezzo.chiave)
    }
    if (!modificabile) return
    const passo = PASSI[e.key]
    if (passo) {
      e.preventDefault()
      const misura = e.shiftKey ? 5 : 1
      onModifica(pezzo.chiave, dentroTela(pezzo.x + passo[0] * misura, pezzo.y + passo[1] * misura, pezzo.larghezza))
    }
    if (e.key === "+") ridimensiona(pezzo, 5)
    if (e.key === "-") ridimensiona(pezzo, -5)
  }

  const attivo = pezzi.find((p) => p.chiave === selezionato)

  return (
    <div className="studio-tela">
      <div
        ref={tela}
        className={`tela${modificabile ? " tela--modificabile" : ""}`}
        data-prova="tela"
        onPointerDown={(e) => e.target === e.currentTarget && onSeleziona(null)}
      >
        {pezzi.map((pezzo) => (
          <div
            key={pezzo.chiave}
            className={`tela__pezzo${pezzo.chiave === selezionato ? " tela__pezzo--scelto" : ""}`}
            style={stileTela(pezzo)}
            role="button"
            tabIndex={0}
            aria-pressed={pezzo.chiave === selezionato}
            aria-label={modificabile ? `${pezzo.titolo}. Drag it or use the arrow keys to move it` : pezzo.titolo}
            data-prova="pezzo"
            onPointerDown={(e) => inizia(e, pezzo)}
            onPointerMove={(e) => trascina(e, pezzo)}
            onPointerUp={lascia}
            onPointerCancel={lascia}
            onKeyDown={(e) => tasto(e, pezzo)}
          >
            <FotoPezzo pezzo={pezzo} />
          </div>
        ))}
      </div>

      {modificabile && attivo ? (
        <div className="tela__strumenti" role="toolbar" aria-label={`Tools for ${attivo.titolo}`}>
          <span className="tela__nome">{attivo.titolo}</span>
          <button type="button" className="icona-pulsante" aria-label="Make smaller" disabled={attivo.larghezza <= LARGHEZZA_MINIMA} onClick={() => ridimensiona(attivo, -5)}>
            <Minimize2 size={17} aria-hidden="true" />
          </button>
          <button type="button" className="icona-pulsante" aria-label="Make larger" disabled={attivo.larghezza >= LARGHEZZA_MASSIMA} onClick={() => ridimensiona(attivo, 5)}>
            <Maximize2 size={17} aria-hidden="true" />
          </button>
          <button type="button" className="icona-pulsante" aria-label="Bring to front" onClick={() => onLivello(attivo.chiave, "avanti")}>
            <ArrowUpToLine size={17} aria-hidden="true" />
          </button>
          <button type="button" className="icona-pulsante" aria-label="Send to back" onClick={() => onLivello(attivo.chiave, "indietro")}>
            <ArrowDownToLine size={17} aria-hidden="true" />
          </button>
          <button type="button" className="icona-pulsante pericolo" aria-label="Remove from outfit" onClick={() => onTogli(attivo.chiave)}>
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
