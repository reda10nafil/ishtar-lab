import { useQuery } from "@tanstack/react-query"
import { Check, CreditCard, Percent, RotateCcw, Settings2, Trash2 } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { percentuale, numero } from "../../lingua"
import { Cifra } from "../../movimenti"
import { usePermessi } from "../../permessi"
import { euro } from "../../ui"
import { giorno, intero, useAggiorna } from "./dati"
import type { MotivoReso } from "./ModuloReso"
import { Domanda, Finestra, Mini, Segmenti, Tessera } from "./Pezzi"
import type { ElencoResi, FaseReso, Reso } from "./tipi"

const PASSI: { fase: FaseReso; testo: string }[] = [
  { fase: "richiesto", testo: "Requested" },
  { fase: "approvato", testo: "Approved" },
  { fase: "ricevuto", testo: "Received" },
  { fase: "rimborsato", testo: "Refunded" },
]

function Passi({ fase }: { fase: FaseReso }) {
  const adesso = PASSI.findIndex((p) => p.fase === fase)
  const ultimo = fase === "rimborsato"
  return (
    <ol className="ord-passi">
      {PASSI.map((p, i) => {
        const stato = i < adesso || (ultimo && i === adesso) ? "fatto" : i === adesso ? "ora" : "dopo"
        return (
          <li key={p.fase} className={`ord-passo--${stato}`}>
            <span className="ord-passo__punto">{stato === "fatto" ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}</span>
            {i < PASSI.length - 1 ? <span className="ord-passo__linea" /> : null}
            <small>{p.testo}</small>
          </li>
        )
      })}
    </ol>
  )
}

const SCRITTE: Record<FaseReso, (r: Reso) => string> = {
  richiesto: () => "Waiting for your approval",
  approvato: (r) => `Approved: the parcel is on its way to ${r.azienda ?? "the company"}`,
  ricevuto: (r) => `${r.azienda ?? "The company"} has it back and checked it`,
  rimborsato: (r) => (r.rimborso ? `${euro(r.rimborso.importo)} refunded on ${giorno(r.rimborso.quando)}` : "Refunded"),
  annullato: () => "Return cancelled",
}

function MotiviReso({ onChiudi }: { onChiudi: () => void }) {
  const { avvisa, segnalaErrore } = useAvvisi()
  const query = useQuery({ queryKey: ["ordini", "motivi"], queryFn: () => api<{ return_reasons: MotivoReso[] }>("/admin/return-reasons?limit=100") })
  const aggiorna = useAggiorna()
  const [testo, setTesto] = useState("")
  const [attesa, setAttesa] = useState(false)
  const aggiungi = async () => {
    setAttesa(true)
    try {
      const value = testo.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `reason_${Date.now()}`
      await api("/admin/return-reasons", { corpo: { value, label: testo.trim() } })
      setTesto("")
      avvisa("Reason added")
      await aggiorna()
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setAttesa(false)
    }
  }
  const togli = async (id: string) => {
    try {
      await api(`/admin/return-reasons/${id}`, { metodo: "DELETE" })
      await aggiorna()
    } catch (errore) {
      segnalaErrore(errore)
    }
  }
  return (
    <Finestra titolo="Return reasons" sottotitolo="These appear when you start a return." stretta onChiudi={onChiudi}>
      <>
        <div className="ord-modulo">
          <ul className="ord-motivi">
            {query.data?.return_reasons.map((m) => (
              <li key={m.id}>
                <span>{m.label}</span>
                <button type="button" className="ord-icona" aria-label={`Delete ${m.label}`} onClick={() => void togli(m.id)}><Trash2 size={16} aria-hidden="true" /></button>
              </li>
            ))}
            {query.data && !query.data.return_reasons.length ? <li className="ord-tenue">No reasons yet.</li> : null}
          </ul>
          <form
            className="ord-nota"
            onSubmit={(e) => {
              e.preventDefault()
              void aggiungi()
            }}
          >
            <input value={testo} maxLength={120} placeholder="New reason" aria-label="New reason" onChange={(e) => setTesto(e.target.value)} />
            <button type="submit" className="ord-btn ord-btn--s" disabled={attesa || !testo.trim()}>Add</button>
          </form>
        </div>
      </>
    </Finestra>
  )
}

function SchedaReso({ reso, onRimborsa }: { reso: Reso; onRimborsa: () => void }) {
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiorna()
  const [attesa, setAttesa] = useState(false)
  const [prima] = reso.voci
  const fai = async (azione: "approva" | "ricevi" | "annulla", fatto: string) => {
    setAttesa(true)
    try {
      await api(`/admin/ordini/resi/${reso.id}/${azione}`, { corpo: {} })
      avvisa(fatto)
      await aggiorna()
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setAttesa(false)
    }
  }
  const scrive = puo("orders.returns", "edit")
  const titolo = prima ? `${prima.titolo}${reso.voci.length > 1 ? ` +${reso.voci.length - 1}` : ""}` : "Item"
  return (
    <article className="ord-reso vetro">
      <div className="ord-reso__testa">
        <Mini url={prima?.miniatura ?? null} titolo={titolo} misura="l" />
        <div className="ord-reso__testo">
          <b>R-{reso.numero} · {titolo}</b>
          <small>{reso.cliente} · order <Link className="ord-link" to={`/ordini/tutti/${reso.ordine_id}`}>#{reso.ordine_numero}</Link> · {giorno(reso.creato_il)}</small>
          {prima?.motivo ? <p>“{prima.motivo}”</p> : null}
        </div>
        <b className="ord-reso__importo">{euro(reso.importo)}</b>
      </div>
      {reso.fase === "annullato" ? null : <Passi fase={reso.fase} />}
      <div className="ord-reso__piede">
        <small>{SCRITTE[reso.fase](reso)}</small>
        <span className="ord-spazio" />
        {scrive && (reso.fase === "richiesto" || reso.fase === "approvato") ? <button type="button" className="ord-btn ord-btn--s ord-btn--fantasma ord-btn--rosso" disabled={attesa} onClick={() => void fai("annulla", `R-${reso.numero} cancelled`)}>Cancel</button> : null}
        {scrive && reso.fase === "richiesto" ? <button type="button" className="ord-btn ord-btn--s ord-btn--primario" disabled={attesa} onClick={() => void fai("approva", `R-${reso.numero} approved`)}><Check size={15} aria-hidden="true" /> Approve</button> : null}
        {scrive && reso.fase === "approvato" ? <button type="button" className="ord-btn ord-btn--s ord-btn--primario" disabled={attesa} onClick={() => void fai("ricevi", `R-${reso.numero} received back${reso.azienda ? ` at ${reso.azienda}` : ""}`)}><Check size={15} aria-hidden="true" /> Mark received</button> : null}
        {reso.fase === "ricevuto" && puo("orders.refunds", "edit") ? <button type="button" className="ord-btn ord-btn--s ord-btn--primario" onClick={onRimborsa}>Refund</button> : null}
      </div>
    </article>
  )
}

export default function Resi() {
  const { puo } = usePermessi()
  const [vista, setVista] = useState<"aperti" | "tutti">("aperti")
  const [motivi, setMotivi] = useState(false)
  const [rimborso, setRimborso] = useState<Reso | null>(null)
  const [attesa, setAttesa] = useState(false)
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiorna()
  const query = useQuery({ queryKey: ["ordini", "resi", vista], queryFn: () => api<ElencoResi>(`/admin/ordini/resi?vista=${vista}`) })
  const dati = query.data
  const importoDi = (r: Reso) => (r.rimborsabile ? Math.min(r.importo, r.rimborsabile) : r.importo)
  const rimborsa = async (r: Reso) => {
    setAttesa(true)
    try {
      await api(`/admin/ordini/resi/${r.id}/rimborsa`, { corpo: { importo: importoDi(r) } })
      avvisa(`R-${r.numero} refunded`)
      await aggiorna()
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setAttesa(false)
      setRimborso(null)
    }
  }
  return (
    <>
      <div className="ord-tessere ord-tessere--tre">
        <Tessera icona={RotateCcw} tono="rosa" valore={<Cifra valore={dati?.riquadri.aperti ?? 0} formato={intero} />} testo="Open returns" />
        <Tessera icona={CreditCard} tono="verde" valore={<Cifra valore={dati?.riquadri.rimborsato ?? 0} formato={euro} />} testo="Refunded this month" />
        <Tessera icona={Percent} tono="blu" valore={dati?.riquadri.tasso === null || !dati ? "–" : percentuale(dati.riquadri.tasso)} testo="Return rate, 30 days" />
      </div>
      <div className="ord-barra ord-barra--resi">
        <Segmenti etichetta="Choose which returns to see" valore={vista} voci={[{ valore: "aperti", testo: "Open" }, { valore: "tutti", testo: "All returns" }]} onCambia={setVista} />
        <span className="ord-spazio" />
        {puo("return_reasons", "edit") ? <button type="button" className="ord-btn ord-btn--s" onClick={() => setMotivi(true)}><Settings2 size={15} aria-hidden="true" /> Return reasons</button> : null}
      </div>
      {query.error ? <p className="ord-avviso" role="alert">{(query.error as Error).message}</p> : null}
      {dati && !dati.resi.length ? (
        <section className="ord-riquadro vetro">
          <div className="ord-vuoto">
            <RotateCcw size={30} aria-hidden="true" />
            <strong>{vista === "aperti" ? "No open returns" : "No returns yet"}</strong>
            <p>Start a return from a shipped order: it lands here for approval.</p>
          </div>
        </section>
      ) : null}
      <div className="ord-resi">
        {dati?.resi.map((r) => <SchedaReso key={r.id} reso={r} onRimborsa={() => setRimborso(r)} />)}
      </div>
      {motivi ? <MotiviReso onChiudi={() => setMotivi(false)} /> : null}
      {rimborso ? (
        <Domanda
          titolo={`Refund ${euro(importoDi(rimborso))}?`}
          testo={`The money goes back to the payment used on #${rimborso.ordine_numero}. It cannot be taken back afterwards.`}
          azione={`Refund ${euro(importoDi(rimborso))}`}
          attesa={attesa}
          onConferma={() => void rimborsa(rimborso)}
          onChiudi={() => setRimborso(null)}
        />
      ) : null}
    </>
  )
}
