import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/** Stato vuoto onesto: dice cosa manca e, se serve, cosa fare. Mai dati inventati al suo posto. */
export function Vuoto({ icona: Icona, titolo, testo, azione }: { icona: LucideIcon; titolo: string; testo?: string; azione?: ReactNode }) {
  return (
    <div className="vuoto vetro">
      <Icona size={24} aria-hidden="true" />
      <strong>{titolo}</strong>
      {testo ? <p>{testo}</p> : null}
      {azione ? <div className="riga__azioni">{azione}</div> : null}
    </div>
  )
}
