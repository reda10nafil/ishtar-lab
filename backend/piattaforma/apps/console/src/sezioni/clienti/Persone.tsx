import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Download, UsersRound, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { scaricaCsv } from "../../esporta"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Etichetta, Stato, dataBreve, euro } from "../../ui"
import { interrogazione, useRitardato } from "../magazzino/dati"
import { FILTRI, ORDINI, PER_PAGINA, SEGMENTI, iniziali, nomeCompleto } from "./dati"
import ModuloCliente from "./ModuloCliente"
import type { Cliente, ElencoClienti, Filtro } from "./tipi"

const colonne: Colonna<Cliente>[] = [
  {
    titolo: "Customer",
    cella: (c) => (
      <span className="cli-persona">
        <span className="cli-iniziali" aria-hidden="true">{iniziali(c)}</span>
        <span className="cli-nome">
          <strong>{nomeCompleto(c)}</strong>
          <small>{[c.rivenditore ? "Stockist" : null, c.email ?? "No email"].filter(Boolean).join(" · ")}</small>
        </span>
      </span>
    ),
  },
  { titolo: "Town", cella: (c) => c.citta ?? "–" },
  { titolo: "Orders", destra: true, cella: (c) => numero(c.ordini) },
  { titolo: "Spent", destra: true, cella: (c) => euro(c.speso) },
  { titolo: "Last order", cella: (c) => (c.ultimo_ordine ? dataBreve(c.ultimo_ordine) : "None") },
  { titolo: "Newsletter", cella: (c) => <Etichetta tono={c.newsletter ? "ok" : "neutro"}>{c.newsletter ? "Subscribed" : "Not subscribed"}</Etichetta> },
]

const INTESTAZIONI = ["First name", "Last name", "Email", "Phone", "Company name", "Town", "Newsletter", "Consent date", "Stockist", "Groups", "Orders", "Spent", "Last order", "Customer since", "Notes"]

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
  c.gruppi.map((g) => g.nome).join(", "),
  c.ordini,
  c.speso,
  c.ultimo_ordine ? dataBreve(c.ultimo_ordine) : "",
  dataBreve(c.creato_il),
  c.note,
]

export default function Persone() {
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [parametri, setParametri] = useSearchParams()
  const [testo, setTesto] = useState("")
  const q = useRitardato(testo.trim())
  const [filtro, setFiltro] = useState<Filtro>("tutti")
  const [ordina, setOrdina] = useState("speso")
  const [pagina, setPagina] = useState(1)
  const [esporto, setEsporto] = useState(false)
  const nuovo = parametri.get("nuovo") === "1"
  const segmento = parametri.get("segmento") ?? undefined
  const citta = parametri.get("citta") ?? undefined
  const gruppo = parametri.get("gruppo") ?? undefined
  const filtri = { q, filtro, ordina, segmento, citta, gruppo }

  useEffect(() => setPagina(1), [q, filtro, ordina, segmento, citta, gruppo])

  const query = useQuery({
    queryKey: ["clienti", "elenco", filtri, pagina],
    queryFn: () => api<ElencoClienti>(`/admin/clienti?${interrogazione({ ...filtri, limit: PER_PAGINA, offset: (pagina - 1) * PER_PAGINA })}`),
    placeholderData: keepPreviousData,
  })
  const dati = query.data
  const puoCreare = puo("customers", "edit")
  const ristretto = segmento ? `Segment: ${SEGMENTI[segmento] ?? segmento}` : citta ? `Town: ${citta}` : gruppo ? "Customers in the chosen group" : null
  const cercando = Boolean(q || filtro !== "tutti" || ristretto)

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
    <section className="riquadro vetro cli-blocco">
      <div className="filtri" role="group" aria-label="Filter customers">
        {FILTRI.map((f) => (
          <button key={f.valore} type="button" className={filtro === f.valore ? "attivo" : undefined} aria-pressed={filtro === f.valore} onClick={() => setFiltro(f.valore)}>
            {f.testo} <em>{numero(dati?.conteggi[f.valore] ?? 0)}</em>
          </button>
        ))}
      </div>
      <div className="barra-strumenti">
        <CampoRicerca valore={testo} etichetta="Name, email or town" onCambia={setTesto} />
        <span className="spazio" />
        <label className="cli-ordina">
          <span>Sort</span>
          <select value={ordina} onChange={(e) => setOrdina(e.target.value)}>
            {ORDINI.map((o) => <option key={o.valore} value={o.valore}>{o.testo}</option>)}
          </select>
        </label>
        <button type="button" disabled={esporto || !dati?.conteggio} onClick={() => void esporta()}>
          <Download size={16} aria-hidden="true" /> {esporto ? "Exporting..." : "Export CSV"}
        </button>
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
          titolo={cercando ? "No customers found" : "No customers yet"}
          testo={cercando ? "No customers match these filters." : "Customers appear here when they buy, or when you add them by hand."}
          azione={!cercando && puoCreare ? <button type="button" className="primario" onClick={apriNuovo}>Add your first customer</button> : undefined}
        />
      ) : null}
      {dati?.clienti.length ? (
        <Tabella etichetta="Customers" colonne={colonne} righe={dati.clienti} chiave={(c) => c.id} onApri={(c) => naviga(`/clienti/persone/${c.id}`)} />
      ) : null}
      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={dati?.conteggio ?? 0} onCambia={setPagina} />
      {nuovo && puoCreare ? <ModuloCliente onChiudi={chiudiNuovo} onCreato={(id) => naviga(`/clienti/persone/${id}`)} /> : null}
    </section>
  )
}
