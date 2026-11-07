import { X } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Schede, type VoceScheda } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { euro } from "../../ui"

const SCORTE_BASSE = 10

/** Foto del prodotto; se manca o non si carica mostra le iniziali. */
export function FotoProdotto({ url, titolo, classe = "" }: { url: string | null; titolo: string; classe?: string }) {
  const [rotta, setRotta] = useState(false)
  if (url && !rotta) return <img className={`foto-prodotto ${classe}`} src={url} alt="" loading="lazy" onError={() => setRotta(true)} />
  return <span className={`foto-prodotto foto-prodotto--vuota ${classe}`} aria-hidden="true">{titolo.slice(0, 2).toUpperCase()}</span>
}

export function SchedeProdotti() {
  const { puo } = usePermessi()
  const voci: VoceScheda[] = [{ a: "/prodotti/catalogo", etichetta: "Catalogue" }]
  if (puo("magazzino", "view")) voci.push({ a: "/magazzino", etichetta: "Inventory" })
  if (puo("product_collections", "view")) voci.push({ a: "/prodotti/collezioni", etichetta: "Collections" })
  return (
    <div className="schede-prodotti">
      <Schede voci={voci} etichetta="Products sections" />
    </div>
  )
}

export function prezzoDa(minimo: number | null, massimo: number | null) {
  if (minimo === null || massimo === null) return "Price to be set"
  return minimo === massimo ? euro(minimo) : `${euro(minimo)} – ${euro(massimo)}`
}

/** Scorte con il pallino di colore: verde, ambra se poche, rosso se finite. */
export function ChipScorte({ scorte }: { scorte: number }) {
  const tono = scorte <= 0 ? "errore" : scorte <= SCORTE_BASSE ? "attesa" : "ok"
  return <span className={`chip-scorte chip-scorte--${tono}`}>{scorte > 0 ? `${numero(scorte)} in stock` : "Sold out"}</span>
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

/** Scheda laterale sopra l'elenco: l'elenco resta dietro con i suoi filtri. */
export function Cassetto({ titolo, sottotitolo, onChiudi, bloccato = false, piede, children }: ProprietaCassetto) {
  const finestra = useRef<HTMLElement>(null)

  useEffect(() => {
    const precedente = document.activeElement as HTMLElement | null
    finestra.current?.focus()
    return () => precedente?.focus()
  }, [])

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !bloccato) onChiudi()
    }
    document.addEventListener("keydown", tasto)
    return () => document.removeEventListener("keydown", tasto)
  }, [bloccato, onChiudi])

  return (
    <div className="velo velo--cassetto" onMouseDown={(e) => e.target === e.currentTarget && !bloccato && onChiudi()}>
      <aside className="cassetto vetro" role="dialog" aria-modal="true" aria-label={titolo} tabIndex={-1} ref={finestra}>
        <header className="cassetto__testa">
          <div>
            <h2>{titolo}</h2>
            {sottotitolo ? <p>{sottotitolo}</p> : null}
          </div>
          <button type="button" className="icona-pulsante" onClick={onChiudi} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="cassetto__corpo">{children}</div>
        {piede ? <footer className="cassetto__piede">{piede}</footer> : null}
      </aside>
    </div>
  )
}

export function Tessera({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="tessera">
      <span>{etichetta}</span>
      <strong>{valore}</strong>
    </div>
  )
}

export function Dato({ etichetta, valore }: { etichetta: string; valore: string | null | undefined }) {
  return (
    <div className="dato">
      <dt>{etichetta}</dt>
      <dd>{valore || "Not set"}</dd>
    </div>
  )
}
