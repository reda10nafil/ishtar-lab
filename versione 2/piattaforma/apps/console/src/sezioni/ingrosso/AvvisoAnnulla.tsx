import { Check } from "lucide-react"
import { useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { anima, CURVE } from "../../movimenti"

const DURATA = 5000

/** Avviso dello spostamento: come nel pannello, si può tornare indietro subito. */
export function AvvisoAnnulla({ chiave, testo, onAnnulla, onFine }: { chiave: number; testo: string; onAnnulla: () => void; onFine: () => void }) {
  const avviso = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (avviso.current) anima(avviso.current, [{ opacity: 0, transform: "translateY(30px) scale(0.94)" }, { opacity: 1, transform: "none" }], { duration: 480, easing: CURVE.avviso })
  }, [chiave])

  useEffect(() => {
    const timer = setTimeout(onFine, DURATA)
    return () => clearTimeout(timer)
  }, [chiave, onFine])

  return createPortal(
    <div className="ing-avviso" role="status" ref={avviso}>
      <Check size={16} aria-hidden="true" />
      <span>{testo}</span>
      <button type="button" onClick={onAnnulla}>Undo</button>
    </div>,
    document.body
  )
}
