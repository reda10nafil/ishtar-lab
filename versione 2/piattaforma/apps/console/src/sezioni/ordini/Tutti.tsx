import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Box, ChevronDown, ChevronUp, CreditCard, Globe, Printer, RotateCcw, Search, ShoppingBag, StickyNote, Store, Truck } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { scaricaCsv } from "../../esporta"
import { numero, STATI_PAGAMENTO, stato } from "../../lingua"
import { Cifra } from "../../movimenti"
import { usePermessi } from "../../permessi"
import { dataOra, euro } from "../../ui"
import { interrogazione, useRitardato } from "../magazzino/dati"
import { CANALI, evasioneDi, FILTRI, intero, NOME_CANALE, PASSO, quando, useAggiorna, useGuscio } from "./dati"
import Distinta, { type Foglio } from "./Distinta"
import { Avatar, Canale, Casella, Domanda, Mini, Pillola, Segmenti, Tessera, useRigheRientrano } from "./Pezzi"
import type { Canale as TipoCanale, Elenco, Filtro, RigaElenco, Scheda } from "./tipi"

type Ordine = "data" | "cliente" | "totale"

const ICONE = { online: Globe, cassa: Store, ingrosso: Truck }

/** Solo gli ordini che possono fare un passo avanti si selezionano. */
const puoAvanzare = (o: RigaElenco) => !o.annullato && o.evasione !== "delivered" && o.evasione !== "collected"

function Testa({ testo, campo, ordina, verso, onOrdina, destra }: { testo: string; campo: Ordine; ordina: Ordine; verso: "asc" | "desc"; onOrdina: (c: Ordine) => void; destra?: boolean }) {
  const attivo = ordina === campo
  const Freccia = verso === "asc" ? ChevronUp : ChevronDown
  return (
    <th scope="col" className={destra ? "ord-destra" : undefined} aria-sort={attivo ? (verso === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="ord-ordina" onClick={() => onOrdina(campo)}>
        {testo}
        {attivo ? <Freccia size={14} aria-hidden="true" /> : null}
      </button>
    </th>
  )
}

const csv = (o: RigaElenco) => [
  `#${o.numero}`,
  dataOra(o.creato_il),
  o.cliente.nome,
  NOME_CANALE[o.canale],
  o.articoli,
  stato(STATI_PAGAMENTO, o.pagamento).testo,
  evasioneDi(o.evasione).testo,
  o.totale,
  o.cliente.email,
  o.aziende.join(", "),
]

const INTESTAZIONI = ["Order", "Date", "Customer", "Channel", "Items", "Payment", "Fulfilment", "Total", "Email", "Companies"]

const nomeFile = () => `ishtar-lab-orders-${new Date().toISOString().slice(0, 10)}`

export default function Tutti() {
  const { esporta: riferimento } = useGuscio()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const naviga = useNavigate()
  const aggiorna = useAggiorna()
  const [testo, setTesto] = useState("")
  const q = useRitardato(testo.trim())
  const [filtro, setFiltro] = useState<Filtro>("tutti")
  const [canale, setCanale] = useState<TipoCanale | "tutti">("tutti")
  const [ordina, setOrdina] = useState<Ordine>("data")
  const [verso, setVerso] = useState<"asc" | "desc">("desc")
  const [quanti, setQuanti] = useState(PASSO)
  const [scelti, setScelti] = useState<Set<string>>(new Set())
  const [annullo, setAnnullo] = useState(false)
  const [lavoro, setLavoro] = useState(false)
  const [fogli, setFogli] = useState<Foglio[] | null>(null)
  const condizioni = { q, filtro, canale: canale === "tutti" ? undefined : canale, ordina, verso }

  useEffect(() => setQuanti(PASSO), [q, filtro, canale, ordina, verso])

  const query = useQuery({
    queryKey: ["ordini", "elenco", condizioni, quanti],
    queryFn: () => api<Elenco>(`/admin/ordini?${interrogazione({ ...condizioni, limit: quanti, offset: 0 })}`),
    placeholderData: keepPreviousData,
  })
  const dati = query.data
  const righe = useMemo(() => dati?.ordini ?? [], [dati])
  const filtrato = Boolean(q || filtro !== "tutti" || canale !== "tutti")
  const avanzabili = righe.filter(puoAvanzare)
  const tutti = avanzabili.length > 0 && avanzabili.every((r) => scelti.has(r.id))
  const guscio = useRigheRientrano(righe.map((r) => r.id).join("|"))

  riferimento.current = async () => {
    try {
      const { ordini } = await api<Elenco>(`/admin/ordini?${interrogazione({ ...condizioni, tutte: 1 })}`)
      scaricaCsv(nomeFile(), INTESTAZIONI, ordini.map(csv))
    } catch (errore) {
      segnalaErrore(errore)
    }
  }

  const ordinaPer = (campo: Ordine) => {
    if (campo === ordina) setVerso(verso === "asc" ? "desc" : "asc")
    else {
      setOrdina(campo)
      setVerso(campo === "cliente" ? "asc" : "desc")
    }
  }

  const alterna = (id: string) =>
    setScelti((attuali) => {
      const nuovi = new Set(attuali)
      if (!nuovi.delete(id)) nuovi.add(id)
      return nuovi
    })

  const inBlocco = async (azione: "avanza" | "incassa" | "annulla", fatto: string) => {
    setLavoro(true)
    try {
      const { riusciti, falliti } = await api<{ riusciti: number; falliti: { id: string; motivo: string }[] }>("/admin/ordini/blocco", { corpo: { azione, ids: [...scelti] } })
      if (riusciti) avvisa(`${numero(riusciti)} ${riusciti === 1 ? "order" : "orders"} ${fatto}`)
      if (falliti.length) segnalaErrore(new Error(falliti.length === 1 ? falliti[0].motivo : `${numero(falliti.length)} orders could not be changed`))
      setScelti(new Set())
      await aggiorna()
      window.setTimeout(() => void aggiorna(), 1500)
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setLavoro(false)
      setAnnullo(false)
    }
  }

  const stampa = async () => {
    setLavoro(true)
    try {
      const schede = await Promise.all([...scelti].map((id) => api<{ ordine: Scheda }>(`/admin/ordini/${id}`)))
      const nuovi = schede.flatMap(({ ordine }) => fogliDi(ordine))
      setFogli(nuovi)
      avvisa(`${numero(nuovi.length)} packing ${nuovi.length === 1 ? "slip" : "slips"} sent to the printer`)
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setLavoro(false)
    }
  }

  const azzera = () => {
    setTesto("")
    setFiltro("tutti")
    setCanale("tutti")
  }

  return (
    <>
      <div className="ord-tessere">
        <Tessera icona={Box} tono="rosso" valore={<Cifra valore={dati?.riquadri.da_preparare ?? 0} formato={intero} />} testo="To pack" />
        <Tessera icona={Truck} tono="giallo" valore={<Cifra valore={dati?.riquadri.da_spedire ?? 0} formato={intero} />} testo="Ready to ship" />
        <Tessera icona={CreditCard} tono="blu" valore={<Cifra valore={dati?.riquadri.non_pagati ?? 0} formato={intero} />} testo="Unpaid" />
        <Tessera icona={RotateCcw} tono="rosa" valore={<Cifra valore={dati?.riquadri.resi_aperti ?? 0} formato={intero} />} testo="Returns open" />
      </div>
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
              <input type="search" value={testo} placeholder="Order number, customer or product" aria-label="Search orders" onChange={(e) => setTesto(e.target.value)} />
            </label>
            <Segmenti etichetta="Filter by channel" valore={canale} voci={[{ valore: "tutti", testo: "All" }, ...CANALI.map((c) => ({ ...c, icona: ICONE[c.valore] }))]} onCambia={setCanale} />
          </div>
        </div>
        {scelti.size ? (
          <div className="ord-blocco" role="region" aria-label="Bulk actions">
            <b>{numero(scelti.size)} selected</b>
            <span className="ord-spazio" />
            {puo("evasioni", "edit") ? <button type="button" className="ord-btn ord-btn--s ord-btn--primario" disabled={lavoro} onClick={() => void inBlocco("avanza", "moved on")}>Move on</button> : null}
            {puo("payments", "edit") ? <button type="button" className="ord-btn ord-btn--s" disabled={lavoro} onClick={() => void inBlocco("incassa", "marked paid")}>Mark paid</button> : null}
            <button type="button" className="ord-btn ord-btn--s" disabled={lavoro} onClick={() => void stampa()}><Printer size={15} aria-hidden="true" /> Print slips</button>
            {puo("orders", "edit") ? <button type="button" className="ord-btn ord-btn--s ord-btn--fantasma ord-btn--rosso" disabled={lavoro} onClick={() => setAnnullo(true)}>Cancel orders</button> : null}
            <button type="button" className="ord-btn ord-btn--s ord-btn--fantasma" onClick={() => setScelti(new Set())}>Clear</button>
          </div>
        ) : null}
        {query.error ? <p className="ord-avviso" role="alert">{(query.error as Error).message}</p> : null}
        {dati && righe.length ? (
          <div className="ord-tabella-guscio" ref={guscio}>
            <table className="tabella ord-tabella ord-tabella--ordini" aria-label="Orders">
              <thead>
                <tr>
                  <th scope="col" className="ord-col-casella">
                    <Casella acceso={tutti} misto={!tutti && avanzabili.some((r) => scelti.has(r.id))} etichetta="Select every order that can move on" onCambia={() => setScelti(tutti ? new Set() : new Set(avanzabili.map((r) => r.id)))} />
                  </th>
                  <th scope="col">Order</th>
                  <Testa testo="Date" campo="data" ordina={ordina} verso={verso} onOrdina={ordinaPer} />
                  <Testa testo="Customer" campo="cliente" ordina={ordina} verso={verso} onOrdina={ordinaPer} />
                  <th scope="col">Channel</th>
                  <th scope="col">Items</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Fulfilment</th>
                  <Testa testo="Total" campo="totale" ordina={ordina} verso={verso} onOrdina={ordinaPer} destra />
                </tr>
              </thead>
              <tbody>
                {righe.map((o) => {
                  const pagamento = stato(STATI_PAGAMENTO, o.pagamento)
                  const evasione = evasioneDi(o.evasione)
                  return (
                    <tr key={o.id} className="ord-apribile" tabIndex={0} onClick={() => naviga(`/ordini/tutti/${o.id}`)} onKeyDown={(e) => e.key === "Enter" && naviga(`/ordini/tutti/${o.id}`)}>
                      <td className="ord-col-casella">{puoAvanzare(o) ? <Casella acceso={scelti.has(o.id)} etichetta={`Select #${o.numero}`} onCambia={() => alterna(o.id)} /> : null}</td>
                      <td data-titolo="Order"><span className="ord-con-nota"><b className="ord-numero">#{o.numero}</b>{o.ha_nota ? <StickyNote size={14} aria-label="This order has a note" /> : null}</span></td>
                      <td data-titolo="Date" className="ord-tenue">{quando(o.creato_il)}</td>
                      <td data-titolo="Customer"><span className="ord-persona">{o.cliente.nome === "Walk-in" ? null : <Avatar nome={o.cliente.nome} piccolo />}<b>{o.cliente.nome}</b></span></td>
                      <td data-titolo="Channel"><Canale canale={o.canale} /></td>
                      <td data-titolo="Items" className="ord-solo-largo">
                        <span className="ord-articoli">
                          {o.anteprime.map((a, i) => <Mini key={i} url={a.miniatura} titolo={a.titolo} />)}
                          <small>{numero(o.articoli)}</small>
                        </span>
                      </td>
                      <td data-titolo="Payment"><Pillola tono={pagamento.tono}>{pagamento.testo}</Pillola></td>
                      <td data-titolo="Fulfilment"><Pillola tono={evasione.tono}>{evasione.testo}</Pillola></td>
                      <td data-titolo="Total" className="ord-destra ord-importo">{euro(o.totale)}</td>
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
            <p>{filtrato ? "Try another status or channel, or clear the search." : "Orders appear here as soon as a customer checks out or a draft is confirmed."}</p>
            {filtrato ? <button type="button" className="ord-btn ord-btn--s" onClick={azzera}>Clear filters</button> : null}
          </div>
        ) : null}
        {dati && righe.length ? (
          <div className="ord-piede">
            <span>{numero(righe.length)} of {numero(dati.conteggio)} · {euro(dati.valore)}</span>
            {righe.length < dati.conteggio ? <button type="button" className="ord-btn ord-btn--s" onClick={() => setQuanti(quanti + PASSO)}>Show {PASSO} more</button> : null}
          </div>
        ) : null}
      </section>
      <Outlet />
      {annullo ? (
        <Domanda
          titolo={`Cancel ${numero(scelti.size)} ${scelti.size === 1 ? "order" : "orders"}?`}
          testo="Companies stop working on them and anything already paid is refunded. Orders with packed items stay as they are."
          azione="Cancel orders"
          attesa={lavoro}
          onConferma={() => void inBlocco("annulla", "cancelled")}
          onChiudi={() => setAnnullo(false)}
        />
      ) : null}
      {fogli ? <Distinta fogli={fogli} onFine={() => setFogli(null)} /> : null}
    </>
  )
}

export const fogliDi = (o: Scheda): Foglio[] =>
  o.richieste.map((r) => ({
    numero: r.numero,
    data: o.creato_il,
    azienda: r.azienda,
    mittente: o.mittente,
    destinatario: o.indirizzo ?? { nome: o.cliente.nome, azienda: null, indirizzo: null, indirizzo_2: null, citta: null, cap: null, provincia: null, paese: null, telefono: null },
    consegna: o.consegna[0]?.nome ?? null,
    righe: r.righe,
  }))
