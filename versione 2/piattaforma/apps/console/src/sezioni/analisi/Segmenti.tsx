import type { LucideIcon } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
import { scorri, type Bordi } from "../../movimenti"

type Voce<T extends string> = { valore: T; testo: string; disattivo?: boolean; icona?: LucideIcon }

/** Scelta fra poche opzioni con la pillola che scorre: una sola attiva, tastiera compresa. */
export function Segmenti<T extends string>({ voci, valore, onCambia, etichetta, classe }: { voci: Voce<T>[]; valore: T; onCambia: (valore: T) => void; etichetta: string; classe?: string }) {
  const guscio = useRef<HTMLDivElement>(null)
  const pillola = useRef<HTMLSpanElement>(null)
  const attuale = useRef<Bordi | null>(null)

  useLayoutEffect(() => {
    const contenitore = guscio.current
    const elemento = pillola.current
    if (!contenitore || !elemento) return
    const metti = (b: Bordi) => {
      attuale.current = b
      elemento.style.transform = `translateX(${b.inizio}px)`
      elemento.style.width = `${b.fine - b.inizio}px`
    }
    const misura = () => {
      const attivo = contenitore.querySelector<HTMLElement>("[aria-pressed='true']")
      return attivo ? { inizio: attivo.offsetLeft, fine: attivo.offsetLeft + attivo.offsetWidth } : null
    }
    const arrivo = misura()
    if (!arrivo) return
    const ferma = attuale.current ? scorri(attuale.current, arrivo, metti) : (metti(arrivo), () => undefined)
    const spia = new ResizeObserver(() => {
      const nuovo = misura()
      if (nuovo) metti(nuovo)
    })
    spia.observe(contenitore)
    return () => {
      ferma()
      spia.disconnect()
    }
  }, [valore])

  return (
    <div ref={guscio} className={classe ? `segmenti ${classe}` : "segmenti"} role="group" aria-label={etichetta}>
      <span ref={pillola} className="segmenti__pillola" aria-hidden="true" />
      {voci.map((v) => (
        <button key={v.valore} type="button" aria-pressed={v.valore === valore} disabled={v.disattivo} onClick={() => onCambia(v.valore)}>
          {v.icona ? <v.icona size={16} aria-hidden="true" /> : null}
          {v.testo}
        </button>
      ))}
    </div>
  )
}
