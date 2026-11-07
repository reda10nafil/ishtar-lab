import { Shirt } from "lucide-react"
import { useEffect, useState } from "react"
import type { Tono } from "../../lingua"
import { numero } from "../../lingua"
import { Etichetta } from "../../ui"
import type { PezzoTela, StatoOutfit } from "./tipi"

/** Rapporto della tela: 4:5. Un capo è un quadrato, quindi la sua altezza è 4/5 della larghezza in percentuale. */
export const RAPPORTO_TELA = 0.8

const STATI: Record<StatoOutfit, { testo: string; tono: Tono }> = {
  bozza: { testo: "Draft", tono: "neutro" },
  pubblicato: { testo: "Published", tono: "ok" },
  archiviato: { testo: "Archived", tono: "attesa" },
}

export function EtichettaStato({ stato }: { stato: StatoOutfit }) {
  return <Etichetta tono={STATI[stato].tono}>{STATI[stato].testo}</Etichetta>
}

/** Selettore a segmenti: una scelta fra poche voci, come stato e disponibilità. */
export function Segmenti<T extends string>({ voci, valore, etichetta, onCambia }: { voci: { id: T; testo: string; conteggio?: number }[]; valore: T; etichetta: string; onCambia: (valore: T) => void }) {
  return (
    <div className="selettore outfit-segmenti" role="group" aria-label={etichetta}>
      {voci.map((voce) => (
        <button key={voce.id} type="button" className={valore === voce.id ? "attivo" : undefined} aria-pressed={valore === voce.id} onClick={() => onCambia(voce.id)}>
          {voce.testo}
          {voce.conteggio ? <em>{numero(voce.conteggio)}</em> : null}
        </button>
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

export function FotoPezzo({ pezzo }: { pezzo: Pick<PezzoTela, "titolo" | "foto"> }) {
  return pezzo.foto ? (
    <img src={pezzo.foto} alt="" draggable={false} loading="lazy" />
  ) : (
    <span className="pezzo-senza-foto" aria-hidden="true">{pezzo.titolo.slice(0, 2).toUpperCase()}</span>
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
