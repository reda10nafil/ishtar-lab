import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Search, ShoppingBag } from "lucide-react"
import { useEffect, useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { api } from "../api/client"
import { useAvvisi } from "../componenti"
import { scaricaCsv } from "../esporta"
import { numero } from "../lingua"
import { dataOra, euro } from "../ui"
import { interrogazione, useRitardato } from "../sezioni/magazzino/dati"
import { evasioneDi, PASSO, quando, useGuscio } from "../sezioni/ordini/dati"
import { Avatar, Mini, Pillola, useRigheRientrano } from "../sezioni/ordini/Pezzi"
import type { ElencoAzienda, RigaAzienda } from "../sezioni/ordini/tipi"

const FILTRI = [
  { valore: "tutti", testo: "All" },
  { valore: "da_preparare", testo: "To pack" },
  { valore: "preparati", testo: "Packed" },
  { valore: "spediti", testo: "Shipped" },
  { valore: "consegnati", testo: "Delivered" },
]

const csv = (o: RigaAzienda) => [`#${o.numero}`, dataOra(o.creato_il), o.destinatario.nome, o.destinatario.citta, o.articoli, evasioneDi(o.evasione).testo, o.valore]

/** L'elenco dell'azienda: solo le proprie righe e il destinatario, mai i dati del cliente o dei prezzi di vendita. */
export default function OrdiniAzienda() {
  const { esporta: riferimento } = useGuscio()
  const { avvisa, segnalaErrore } = useAvvisi()
  const naviga = useNavigate()
  const [testo, setTesto] = useState("")
  const q = useRitardato(testo.trim())
  const [filtro, setFiltro] = useState("tutti")
  const [quanti, setQuanti] = useState(PASSO)

  useEffect(() => setQuanti(PASSO), [q, filtro])

  const query = useQuery({
    queryKey: ["ordini", "elenco-azienda", q, filtro, quanti],
    queryFn: () => api<ElencoAzienda>(`/vendor/ordini?${interrogazione({ q, filtro, limit: quanti, offset: 0 })}`),
    placeholderData: keepPreviousData,
  })
  const dati = query.data
  const righe = dati?.ordini ?? []
  const guscio = useRigheRientrano(righe.map((r) => r.id).join("|"))
  const filtrato = Boolean(q || filtro !== "tutti")

  riferimento.current = async () => {
    try {
      const { ordini } = await api<ElencoAzienda>(`/vendor/ordini?${interrogazione({ q, filtro, tutte: 1 })}`)
      scaricaCsv("orders", ["Order", "Date", "Recipient", "City", "Items", "Fulfilment", "Supply value"], ordini.map(csv))
      avvisa(`Exported ${numero(ordini.length)} orders`)
    } catch (errore) {
      segnalaErrore(errore)
    }
  }

  return (
    <>
      <section className="ord-riquadro vetro">
        <div className="ord-strumenti">
          <div className="filtri ord-filtri" role="group" aria-label="Filter orders">
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
              <input type="search" value={testo} placeholder="Order number, recipient or product" aria-label="Search orders" onChange={(e) => setTesto(e.target.value)} />
            </label>
          </div>
        </div>
        {query.error ? <p className="ord-avviso" role="alert">{(query.error as Error).message}</p> : null}
        {righe.length ? (
          <div className="ord-tabella-guscio" ref={guscio}>
            <table className="tabella ord-tabella" aria-label="Orders">
              <thead>
                <tr>
                  <th scope="col" className="ord-prima">Order</th>
                  <th scope="col">Date</th>
                  <th scope="col">Recipient</th>
                  <th scope="col">Items</th>
                  <th scope="col">Fulfilment</th>
                  <th scope="col" className="ord-destra">Supply value</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((o) => {
                  const evasione = evasioneDi(o.evasione)
                  return (
                    <tr key={o.id} className="ord-apribile" tabIndex={0} onClick={() => naviga(`/ordini/tutti/${o.id}`)} onKeyDown={(e) => e.key === "Enter" && naviga(`/ordini/tutti/${o.id}`)}>
                      <td data-titolo="Order" className="ord-prima"><b className="ord-numero">#{o.numero}</b></td>
                      <td data-titolo="Date" className="ord-tenue">{quando(o.creato_il)}</td>
                      <td data-titolo="Recipient"><span className="ord-persona"><Avatar nome={o.destinatario.nome} piccolo /><b>{o.destinatario.nome}</b></span></td>
                      <td data-titolo="Items"><span className="ord-articoli">{o.anteprime.map((a, i) => <Mini key={i} url={a.miniatura} titolo={a.titolo} />)}<small>{numero(o.articoli)}</small></span></td>
                      <td data-titolo="Fulfilment"><Pillola tono={evasione.tono}>{evasione.testo}</Pillola>{o.in_ritardo ? <> <Pillola tono="errore">Late</Pillola></> : null}</td>
                      <td data-titolo="Supply value" className="ord-destra ord-importo">{euro(o.valore)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {dati && !righe.length ? (
          <div className="ord-vuoto">
            <ShoppingBag size={30} aria-hidden="true" />
            <strong>{filtrato ? (q ? `No orders match “${q}”` : "No orders here") : "No orders yet"}</strong>
            <p>{filtrato ? "Try another status, or clear the search." : "Orders with your products appear here as soon as a customer buys them."}</p>
            {filtrato ? <button type="button" className="ord-btn ord-btn--s" onClick={() => { setTesto(""); setFiltro("tutti") }}>Clear filters</button> : null}
          </div>
        ) : null}
        {dati && righe.length ? (
          <div className="ord-piede">
            <span>{numero(righe.length)} of {numero(dati.conteggio)}</span>
            {righe.length < dati.conteggio ? <button type="button" className="ord-btn ord-btn--s" onClick={() => setQuanti(quanti + PASSO)}>Show {PASSO} more</button> : null}
          </div>
        ) : null}
      </section>
      <Outlet />
    </>
  )
}
