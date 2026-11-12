import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowLeft, LifeBuoy, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, Tabella, Vuoto, type Colonna } from "../../componenti"
import { fa } from "../../lingua"
import { usePermessi } from "../../permessi"
import { useSessione } from "../../sessione"
import { Etichetta, Modale, Pagina, Stato } from "../../ui"
import { ModuloRichiesta } from "./ModuloRichiesta"
import { CATEGORIE, statoRichiesta, type Richiesta } from "./tipi"

const PER_PAGINA = 20

const FILTRI: [valore: string, nome: string][] = [
  ["", "All"],
  ["aperta", "Open"],
  ["in_attesa", "Replied"],
  ["chiusa", "Closed"],
]

export default function Richieste() {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const [parametri, setParametri] = useSearchParams()
  const staff = sessione?.tipo === "admin"
  const base = staff ? "/admin" : "/vendor"
  const [stato, setStato] = useState("")
  const [cerca, setCerca] = useState("")
  const [pagina, setPagina] = useState(1)
  const [nuova, setNuova] = useState(false)

  useEffect(() => {
    if (parametri.get("nuovo") !== "1") return
    setNuova(true)
    setParametri({}, { replace: true })
  }, [parametri, setParametri])

  const query = useQuery({
    queryKey: ["assistenza", "richieste", base, stato, cerca, pagina],
    queryFn: () => {
      const filtri = new URLSearchParams({ limit: String(PER_PAGINA), offset: String((pagina - 1) * PER_PAGINA) })
      if (stato) filtri.set("stato", stato)
      if (cerca.trim()) filtri.set("q", cerca.trim())
      return api<{ totale: number; richieste: Richiesta[] }>(`${base}/assistenza/richieste?${filtri}`)
    },
    placeholderData: keepPreviousData,
  })
  const righe = query.data?.richieste ?? []
  const filtrate = Boolean(stato || cerca.trim())

  const colonne: Colonna<Richiesta>[] = [
    { titolo: "Request", cella: (r) => r.codice },
    { titolo: "Subject", cella: (r) => <strong>{r.oggetto}</strong> },
    ...(staff ? [{ titolo: "Company", cella: (r: Richiesta) => r.azienda ?? "Internal" }] : []),
    { titolo: "Topic", cella: (r) => CATEGORIE[r.categoria] ?? "Something else" },
    {
      titolo: "Status",
      cella: (r) => {
        const { testo, tono } = statoRichiesta(r.stato, staff)
        return <Etichetta tono={tono}>{testo}</Etichetta>
      },
    },
    { titolo: "Last message", cella: (r) => fa(r.ultimo_messaggio_il) },
  ]

  const scegliStato = (valore: string) => {
    setStato(valore)
    setPagina(1)
  }

  return (
    <Pagina
      titolo="Help requests"
      sottotitolo={staff ? "Every request from companies and team members." : "Your company's requests to the Ishtar Lab team."}
      azioni={puo("assistenza", "edit") ? <button type="button" className="primario" onClick={() => setNuova(true)}><Plus size={17} aria-hidden="true" /> New request</button> : undefined}
    >
      <div className="fedele">
      <Link className="assistenza__indietro" to="/assistenza"><ArrowLeft size={16} aria-hidden="true" /> Back to Help</Link>
      <div className="assistenza__barra">
        <CampoRicerca
          valore={cerca}
          etichetta="Search by subject"
          onCambia={(valore) => {
            setCerca(valore)
            setPagina(1)
          }}
        />
      </div>
      <div className="filtri" role="group" aria-label="Status">
        {FILTRI.map(([valore, nome]) => (
          <button key={nome} type="button" aria-pressed={stato === valore} className={stato === valore ? "attivo" : ""} onClick={() => scegliStato(valore)}>{nome}</button>
        ))}
      </div>

      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {righe.length ? <Tabella etichetta="Help requests" colonne={colonne} righe={righe} chiave={(r) => r.id} onApri={(r) => naviga(`/assistenza/richieste/${r.id}`)} /> : null}
      {query.isSuccess && !righe.length ? (
        <Vuoto
          icona={LifeBuoy}
          titolo={filtrate ? "No requests found" : "No requests yet"}
          testo={filtrate ? "Change the filter or the search." : staff ? "When a company writes in, the request will appear here." : "If the questions on the Help page are not enough, write to the team."}
        />
      ) : null}
      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={query.data?.totale ?? 0} onCambia={setPagina} />

      {nuova ? (
        <Modale
          titolo="New request"
          sottotitolo={staff ? "Team members and the store owner will see it." : "It goes to the Ishtar Lab team, who will reply here."}
          onChiudi={() => setNuova(false)}
        >
          <ModuloRichiesta onInviata={() => setNuova(false)} />
        </Modale>
      ) : null}
      </div>
    </Pagina>
  )
}
