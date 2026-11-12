import { useEffect, useMemo, useRef, useState } from "react"
import { compatto, GraficoAree, type SerieGrafico } from "../../../componenti/Grafici"
import { numero } from "../../../lingua"
import { anima, Cifra, CURVE } from "../../../movimenti"
import { euro } from "../../../ui"
import { COLORE_CANALE, Delta } from "../comuni"
import { Segmenti } from "../Segmenti"
import type { Periodo, UnitaPeriodo, VenditePeriodo } from "../tipi"

const PERIODI: { valore: Periodo; testo: string }[] = [
  { valore: "oggi", testo: "Today" },
  { valore: "7g", testo: "7 days" },
  { valore: "30g", testo: "30 days" },
  { valore: "12m", testo: "12 months" },
]

const NOME_PERIODO: Record<Periodo, string> = { oggi: "today so far", "7g": "last 7 days", "30g": "last 30 days", "12m": "last 12 months" }

const ORA_APERTURA = 7
const ORA_CHIUSURA = 18

/** Oggi si legge dall'orario di apertura in poi; gli ordini fuori orario allargano la finestra. */
function finestraOggi<T extends { assi: { futuro?: boolean }[] }>(dati: T, valori: number[][]) {
  const conVendite = dati.assi.map((_, i) => i).filter((i) => valori.some((v) => (v[i] ?? 0) > 0))
  const adesso = dati.assi.filter((a) => !a.futuro).length - 1
  const inizio = Math.min(ORA_APERTURA, conVendite[0] ?? ORA_APERTURA, adesso)
  const fine = Math.max(ORA_CHIUSURA, adesso)
  return { inizio, fine }
}

function Pillole({ serie, spente, onCambia }: { serie: { id: string; nome: string; colore: string; totale: number }[]; spente: Set<string>; onCambia: (id: string) => void }) {
  const gruppo = useRef<HTMLDivElement>(null)
  useEffect(() => {
    gruppo.current?.querySelectorAll("button").forEach((b, i) => {
      anima(b, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }], { duration: 400, delay: 500 + i * 50, easing: CURVE.modale })
    })
  }, [])
  return (
    <div ref={gruppo} className="pan-pillole">
      {serie.map((s) => {
        const spenta = spente.has(s.id)
        return (
          <button key={s.id} type="button" className={spenta ? "pan-pillola spenta" : "pan-pillola"} aria-pressed={!spenta} onClick={() => onCambia(s.id)}>
            <i style={{ background: spenta ? "transparent" : s.colore, borderColor: s.colore }} />
            {s.nome}
            <b>{compatto(s.totale)}</b>
          </button>
        )
      })}
    </div>
  )
}

/** Il blocco grande dell'amministratore: vendite per canale nel periodo scelto. */
export function BloccoVendite({ vendite, giorno }: { vendite: Record<Periodo, VenditePeriodo>; giorno: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("7g")
  const [spente, setSpente] = useState(new Set<string>())
  const dati = vendite[periodo]

  const vista = useMemo(() => {
    const valori = dati.canali.map((c) => c.valori)
    const { inizio, fine } = periodo === "oggi" ? finestraOggi(dati, valori) : { inizio: 0, fine: dati.assi.length - 1 }
    const serie: SerieGrafico[] = dati.canali.map((c) => ({
      id: c.id,
      nome: c.nome,
      colore: COLORE_CANALE[c.id],
      valori: (spente.has(c.id) ? c.valori.map(() => 0) : c.valori).slice(inizio, fine + 1),
    }))
    return { assi: dati.assi.slice(inizio, fine + 1), serie }
  }, [dati, periodo, spente])

  const accesi = dati.canali.filter((c) => !spente.has(c.id))
  const totale = accesi.reduce((s, c) => s + c.totale, 0)
  const precedente = accesi.reduce((s, c) => s + c.precedente, 0)
  const variazione = precedente ? (totale - precedente) / precedente : null
  const giornoSettimana = giorno.split(" ")[0]
  const confronto = {
    oggi: `vs last ${giornoSettimana} by now`,
    "7g": "vs the week before",
    "30g": "vs the 30 days before",
    "12m": `${euro(totale / 12).replace(/\.\d\d$/, "")} a month on average`,
  }[periodo]

  const cambia = (id: string) =>
    setSpente((attuali) => {
      const nuove = new Set(attuali)
      if (!nuove.delete(id)) nuove.add(id)
      return nuove.size === dati.canali.length ? attuali : nuove
    })

  return (
    <section className="pan-vendite vetro" data-blocco aria-label="Sales">
      <div className="pan-vendite__testa">
        <div>
          <span className="pan-occhiello">Sales · {NOME_PERIODO[periodo]}</span>
          <div className="pan-cifra">
            <Cifra valore={totale} formato={euro} className="pan-cifra__valore" />
            {periodo === "12m" ? null : <Delta valore={variazione} />}
          </div>
          <small>{confronto}</small>
        </div>
        <Segmenti voci={PERIODI} valore={periodo} onCambia={setPeriodo} etichetta="Sales period" />
      </div>
      <Pillole serie={dati.canali.map((c) => ({ id: c.id, nome: c.nome, colore: COLORE_CANALE[c.id], totale: c.totale }))} spente={spente} onCambia={cambia} />
      <GraficoAree assi={vista.assi} serie={vista.serie} etichetta={`Sales by channel, ${NOME_PERIODO[periodo]}`} />
    </section>
  )
}

/** Per l'azienda: le stesse misure in quantità, mai importi di vendita. */
export function BloccoUnita({ unita }: { unita: Record<Periodo, UnitaPeriodo> }) {
  const [periodo, setPeriodo] = useState<Periodo>("7g")
  const dati = unita[periodo]
  const vista = useMemo(() => {
    const { inizio, fine } = periodo === "oggi" ? finestraOggi(dati, [dati.valori]) : { inizio: 0, fine: dati.assi.length - 1 }
    return {
      assi: dati.assi.slice(inizio, fine + 1),
      serie: [{ id: "unita", nome: "Units", colore: "var(--serie-online)", valori: dati.valori.slice(inizio, fine + 1) }],
    }
  }, [dati, periodo])
  const confronto = { oggi: "vs last week by now", "7g": "vs the week before", "30g": "vs the 30 days before", "12m": "vs the year before" }[periodo]

  return (
    <section className="pan-vendite vetro" data-blocco aria-label="Units sold">
      <div className="pan-vendite__testa">
        <div>
          <span className="pan-occhiello">Units sold · {NOME_PERIODO[periodo]}</span>
          <div className="pan-cifra">
            <Cifra valore={dati.totale} formato={numero} className="pan-cifra__valore" />
            <Delta valore={dati.variazione} />
          </div>
          <small>{confronto}</small>
        </div>
        <Segmenti voci={PERIODI} valore={periodo} onCambia={setPeriodo} etichetta="Period" />
      </div>
      <GraficoAree assi={vista.assi} serie={vista.serie} formato={numero} tacca={numero} interi etichetta={`Units sold, ${NOME_PERIODO[periodo]}`} />
    </section>
  )
}
