import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Modale } from "../ui"
import type { Voce } from "./voci"

const VAI: Record<string, string> = { o: "/", r: "/ordini", p: "/prodotti", c: "/clienti", a: "/analisi", m: "/marketing", t: "/cassa" }

const ELENCO: [string, string][] = [
  ["Search everything", "Ctrl K"],
  ["Search", "/"],
  ["New...", "N"],
  ["Overview", "G then O"],
  ["Orders", "G then R"],
  ["Products", "G then P"],
  ["Customers", "G then C"],
  ["Analytics", "G then A"],
  ["Marketing", "G then M"],
  ["Shop till", "G then T"],
  ["Collapse the sidebar", "["],
  ["Close", "Esc"],
  ["This list", "?"],
]

const ATTESA_SECONDO_TASTO = 900

const staScrivendo = (e: KeyboardEvent) => {
  const bersaglio = e.target as HTMLElement | null
  return Boolean(bersaglio?.closest("input, textarea, select, [contenteditable='true']"))
}

type Azioni = { voci: Voce[]; onCerca: () => void; onRiduci: () => void }

/** Scorciatoie da tastiera del guscio; dentro un campo di testo non scattano. */
export function useScorciatoie({ voci, onCerca, onRiduci }: Azioni) {
  const naviga = useNavigate()
  const [elenco, setElenco] = useState(false)
  const azioni = useRef({ voci, onCerca, onRiduci })
  azioni.current = { voci, onCerca, onRiduci }

  useEffect(() => {
    let attesa = 0
    let primoG = false
    const tasto = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        azioni.current.onCerca()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || staScrivendo(e) || document.querySelector(".velo:not([inert])")) return
      const chiave = e.key.toLowerCase()
      if (primoG) {
        primoG = false
        const meta = VAI[chiave]
        if (meta && azioni.current.voci.some((v) => v.a === meta)) naviga(meta)
        return
      }
      if (chiave === "g") {
        primoG = true
        clearTimeout(attesa)
        attesa = window.setTimeout(() => (primoG = false), ATTESA_SECONDO_TASTO)
      } else if (chiave === "/") {
        e.preventDefault()
        azioni.current.onCerca()
      } else if (chiave === "n") {
        document.querySelector<HTMLButtonElement>(".testata__nuovo")?.click()
      } else if (chiave === "[") {
        azioni.current.onRiduci()
      } else if (e.key === "?") {
        setElenco(true)
      }
    }
    document.addEventListener("keydown", tasto)
    return () => {
      clearTimeout(attesa)
      document.removeEventListener("keydown", tasto)
    }
  }, [naviga])

  return { elenco, apriElenco: () => setElenco(true), chiudiElenco: () => setElenco(false) }
}

export function ElencoScorciatoie({ onChiudi }: { onChiudi: () => void }) {
  return (
    <Modale titolo="Keyboard shortcuts" onChiudi={onChiudi}>
      <dl className="scorciatoie">
        {ELENCO.map(([azione, tasti]) => (
          <div key={azione}>
            <dt>{azione}</dt>
            <dd>{tasti.split(" ").map((t) => (t === "then" ? <span key={t}>then</span> : <kbd key={t} className="tasto">{t}</kbd>))}</dd>
          </div>
        ))}
      </dl>
    </Modale>
  )
}
