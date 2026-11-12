import { Check } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

export type Annullabile = { testo: string; annulla?: () => void }

const DURATA = 6000

/** Avviso con Undo: quello comune non ha un'azione. Sparisce da solo dopo qualche secondo. */
export function useAvvisoAnnulla() {
  const [avviso, setAvviso] = useState<Annullabile | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const mostra = useCallback((nuovo: Annullabile) => {
    window.clearTimeout(timer.current)
    setAvviso(nuovo)
    timer.current = window.setTimeout(() => setAvviso(null), DURATA)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const annulla = () => {
    avviso?.annulla?.()
    setAvviso(null)
  }
  return { avviso, mostra, annulla }
}

export function AvvisoAnnulla({ avviso, onAnnulla }: { avviso: Annullabile | null; onAnnulla: () => void }) {
  if (!avviso) return null
  return (
    <div className="mag-avviso" role="status">
      <Check size={17} aria-hidden="true" />
      <span>{avviso.testo}</span>
      {avviso.annulla ? <button type="button" onClick={onAnnulla}>Undo</button> : null}
    </div>
  )
}
