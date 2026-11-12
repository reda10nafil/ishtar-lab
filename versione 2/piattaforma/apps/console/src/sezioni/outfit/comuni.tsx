import { Shirt } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { Tono } from "../../lingua"
import { Etichetta } from "../../ui"
import type { PezzoTela, StatoOutfit } from "./tipi"

/** Rapporto della tela: quello della tessera del pannello, 192:167. Un capo è un quadrato, quindi in altezza occupa di più. */
export const RAPPORTO_TELA = 192 / 167

const STATI: Record<StatoOutfit, { testo: string; tono: Tono }> = {
  bozza: { testo: "Draft", tono: "neutro" },
  pubblicato: { testo: "Published", tono: "ok" },
  archiviato: { testo: "Archived", tono: "attesa" },
}

export function EtichettaStato({ stato }: { stato: StatoOutfit }) {
  return <Etichetta tono={STATI[stato].tono}>{STATI[stato].testo}</Etichetta>
}

type VoceSegmento<T> = { id: T; testo: string; icona?: LucideIcon }

/** Selettore a segmenti: una scelta fra poche voci. La pillola a goccia viene dal guscio. */
export function Segmenti<T extends string>({ voci, valore, etichetta, disattivo, onCambia }: { voci: VoceSegmento<T>[]; valore: T; etichetta: string; disattivo?: boolean; onCambia: (valore: T) => void }) {
  return (
    <div className="selettore selettore--stretto" role="group" aria-label={etichetta}>
      {voci.map(({ id, testo, icona: Icona }) => (
        <button key={id} type="button" className={valore === id ? "attivo" : undefined} aria-pressed={valore === id} aria-label={Icona ? testo : undefined} disabled={disattivo} onClick={() => onCambia(id)}>
          {Icona ? <Icona size={16} aria-hidden="true" /> : testo}
        </button>
      ))}
    </div>
  )
}

/** Mentre arrivano i dati si vede già la griglia. `data-fermo`: l'entrata in sequenza spetta alle carte vere. */
export function GrigliaAttesa() {
  return (
    <div className="griglia-outfit" role="status" aria-label="Loading outfits" data-fermo>
      {Array.from({ length: 5 }, (_, indice) => (
        <div key={indice} className="outfit-scheda outfit-scheda--attesa vetro" aria-hidden="true">
          <div className="foto-composta" />
          <div className="outfit-scheda__testo"><span /><span /></div>
        </div>
      ))}
    </div>
  )
}

/** Pillola con il pallino di colore, in fondo alla scheda. */
export function ChipDisponibilita({ acquistabile }: { acquistabile: boolean }) {
  return <span className={`outfit-chip outfit-chip--${acquistabile ? "ok" : "attesa"}`}>{acquistabile ? "Buyable" : "Not buyable"}</span>
}

export const chiaveCapo = (capo: { product_id: string; azienda_id: string }) => `${capo.product_id}|${capo.azienda_id}`

/** Ritarda un valore: la ricerca parte quando si smette di scrivere. */
export function useRitardato<T>(valore: T, attesa = 250): T {
  const [ritardato, setRitardato] = useState(valore)
  useEffect(() => {
    const timer = window.setTimeout(() => setRitardato(valore), attesa)
    return () => window.clearTimeout(timer)
  }, [valore, attesa])
  return ritardato
}

export const stileTela = (pezzo: Pick<PezzoTela, "x" | "y" | "larghezza" | "livello">) => ({
  left: `${pezzo.x}%`,
  top: `${pezzo.y}%`,
  width: `${pezzo.larghezza}%`,
  zIndex: pezzo.livello,
})

/** Le foto del catalogo possono essere pesanti: compaiono intere, mai dipinte a metà. Se mancano restano le iniziali. */
export function FotoPezzo({ pezzo }: { pezzo: Pick<PezzoTela, "titolo" | "foto"> }) {
  const [stato, setStato] = useState<"attesa" | "pronta" | "rotta">("attesa")
  const foto = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (foto.current?.complete && foto.current.naturalWidth) setStato("pronta")
  }, [pezzo.foto])

  const iniziali = <span className="pezzo-senza-foto" aria-hidden="true">{pezzo.titolo.slice(0, 2).toUpperCase()}</span>
  if (!pezzo.foto || stato === "rotta") return iniziali
  return (
    <>
      {stato === "attesa" ? iniziali : null}
      <img ref={foto} src={pezzo.foto} alt="" draggable={false} loading="lazy" className={stato === "pronta" ? "foto-pronta" : undefined} onLoad={() => setStato("pronta")} onError={() => setStato("rotta")} />
    </>
  )
}

/** La foto dell'outfit: i capi veri nella posizione scelta sulla tela. */
export function FotoComposta({ pezzi, nome }: { pezzi: PezzoTela[]; nome: string }) {
  if (!pezzi.length) {
    return (
      <div className="foto-composta foto-composta--vuota" role="img" aria-label={`${nome}: no pieces`}>
        <Shirt size={30} aria-hidden="true" />
      </div>
    )
  }
  return (
    <div className="foto-composta" role="img" aria-label={`${nome}: ${pezzi.map((p) => p.titolo).join(", ")}`}>
      {pezzi.map((pezzo) => (
        <div key={pezzo.chiave} className="foto-composta__pezzo" style={stileTela(pezzo)}>
          <FotoPezzo pezzo={pezzo} />
        </div>
      ))}
    </div>
  )
}
