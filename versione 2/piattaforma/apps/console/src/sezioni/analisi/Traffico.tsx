import { useQuery } from "@tanstack/react-query"
import { Activity, Clock, Eye, Plug, ShoppingBasket } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import type { Connettore } from "../../api/tipi"
import { GraficoLinea } from "../../componenti/Grafici"
import { numero, percentuale } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Stato } from "../../ui"
import { Indicatore } from "./comuni"
import { Segmenti } from "./Segmenti"
import type { DatiTraffico } from "./tipi"

const GIORNI = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const ORE = ["8a", "10a", "12p", "2p", "4p", "6p", "8p", "10p"]
const FONTI_VUOTE = ["Search", "Social", "Newsletter", "Direct"]
const COLORI_FONTI = ["var(--serie-online)", "var(--serie-negozio)", "var(--serie-ingrosso)", "var(--serie-altro)", "var(--testo-3)"]

function GrigliaOre({ ore }: { ore: number[][] | null }) {
  const massimo = Math.max(1, ...(ore ?? []).flat())
  const picco = ore?.flat().indexOf(massimo) ?? -1
  return (
    <div className="ana-griglia-ore" role={ore ? "img" : undefined} aria-label={ore ? "Visits by day and hour" : undefined} aria-hidden={ore ? undefined : true}>
      <span />
      {ORE.map((o) => <small key={o}>{o}</small>)}
      {GIORNI.map((g, r) => [
        <small key={g}>{g}</small>,
        ...ORE.map((o, c) => {
          const valore = ore?.[r]?.[c]
          const forza = valore === undefined ? 0 : 30 + (valore / massimo) * 70
          return (
            <i
              key={`${g}-${o}`}
              className={r * ORE.length + c === picco ? "picco" : undefined}
              title={valore === undefined ? undefined : `${g} ${o}: ${numero(valore)} visits`}
              style={valore === undefined ? undefined : { background: `color-mix(in srgb, var(--serie-online) ${forza}%, transparent)` }}
            />
          )
        }),
      ])}
    </div>
  )
}

function Pieno({ dati }: { dati: DatiTraffico }) {
  const [finestra, setFinestra] = useState<"14" | "30">("30")
  const f = dati.finestre[finestra]
  const assi = useMemo(() => f.giorni.map((g) => ({ etichetta: g.etichetta, dettaglio: g.dettaglio })), [f])
  const valori = useMemo(() => f.giorni.map((g) => g.visite), [f])
  const confronto = useMemo(() => f.giorni.map((g) => g.precedenti), [f])
  return (
    <div className="ana-pila">
      <div className="pan-tessere">
        <Indicatore etichetta="Visits" icona={Eye} colore="var(--serie-online)" valore={f.visite} formato={numero} variazione={f.variazione} nota={`last ${finestra} days`} />
        <Indicatore etichetta="Conversion" icona={Activity} colore="var(--serie-negozio)" valore={dati.conversione} formato={percentuale} nota="visits that bought" />
        <Indicatore etichetta="Basket rate" icona={ShoppingBasket} colore="var(--serie-ingrosso)" valore={dati.carrello?.valore ?? null} formato={percentuale} variazione={dati.carrello?.variazione ?? null} nota="added something" />
        <Indicatore etichetta="Busiest hour" icona={Clock} colore="var(--serie-altro)" valore={null} formato={numero} vuoto={dati.ora ? `${dati.ora.giorno}, ${dati.ora.ora}` : "–"} nota="the fullest slot of the week" />
      </div>
      <section className="ana-blocco ana-blocco--visite vetro" data-blocco aria-label="Visits">
        <div className="pan-testa">
          <div>
            <h2>Visits</h2>
            <p>Dashed line: the same days a month earlier</p>
          </div>
          <Segmenti voci={[{ valore: "14" as const, testo: "14 days" }, { valore: "30" as const, testo: "30 days" }]} valore={finestra} onCambia={setFinestra} etichetta="Visits window" />
        </div>
        <GraficoLinea assi={assi} nome="Visits" colore="var(--serie-online)" valori={valori} confronto={confronto} formato={numero} interi etichetta={`Visits, last ${finestra} days`} />
      </section>
      <div className="ana-due">
        <section className="ana-blocco vetro" data-blocco aria-label="When people visit">
          <div className="pan-testa">
            <div>
              <h2>When people visit</h2>
              <p>Average visits by day and hour</p>
            </div>
          </div>
          <GrigliaOre ore={dati.ore} />
        </section>
        <section className="ana-blocco vetro" data-blocco aria-label="Where they come from">
          <div className="pan-testa">
            <div>
              <h2>Where they come from</h2>
              <p>Share of visits · last 30 days</p>
            </div>
          </div>
          <div className="ana-fonti">
            <span className="ana-fonti__barra ana-fonti__barra--piena" aria-hidden="true">
              {dati.fonti.map((s, i) => <i key={s.nome} style={{ flexGrow: s.quota, background: COLORI_FONTI[i] ?? "var(--testo-3)" }} />)}
            </span>
            {dati.fonti.map((s, i) => (
              <div key={s.nome}><i style={{ background: COLORI_FONTI[i] ?? "var(--testo-3)" }} /> {s.nome} <b>{numero(s.visite)}</b> <small>{percentuale(s.quota)}</small></div>
            ))}
          </div>
          <p className="ana-occhiello">Top pages</p>
          <ul className="ana-pagine">
            {dati.pagine.map((p) => (
              <li key={p.percorso} data-riga>
                <span><b>{p.titolo}</b><small>{p.percorso}</small></span>
                <em>{numero(p.visite)}</em>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

/** Senza dati il blocco tiene il suo posto e dice cosa serve per riempirlo. */
function Vuoto() {
  const naviga = useNavigate()
  const { puo } = usePermessi()
  const vedeApps = puo("connettori", "view")
  const connettori = useQuery({ queryKey: ["connettori"], queryFn: () => api<{ connettori: Connettore[] }>("/admin/connectors"), enabled: vedeApps })
  const collegato = connettori.data?.connettori.find((c) => c.id === "plausible")?.stato === "collegato"
  return (
    <div className="ana-pila">
      <div className="pan-tessere">
        <Indicatore etichetta="Visits" icona={Eye} colore="var(--serie-online)" valore={null} formato={numero} nota="not measured yet" />
        <Indicatore etichetta="Conversion" icona={Activity} colore="var(--serie-negozio)" valore={null} formato={percentuale} nota="needs visits" />
        <Indicatore etichetta="Basket rate" icona={ShoppingBasket} colore="var(--serie-ingrosso)" valore={null} formato={percentuale} nota="needs the online shop" />
        <Indicatore etichetta="Busiest hour" icona={Clock} colore="var(--serie-altro)" valore={null} formato={numero} nota="needs visits" />
      </div>
      <section className="ana-blocco vetro" data-blocco aria-label="Visits">
        <div className="pan-testa">
          <div>
            <h2>Visits</h2>
            <p>Nothing is tracked yet, so there are no visits to show</p>
          </div>
        </div>
        <div className="ana-traffico-vuoto">
          <Plug size={28} aria-hidden="true" />
          <strong>{collegato ? "Plausible is connected" : "Connect Plausible to see your visits"}</strong>
          <p>
            {collegato
              ? "Visits will appear here once the online shop is live and sending them to Plausible."
              : "This page needs two things: the online shop live, and Plausible connected in Apps. Plausible counts visits without cookies. Until then nothing is estimated."}
          </p>
          {vedeApps ? <button type="button" className="primario" onClick={() => naviga("/connettori")}><Plug size={18} aria-hidden="true" /> {collegato ? "Open Apps" : "Connect in Apps"}</button> : null}
        </div>
      </section>
      <div className="ana-due">
        <section className="ana-blocco vetro" data-blocco aria-label="When people visit">
          <div className="pan-testa">
            <div>
              <h2>When people visit</h2>
              <p>Visits by day and hour will fill this grid</p>
            </div>
          </div>
          <GrigliaOre ore={null} />
        </section>
        <section className="ana-blocco vetro" data-blocco aria-label="Where they come from">
          <div className="pan-testa">
            <div>
              <h2>Where they come from</h2>
              <p>Sources will appear with the first visits</p>
            </div>
          </div>
          <div className="ana-fonti" aria-hidden="true">
            <span className="ana-fonti__barra" />
            {FONTI_VUOTE.map((f) => <div key={f}><i /> {f} <b>–</b></div>)}
          </div>
          <p className="ana-occhiello">Top pages</p>
          <p className="pan-riga-vuota">Pages appear here with the first visits.</p>
        </section>
      </div>
    </div>
  )
}

export default function Traffico() {
  const { data, isLoading, error } = useQuery({ queryKey: ["analisi", "traffico"], queryFn: () => api<{ traffico: DatiTraffico | null }>("/admin/analisi/traffico") })
  if (!data) return <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
  return data.traffico ? <Pieno dati={data.traffico} /> : <Vuoto />
}
