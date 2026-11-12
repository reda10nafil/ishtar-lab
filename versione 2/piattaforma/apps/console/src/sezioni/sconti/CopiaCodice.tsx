import { Copy } from "lucide-react"
import type { MouseEvent } from "react"
import { useAvvisi } from "../../componenti"

function useCopia(codice: string) {
  const { avvisa, segnalaErrore } = useAvvisi()
  return async (e: MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(codice)
      avvisa(`${codice} copied`)
    } catch {
      segnalaErrore(new Error("Couldn't copy: select the code by hand"))
    }
  }
}

/** Niente pulsante se il codice è nascosto: chi ha solo la lettura ne vede le ultime cifre. */
export function CopiaCodice({ codice }: { codice: string }) {
  const copia = useCopia(codice)
  if (codice.includes("•")) return null
  return (
    <button type="button" className="icona-pulsante sc-copia" aria-label={`Copy ${codice}`} title="Copy code" onClick={copia} onKeyDown={(e) => e.stopPropagation()}>
      <Copy size={14} aria-hidden="true" />
    </button>
  )
}

/** Il codice è esso stesso il pulsante che lo copia. */
export function ChipCodice({ codice }: { codice: string }) {
  const copia = useCopia(codice)
  return (
    <button type="button" className="sc-chip" aria-label={`Copy ${codice}`} title="Copy code" onClick={copia} onKeyDown={(e) => e.stopPropagation()}>
      <span>{codice}</span>
      <Copy size={14} aria-hidden="true" />
    </button>
  )
}
