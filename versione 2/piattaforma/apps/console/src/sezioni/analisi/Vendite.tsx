import { useQuery } from "@tanstack/react-query"
import { BarChart3, CalendarDays, Coins, Star, Shirt } from "lucide-react"
import { useMemo } from "react"
import { Barra, GraficoAree } from "../../componenti/Grafici"
import { numero, percentuale } from "../../lingua"
import { api } from "../../api/client"
import { Stato } from "../../ui"
import { COLORE_CANALE, Indicatore, intero, Miniatura } from "./comuni"
import type { AnalisiVendite } from "./tipi"

/** «November 2026» diventa «Nov 2026». */
const meseBreve = (mese: string) => `${mese.slice(0, 3)} ${mese.split(" ").at(-1)}`

const NOME_CANALE: Record<string, string> = { online: "Online shop", cassa: "Shop till", ingrosso: "Wholesale" }
const COLONNA_CANALE: Record<string, string> = { online: "Online", cassa: "Shop", ingrosso: "Wholesale" }

function GraficoMesi({ dati }: { dati: AnalisiVendite }) {
  const serie = useMemo(
    () => dati.canali.map((c, i) => ({ id: c.id, nome: COLONNA_CANALE[c.id], colore: COLORE_CANALE[c.id], valori: dati.mesi.map((m) => m.canali[i]) })),
    [dati]
  )
  const assi = useMemo(() => dati.mesi.map((m) => ({ etichetta: m.etichetta, dettaglio: m.dettaglio })), [dati])
  const presenti = dati.canali.filter((c) => c.totale > 0)
  return (
    <section className="ana-blocco vetro" data-blocco aria-label="Sales by month">
      <div className="pan-testa">
        <div>
          <h2>Sales by month</h2>
          <p>Online, the shop till and wholesale, one on top of the other</p>
        </div>
      </div>
      <GraficoAree assi={assi} serie={serie} etichetta="Sales by month and channel, last 12 months" />
      <div className="ana-quote">
        <div className="ana-quote__barra" aria-hidden="true">
          {presenti.map((c) => <span key={c.id} style={{ flexGrow: c.quota, background: COLORE_CANALE[c.id] }} />)}
        </div>
        <div className="ana-quote__legenda">
          {dati.canali.map((c) => (
            <span key={c.id}><i style={{ background: COLORE_CANALE[c.id] }} /> {NOME_CANALE[c.id]} · {intero(c.totale)} · {percentuale(c.quota)}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function MeseDopoMese({ dati }: { dati: AnalisiVendite }) {
  const mesi = [...dati.mesi].reverse()
  return (
    <section className="ana-blocco ana-blocco--tabella vetro" data-blocco aria-label="Month by month">
      <div className="pan-testa pan-testa--coda">
        <div>
          <h2>Month by month</h2>
          <p>Order totals with shipping and tax. Cancelled orders and drafts stay out.</p>
        </div>
      </div>
      <div className="ana-scorre">
        <table className="ana-tabella">
          <thead>
            <tr>
              <th scope="col">Month</th>
              {dati.canali.map((c) => <th key={c.id} scope="col">{COLONNA_CANALE[c.id]}</th>)}
              <th scope="col">Total</th>
              {dati.vede_margini ? <th scope="col">Margin</th> : null}
            </tr>
          </thead>
          <tbody>
            {mesi.map((m) => (
              <tr key={m.chiave}>
                <th scope="row">{meseBreve(m.dettaglio)}{m.in_corso ? <small> · to date</small> : null}</th>
                {m.canali.map((v, i) => <td key={dati.canali[i].id}>{intero(v)}</td>)}
                <td><b>{intero(m.totale)}</b></td>
                {dati.vede_margini ? <td>{intero(m.margine ?? 0)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function VociClassifica({ voci, vuoto }: { voci: { id: string; nome: string; miniatura?: string | null; valore: number; nota?: string }[]; vuoto: string }) {
  const massimo = Math.max(1, ...voci.map((v) => v.valore))
  if (!voci.length) return <p className="pan-vuota">{vuoto}</p>
  return (
    <ul className="ana-classifica">
      {voci.map((v, i) => (
        <li key={v.id} data-riga>
          <Miniatura nome={v.nome} url={v.miniatura} />
          <span>
            <b>{v.nome}</b>
            <Barra quota={v.valore / massimo} classe="ana-classifica__barra" ritardo={300 + i * 55} />
          </span>
          <em>{intero(v.valore)}{v.nota ? <small>{v.nota}</small> : null}</em>
        </li>
      ))}
    </ul>
  )
}

export default function Vendite() {
  const { data, isLoading, error } = useQuery({ queryKey: ["analisi", "vendite"], queryFn: () => api<AnalisiVendite>("/admin/analisi/vendite") })
  if (!data) return <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
  const { riepilogo: r } = data
  const nomeMese = r.corrente.etichetta.split(" ")[0]
  const scorso = r.corrente.rispetto_a.split(" ")[0]

  return (
    <div className="ana-pila">
      <div className="pan-tessere">
        <Indicatore etichetta="Last 12 months" icona={Coins} colore="var(--serie-online)" valore={r.totale} formato={intero} nota={`${meseBreve(data.anno.da)} – ${meseBreve(data.anno.a)}`} />
        <Indicatore etichetta={nomeMese} icona={CalendarDays} colore="var(--serie-negozio)" valore={r.corrente.totale} formato={intero} variazione={r.corrente.variazione} nota={`vs ${scorso}`} />
        <Indicatore etichetta="Best month" icona={Star} colore="var(--serie-ingrosso)" valore={r.migliore?.totale ?? 0} formato={(v) => (r.migliore ? `${r.migliore.etichetta} · ${intero(v)}` : intero(v))} nota={r.migliore?.dettaglio ?? "No sales yet"} />
        <Indicatore etichetta="Monthly average" icona={BarChart3} colore="var(--serie-altro)" valore={r.media ?? 0} formato={intero} nota={r.mesi_con_vendite ? `over ${numero(r.mesi_con_vendite)} ${r.mesi_con_vendite === 1 ? "month" : "months"} with sales` : "No sales yet"} />
      </div>
      <GraficoMesi dati={data} />
      <div className="ana-due">
        <MeseDopoMese dati={data} />
        <section className="ana-blocco vetro" data-blocco aria-label="Top earners">
          <div className="pan-testa">
            <div>
              <h2>Top earners</h2>
              <p>Revenue by product · last 30 days</p>
            </div>
          </div>
          <VociClassifica voci={data.prodotti.map((p) => ({ id: p.id, nome: p.nome, miniatura: p.miniatura, valore: p.importo }))} vuoto="Products that sell in the last 30 days appear here." />
        </section>
      </div>
      <div className="ana-pari">
        <section className="ana-blocco vetro" data-blocco aria-label="By company">
          <div className="pan-testa">
            <div>
              <h2>By company</h2>
              <p>Sales from each company · last 12 months</p>
            </div>
          </div>
          <VociClassifica
            voci={data.aziende.map((a) => ({
              id: a.id ?? "diretto",
              nome: a.nome ?? "Direct sales",
              valore: a.vendite,
              nota: a.margine ? `margin ${intero(a.margine.valore)}${a.margine.senza_costo ? ` · ${numero(a.margine.senza_costo)} lines without a supply price` : ""}` : `${numero(a.ordini)} ${a.ordini === 1 ? "order" : "orders"}`,
            }))}
            vuoto="Companies appear here once their products sell."
          />
        </section>
        <section className="ana-blocco vetro" data-blocco aria-label="By outfit">
          <div className="pan-testa">
            <div>
              <h2>By outfit</h2>
              <p>Sales that came through an outfit · last 12 months</p>
            </div>
          </div>
          {data.outfit.length ? (
            <VociClassifica voci={data.outfit.map((o) => ({ id: o.id, nome: o.nome ?? "Outfit removed", valore: o.importo, nota: `${numero(o.unita)} units` }))} vuoto="" />
          ) : (
            <div className="ana-vuoto-blocco">
              <Shirt size={24} aria-hidden="true" />
              <p>Orders don't record an outfit yet. The online shop will write it on each line once it's live, and sales will show up here.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
