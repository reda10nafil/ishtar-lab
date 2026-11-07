import { Copy } from "lucide-react"
import type { MouseEvent } from "react"
import { useAvvisi } from "../../componenti"

/** Niente pulsante se il codice è nascosto: chi ha solo la lettura ne vede le ultime cifre. */
export function CopiaCodice({ codice }: { codice: string }) {
  const { avvisa, segnalaErrore } = useAvvisi()
  if (codice.includes("•")) return null
  const copia = async (e: MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(codice)
      avvisa("Code copied")
    } catch {
      segnalaErrore(new Error("Couldn't copy: select the code by hand"))
    }
  }
  return (
    <button type="button" className="icona-pulsante sc-copia" aria-label={`Copy ${codice}`} title="Copy code" onClick={copia} onKeyDown={(e) => e.stopPropagation()}>
      <Copy size={14} aria-hidden="true" />
    </button>
  )
}

export function ChipCodice({ codice }: { codice: string }) {
  return (
    <span className="sc-chip">
      <span>{codice}</span>
      <CopiaCodice codice={codice} />
    </span>
  )
}
