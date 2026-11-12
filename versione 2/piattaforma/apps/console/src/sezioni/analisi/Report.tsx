import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { BarChart3, Boxes, Coins, Download, Eye, Percent, ReceiptText, ShoppingBag, TrendingUp, type LucideIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { compatto, GraficoColonne, GraficoLinea } from "../../componenti/Grafici"
import { scaricaCsv } from "../../esporta"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { euro, Stato } from "../../ui"
import { intero } from "./comuni"
import { Segmenti } from "./Segmenti"
import type { DatiTraffico, Metrica, PeriodoReport, Raggruppa, Report as DatiReport } from "./tipi"

const METRICHE: { valore: Metrica; testo: string; icona: LucideIcon; soldi: boolean }[] = [
  { valore: "vendite", testo: "Sales", icona: Coins, soldi: true },
  { valore: "ordini", testo: "Orders", icona: ReceiptText, soldi: false },
  { valore: "ordine_medio", testo: "Average order", icona: ShoppingBag, soldi: true },
  { valore: "unita", testo: "Units", icona: Boxes, soldi: false },
  { valore: "visite", testo: "Visits", icona: Eye, soldi: false },
  { valore: "margine", testo: "Margin", icona: Percent, soldi: true },
]

const FINESTRE: { valore: PeriodoReport; testo: string }[] = [
  { valore: "7g", testo: "7d" },
  { valore: "14g", testo: "14d" },
  { valore: "30g", testo: "30d" },
  { valore: "90g", testo: "90d" },
  { valore: "12m", testo: "12m" },
]

const NOME_FINESTRA: Record<PeriodoReport, string> = { "7g": "last 7 days", "14g": "last 14 days", "30g": "last 30 days", "90g": "last 90 days", "12m": "last 12 months" }

const CANALI = [
  { valore: "", testo: "All channels" },
  { valore: "online", testo: "Online shop" },
  { valore: "cassa", testo: "Shop till" },
  { valore: "ingrosso", testo: "Wholesale" },
]

const GRUPPI: { valore: Raggruppa; testo: string }[] = [
  { valore: "tempo", testo: "Over time" },
  { valore: "canale", testo: "Channel" },
  { valore: "azienda", testo: "Company" },
  { valore: "prodotto", testo: "Product" },
]

type Forma = "linea" | "colonne"

export default function Report() {
  const { puo } = usePermessi()
  const { avvisa } = useAvvisi()
  const [metrica, setMetrica] = useState<Metrica>("vendite")
  const [periodo, setPeriodo] = useState<PeriodoReport>("30g")
  const [canale, setCanale] = useState("")
  const [raggruppa, setRaggruppa] = useState<Raggruppa>("tempo")
  const [forma, setForma] = useState<Forma>("linea")

  const parametri = new URLSearchParams({ metrica, periodo, raggruppa: metrica === "visite" ? "tempo" : raggruppa })
  if (canale) parametri.set("canale", canale)
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["analisi", "report", parametri.toString()],
    queryFn: () => api<DatiReport>(`/admin/analisi/report?${parametri}`),
    placeholderData: keepPreviousData,
  })

  const visite = useQuery({ queryKey: ["analisi", "traffico"], queryFn: () => api<{ traffico: DatiTraffico | null }>("/admin/analisi/traffico") })
  const conVisite = Boolean(visite.data?.traffico)
  const scelta = METRICHE.find((m) => m.valore === metrica) ?? METRICHE[0]
  const formato = scelta.soldi ? euro : numero
  const tacca = scelta.soldi ? compatto : numero
  const soloVisite = metrica === "visite"
  const nel_tempo = raggruppa === "tempo" || soloVisite
  const colonne = !nel_tempo || forma === "colonne"
  const nomeCanale = CANALI.find((c) => c.valore === canale)?.testo ?? "All channels"
  const nomeGruppo = GRUPPI.find((g) => g.valore === raggruppa)?.testo ?? ""

  const assi = useMemo(() => (data?.righe ?? []).map((r) => ({ etichetta: r.etichetta, dettaglio: r.dettaglio })), [data])
  const valori = useMemo(() => (data?.righe ?? []).map((r) => r.valore), [data])
  const voci = useMemo(() => (data?.righe ?? []).map((r) => ({ id: r.chiave, nome: r.etichetta, valore: r.valore })), [data])

  const esporta = () => {
    if (!data) return
    scaricaCsv(`ishtar-lab-${scelta.testo.toLowerCase().replace(/\s+/g, "-")}-${periodo.replace("g", "d")}`, [nel_tempo ? "Period" : nomeGruppo, scelta.testo], data.righe.map((r) => [r.dettaglio, r.valore]))
    avvisa(`${NOME_FINESTRA[periodo].replace("last ", "")} of ${scelta.testo.toLowerCase()} exported`)
  }

  return (
    <div className="ana-report">
      <aside className="ana-comandi vetro" data-blocco aria-label="Report settings">
        <p className="ana-occhiello">Measure</p>
        <div className="ana-misure">
          {METRICHE.filter((m) => m.valore !== "margine" || puo("margini", "view")).map(({ valore, testo, icona: Icona }) => (
            <button key={valore} type="button" className={valore === metrica ? "attiva" : undefined} aria-pressed={valore === metrica} disabled={valore === "visite" && !conVisite} title={valore === "visite" && !conVisite ? "Visits aren't measured yet: see Traffic" : undefined} onClick={() => setMetrica(valore)}>
              <Icona size={20} aria-hidden="true" /> {testo}
            </button>
          ))}
        </div>
        <p className="ana-occhiello">Window</p>
        <Segmenti voci={FINESTRE} valore={periodo} onCambia={setPeriodo} etichetta="Report window" classe="segmenti--piena" />
        <p className="ana-occhiello"><label htmlFor="ana-canale">Channel</label></p>
        <select id="ana-canale" value={canale} disabled={soloVisite} onChange={(e) => setCanale(e.target.value)}>
          {CANALI.map((c) => <option key={c.valore} value={c.valore}>{c.testo}</option>)}
        </select>
        <p className="ana-occhiello"><label htmlFor="ana-gruppo">Group by</label></p>
        <select id="ana-gruppo" value={nel_tempo ? "tempo" : raggruppa} disabled={soloVisite} onChange={(e) => setRaggruppa(e.target.value as Raggruppa)}>
          {GRUPPI.map((g) => <option key={g.valore} value={g.valore}>{g.testo}</option>)}
        </select>
        <p className="ana-occhiello">Chart</p>
        <Segmenti
          voci={[{ valore: "linea" as Forma, testo: "Line", disattivo: !nel_tempo, icona: TrendingUp }, { valore: "colonne" as Forma, testo: "Bars", icona: BarChart3 }]}
          valore={colonne ? "colonne" : "linea"}
          onCambia={setForma}
          etichetta="Chart type"
          classe="segmenti--piena"
        />
        <button type="button" className="primario larga ana-esporta" disabled={!data} onClick={esporta}>
          <Download size={18} aria-hidden="true" /> Export CSV
        </button>
      </aside>
      <section className="ana-risultato vetro" data-blocco aria-label="Report" style={{ opacity: isFetching ? 0.72 : 1 }}>
        <div className="pan-testa">
          <div>
            <h2>{scelta.testo} · {NOME_FINESTRA[periodo]}</h2>
            <p>{soloVisite ? "The online shop" : nomeCanale}{data?.migliore ? ` · best ${nel_tempo ? "day" : "result"} ${data.migliore.etichetta}` : ""}</p>
          </div>
          {data ? <strong className="ana-risultato__totale">{(scelta.soldi ? intero : numero)(data.totale)}</strong> : null}
        </div>
        <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
        {data ? (
          data.ordini === 0 ? (
            <div className="ana-traffico-vuoto">
              <BarChart3 size={28} aria-hidden="true" />
              <strong>No orders in this window</strong>
              <p>Try a longer window or another channel. Cancelled orders and drafts don't count.</p>
            </div>
          ) : colonne ? (
            <GraficoColonne voci={voci} colore="var(--serie-online)" formato={formato} tacca={tacca} interi={!scelta.soldi} etichetta={`${scelta.testo} by ${nomeGruppo.toLowerCase()}`} />
          ) : (
            <GraficoLinea assi={assi} nome={scelta.testo} colore="var(--serie-online)" valori={valori} formato={formato} tacca={tacca} interi={!scelta.soldi} etichetta={`${scelta.testo} over time`} />
          )
        ) : null}
        {data ? (
          <div className="ana-riepiloghi">
            <div><small>{periodo === "12m" ? "Monthly average" : "Daily average"}</small><b>{data.media === null ? "–" : (scelta.soldi ? compatto : numero)(data.media)}</b></div>
            <div><small>Best {nel_tempo ? "day" : nomeGruppo.toLowerCase()}</small><b>{data.migliore ? `${data.migliore.etichetta} · ${(scelta.soldi ? compatto : numero)(data.migliore.valore)}` : "–"}</b></div>
            <div><small>{soloVisite ? "Total" : "Most sold"}</small><b>{soloVisite ? numero(data.totale) : data.piu_venduto ? `${data.piu_venduto.nome} · ${numero(data.piu_venduto.unita)}` : "–"}</b></div>
          </div>
        ) : null}
        {data?.senza_costo ? <p className="ana-nota">{numero(data.senza_costo)} order lines have no supply price and are left out of the margin.</p> : null}
      </section>
    </div>
  )
}
