import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Download, UsersRound, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { scaricaCsv } from "../../esporta"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Stato, dataBreve, euro } from "../../ui"
import { interrogazione, useRitardato } from "../magazzino/dati"
import CassettoCliente from "./CassettoCliente"
import { FILTRI, ORDINI, PER_PAGINA, SEGMENTI, iniziali, nomeCompleto, quandoBreve, tonoIniziali } from "./dati"
import NuovoCliente from "./NuovoCliente"
import type { Cliente, ElencoClienti, Filtro } from "./tipi"

const colonne: Colonna<Cliente>[] = [
  {
    titolo: "Customer",
    cella: (c) => (
      <span className="cli-persona">
        <span className={`cli-iniziali cli-iniziali--${tonoIniziali(c.id)}`} aria-hidden="true">{iniziali(c)}</span>
        <span className="cli-nome">
          <strong>{nomeCompleto(c)}</strong>
          <small>{[c.rivenditore ? "Stockist" : null, c.nome || c.cognome ? c.email ?? "No email" : "No name yet"].filter(Boolean).join(" · ")}</small>
        </span>
      </span>
    ),
  },
  { titolo: "Town", cella: (c) => <span className="cli-tenue">{c.citta ?? "–"}</span> },
  { titolo: "Orders", destra: true, cella: (c) => numero(c.ordini) },
  { titolo: "Spent", destra: true, cella: (c) => euro(c.speso) },
  { titolo: "Last order", cella: (c) => <span className="cli-tenue">{c.ultimo_ordine ? quandoBreve(c.ultimo_ordine) : "None"}</span> },
  { titolo: "Newsletter", cella: (c) => <span className={`cli-pillola${c.newsletter ? " cli-pillola--ok" : ""}`}>{c.newsletter ? "Subscribed" : "Not subscribed"}</span> },
]

const INTESTAZIONI = ["First name", "Last name", "Email", "Phone", "Company name", "Town", "Newsletter", "Consent date", "Stockist", "Tags", "Groups", "Orders", "Spent", "Last order", "Customer since", "Notes"]

const rigaCsv = (c: Cliente) => [
  c.nome,
  c.cognome,
  c.email,
  c.telefono,
  c.azienda,
  c.citta,
  c.newsletter ? "Yes" : "No",
  c.newsletter_data ? dataBreve(c.newsletter_data) : "",
  c.rivenditore ? "Yes" : "No",
  c.tag.join(", "),
  c.gruppi.map((g) => g.nome).join(", "),
  c.ordini,
  c.speso,
  c.ultimo_ordine ? dataBreve(c.ultimo_ordine) : "",
  dataBreve(c.creato_il),
  c.note,
]

export default function Persone() {
  const { id } = useParams()
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [parametri, setParametri] = useSearchParams()
  const [testo, setTesto] = useState("")
  const q = useRitardato(testo.trim())
  const [filtro, setFiltro] = useState<Filtro>((parametri.get("filtro") as Filtro | null) ?? "tutti")
  const [ordina, setOrdina] = useState("speso")
  const [quanti, setQuanti] = useState(PER_PAGINA)
  const [esporto, setEsporto] = useState(false)
  const nuovo = parametri.get("nuovo") === "1"
  const segmento = parametri.get("segmento") ?? undefined
  const citta = parametri.get("citta") ?? undefined
  const gruppo = parametri.get("gruppo") ?? undefined
  const filtri = { q, filtro, ordina, segmento, citta, gruppo }

  useEffect(() => setQuanti(PER_PAGINA), [q, filtro, ordina, segmento, citta, gruppo])

  const query = useQuery({
    queryKey: ["clienti", "elenco", filtri, quanti],
    queryFn: () => api<ElencoClienti>(`/admin/clienti?${interrogazione({ ...filtri, limit: quanti })}`),
    placeholderData: keepPreviousData,
  })
  const dati = query.data
  const puoCreare = puo("customers", "edit")
  const ristretto = segmento ? `Segment: ${SEGMENTI[segmento] ?? segmento}` : citta ? `Town: ${citta}` : gruppo ? "Customers in the chosen group" : null
  const cercando = Boolean(q || filtro !== "tutti" || ristretto)

  const pulisci = () => {
    setTesto("")
    setFiltro("tutti")
    setParametri({})
  }

  const apriNuovo = () => setParametri((attuali) => ({ ...Object.fromEntries(attuali), nuovo: "1" }))
  const chiudiNuovo = () =>
    setParametri((attuali) => {
      attuali.delete("nuovo")
      return attuali
    })

  const esporta = async () => {
    setEsporto(true)
    try {
      const { clienti } = await api<ElencoClienti>(`/admin/clienti?${interrogazione({ ...filtri, tutte: 1 })}`)
      scaricaCsv("customers", INTESTAZIONI, clienti.map(rigaCsv))
      avvisa(`Exported ${numero(clienti.length)} customers`)
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setEsporto(false)
    }
  }

  return (
    <section className="cli-blocco vetro">
      <div className="cli-pillole" role="group" aria-label="Filter customers">
        {FILTRI.map((f) => (
          <button key={f.valore} type="button" className={filtro === f.valore ? "attivo" : undefined} aria-pressed={filtro === f.valore} onClick={() => setFiltro(f.valore)}>
            {f.testo} <em>{numero(dati?.conteggi[f.valore] ?? 0)}</em>
          </button>
        ))}
      </div>
      <div className="cli-strumenti">
        <CampoRicerca valore={testo} etichetta="Name, email or town" onCambia={setTesto} />
        <span className="spazio" />
        <button type="button" className="cli-piccolo" disabled={esporto || !dati?.conteggio} onClick={() => void esporta()}>
          <Download size={16} aria-hidden="true" /> {esporto ? "Exporting..." : "Export CSV"}
        </button>
        <label className="cli-ordina">
          <span>Sort</span>
          <select value={ordina} onChange={(e) => setOrdina(e.target.value)}>
            {ORDINI.map((o) => <option key={o.valore} value={o.valore}>{o.testo}</option>)}
          </select>
        </label>
      </div>
      {ristretto ? (
        <p className="cli-ristretto">
          {ristretto}
          <button type="button" className="icona-pulsante" aria-label="Show all customers" onClick={() => setParametri({})}>
            <X size={15} aria-hidden="true" />
          </button>
        </p>
      ) : null}
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {dati && !dati.clienti.length ? (
        <Vuoto
          icona={UsersRound}
          titolo={cercando ? "No one found" : "No customers yet"}
          testo={cercando ? "Try a different name, town or filter." : "Customers appear here when they buy, or when you add them by hand."}
          azione={cercando ? <button type="button" onClick={pulisci}>Clear</button> : puoCreare ? <button type="button" className="primario" onClick={apriNuovo}>Add your first customer</button> : undefined}
        />
      ) : null}
      {dati?.clienti.length ? (
        <Tabella etichetta="Customers" colonne={colonne} righe={dati.clienti} chiave={(c) => c.id} onApri={(c) => naviga(`/clienti/persone/${c.id}`)} />
      ) : null}
      {dati?.clienti.length ? (
        <footer className="cli-piede">
          <span>{numero(dati.clienti.length)} of {numero(dati.conteggio)}</span>
          {dati.conteggio > dati.clienti.length ? (
            <button type="button" className="cli-piccolo" onClick={() => setQuanti((n) => n + PER_PAGINA)}>Show {numero(Math.min(PER_PAGINA, dati.conteggio - dati.clienti.length))} more</button>
          ) : null}
        </footer>
      ) : null}
      {nuovo && puoCreare ? <NuovoCliente onChiudi={chiudiNuovo} onCreato={(creato) => naviga(`/clienti/persone/${creato}`)} /> : null}
      {id ? <CassettoCliente id={id} onChiudi={() => naviga("/clienti/persone")} /> : null}
    </section>
  )
}
