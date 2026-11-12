import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { AlarmClock, Box, ClipboardCheck, Search, Truck } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { numero } from "../../lingua"
import { Cifra } from "../../movimenti"
import { usePermessi } from "../../permessi"
import { useSessione } from "../../sessione"
import { dataBreve } from "../../ui"
import { interrogazione, useRitardato } from "../magazzino/dati"
import { intero, PASSI, PASSO, prossimaAzione, quando, STATI_RICHIESTA } from "../ordini/dati"
import { ModuloSpedizione, useAvanza } from "../ordini/Evasione"
import { Avatar, Mini, Pillola, Tessera, useRigheRientrano } from "../ordini/Pezzi"
import type { ElencoCoda, Richiesta } from "../ordini/tipi"

const FILTRI = [
  { valore: "tutte", testo: "All" },
  { valore: "da_confermare", testo: "To confirm" },
  { valore: "confermate", testo: "To pack" },
  { valore: "preparate", testo: "Packed" },
  { valore: "spedite", testo: "Shipped" },
  { valore: "consegnate", testo: "Delivered" },
  { valore: "in_ritardo", testo: "Late" },
]

function Azione({ richiesta, onSpedisci }: { richiesta: Richiesta; onSpedisci: () => void }) {
  const { esegui, attesa } = useAvanza()
  const azione = prossimaAzione(richiesta.stato)
  if (!azione) return null
  return (
    <button
      type="button"
      className="ord-btn ord-btn--s"
      disabled={attesa}
      onClick={(e) => {
        e.stopPropagation()
        if (azione === "spedisci") onSpedisci()
        else void esegui(richiesta, azione)
      }}
    >
      {PASSI[azione]}
    </button>
  )
}

/** La coda delle evasioni: una riga per ogni azienda coinvolta in un ordine. */
export default function Coda() {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const admin = sessione?.tipo === "admin"
  const [testo, setTesto] = useState("")
  const q = useRitardato(testo.trim())
  const [filtro, setFiltro] = useState("tutte")
  const [azienda, setAzienda] = useState("")
  const [quanti, setQuanti] = useState(PASSO)
  const [spedisco, setSpedisco] = useState<Richiesta | null>(null)
  const base = admin ? "/admin/evasioni" : "/vendor/evasioni"

  useEffect(() => setQuanti(PASSO), [q, filtro, azienda])

  const query = useQuery({
    queryKey: ["ordini", "coda", base, q, filtro, azienda, quanti],
    queryFn: () => api<ElencoCoda>(`${base}?${interrogazione({ q, filtro, azienda, limit: quanti, offset: 0 })}`),
    placeholderData: keepPreviousData,
  })
  const dati = query.data
  const righe = dati?.richieste ?? []
  const guscio = useRigheRientrano(righe.map((r) => r.id).join("|"))
  const filtrato = Boolean(q || filtro !== "tutte" || azienda)
  const scrive = puo("evasioni", "edit")
  const apri = (r: Richiesta) => naviga(`/ordini/tutti/${r.ordine_id}`, { state: { da: "/evasioni" } })

  return (
    <>
      <div className="ord-tessere">
        <Tessera icona={ClipboardCheck} tono="rosso" valore={<Cifra valore={dati?.riquadri.da_confermare ?? 0} formato={intero} />} testo="To confirm" />
        <Tessera icona={Box} tono="giallo" valore={<Cifra valore={dati?.riquadri.da_preparare ?? 0} formato={intero} />} testo="To pack" />
        <Tessera icona={Truck} tono="blu" valore={<Cifra valore={dati?.riquadri.da_spedire ?? 0} formato={intero} />} testo="Ready to ship" />
        <Tessera icona={AlarmClock} tono="rosa" valore={<Cifra valore={dati?.riquadri.in_ritardo ?? 0} formato={intero} />} testo="Late" />
      </div>
      <section className="ord-riquadro vetro">
        <div className="ord-strumenti">
          <div className="filtri ord-filtri" role="group" aria-label="Filter requests">
            {FILTRI.map((f) => (
              <button key={f.valore} type="button" className={filtro === f.valore ? "attivo" : undefined} aria-pressed={filtro === f.valore} onClick={() => setFiltro(f.valore)}>
                {f.testo}
                <em>{numero(dati?.conteggi[f.valore] ?? 0)}</em>
              </button>
            ))}
          </div>
          <div className="ord-barra">
            <label className="ord-cerca">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={testo} placeholder="Order number, recipient or product" aria-label="Search requests" onChange={(e) => setTesto(e.target.value)} />
            </label>
            {admin ? (
              <select className="ord-scelta" value={azienda} aria-label="Filter by company" onChange={(e) => setAzienda(e.target.value)}>
                <option value="">All companies</option>
                {dati?.aziende.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            ) : null}
          </div>
        </div>
        {query.error ? <p className="ord-avviso" role="alert">{(query.error as Error).message}</p> : null}
        {righe.length ? (
          <div className="ord-tabella-guscio" ref={guscio}>
            <table className="tabella ord-tabella" aria-label="Fulfilment requests">
              <thead>
                <tr>
                  <th scope="col" className="ord-prima">Order</th>
                  <th scope="col">Date</th>
                  {admin ? <th scope="col">Company</th> : null}
                  <th scope="col">Recipient</th>
                  <th scope="col">Items</th>
                  <th scope="col">Due</th>
                  <th scope="col">Status</th>
                  {scrive ? <th scope="col" className="ord-destra">Next step</th> : null}
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => {
                  const stato = STATI_RICHIESTA[r.stato]
                  return (
                    <tr key={r.id} className="ord-apribile" tabIndex={0} onClick={() => apri(r)} onKeyDown={(e) => e.key === "Enter" && apri(r)}>
                      <td data-titolo="Order" className="ord-prima"><b className="ord-numero">#{r.numero}</b></td>
                      <td data-titolo="Date" className="ord-tenue">{quando(r.creata_il)}</td>
                      {admin ? <td data-titolo="Company"><b>{r.azienda}</b></td> : null}
                      <td data-titolo="Recipient"><span className="ord-persona"><Avatar nome={r.destinatario?.nome ?? "?"} piccolo /><b>{r.destinatario?.nome}</b></span></td>
                      <td data-titolo="Items"><span className="ord-articoli">{r.righe.slice(0, 3).map((x) => <Mini key={x.id} url={x.miniatura} titolo={x.titolo} />)}<small>{numero(r.righe.reduce((s, x) => s + x.quantita, 0))}</small></span></td>
                      <td data-titolo="Due" className={r.in_ritardo ? "ord-rosso" : "ord-tenue"}>{r.scadenza ? dataBreve(r.scadenza) : "No limit set"}</td>
                      <td data-titolo="Status"><Pillola tono={stato.tono}>{stato.testo}</Pillola>{r.in_ritardo ? <> <Pillola tono="errore">Late</Pillola></> : null}</td>
                      {scrive ? <td data-titolo="Next step" className="ord-destra"><Azione richiesta={r} onSpedisci={() => setSpedisco(r)} /></td> : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {dati && !righe.length ? (
          <div className="ord-vuoto">
            <Truck size={30} aria-hidden="true" />
            <strong>{filtrato ? "No requests here" : "Nothing to fulfil"}</strong>
            <p>{filtrato ? "Try another status, or clear the search." : admin ? "Each order creates one request for every company involved." : "New orders with your products land here for you to confirm."}</p>
            {filtrato ? <button type="button" className="ord-btn ord-btn--s" onClick={() => { setTesto(""); setFiltro("tutte"); setAzienda("") }}>Clear filters</button> : null}
          </div>
        ) : null}
        {dati && righe.length ? (
          <div className="ord-piede">
            <span>{numero(righe.length)} of {numero(dati.conteggio)}</span>
            {righe.length < dati.conteggio ? <button type="button" className="ord-btn ord-btn--s" onClick={() => setQuanti(quanti + PASSO)}>Show {PASSO} more</button> : null}
          </div>
        ) : null}
      </section>
      {spedisco ? <ModuloSpedizione richiesta={spedisco} onChiudi={() => setSpedisco(null)} /> : null}
    </>
  )
}
