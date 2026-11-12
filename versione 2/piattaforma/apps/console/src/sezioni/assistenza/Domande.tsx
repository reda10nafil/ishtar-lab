import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { Riquadro } from "../../componenti"
import { fa, numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { useSessione } from "../../sessione"
import { Etichetta, Pagina, Stato } from "../../ui"
import { DOMANDE } from "./elenco-domande"
import { ModuloRichiesta } from "./ModuloRichiesta"
import { CATEGORIE, statoRichiesta, type Richiesta } from "./tipi"

const RICHIESTE_RECENTI = 5
const PILLOLE = ["Products", "Shipping", "Team", "Apps"]

/** Senza accenti e maiuscole: la ricerca non dipende da come si scrive. */
const piano = (testo: string) => testo.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

function RichiesteRecenti({ staff }: { staff: boolean }) {
  const query = useQuery({
    queryKey: ["assistenza", "recenti", staff],
    queryFn: () => api<{ totale: number; richieste: Richiesta[] }>(`/${staff ? "admin" : "vendor"}/assistenza/richieste?limit=${RICHIESTE_RECENTI}`),
  })
  const righe = query.data?.richieste ?? []
  return (
    <Riquadro titolo={staff ? "Latest requests" : "Your requests"}>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !righe.length ? <p className="aiuto__nessuna">No requests yet.</p> : null}
      {righe.length ? (
        <ul className="aiuto__richieste">
          {righe.map((r) => {
            const { testo, tono } = statoRichiesta(r.stato, staff)
            return (
              <li key={r.id} data-riga>
                <Link to={`/assistenza/richieste/${r.id}`}>
                  <span>
                    <strong>{r.oggetto}</strong>
                    <small>{[r.codice, CATEGORIE[r.categoria] ?? "Something else", staff ? r.azienda ?? "Internal" : null, fa(r.ultimo_messaggio_il)].filter(Boolean).join(" · ")}</small>
                  </span>
                  <Etichetta tono={tono}>{testo}</Etichetta>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
      {righe.length ? <Link className="aiuto__tutte" to="/assistenza/richieste">View all requests ({numero(query.data?.totale ?? 0)})</Link> : null}
    </Riquadro>
  )
}

export default function Domande() {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const staff = sessione?.tipo === "admin"
  const profilo = staff ? "admin" : "azienda"
  const [cerca, setCerca] = useState("")
  const [aperta, setAperta] = useState(0)

  const proprie = useMemo(() => DOMANDE.filter((d) => d.profili.includes(profilo)), [profilo])
  const parole = piano(cerca).split(/\s+/).filter(Boolean)
  const visibili = proprie.filter((d) => {
    const testo = piano(`${d.domanda} ${d.risposta} ${d.categoria}`)
    return parole.every((p) => testo.includes(p))
  })

  // Come nel pannello: una ricerca nuova riparte con la prima risposta aperta.
  const cercaTesto = (testo: string) => {
    setCerca(testo)
    setAperta(0)
  }

  return (
    <Pagina titolo="Help" sottotitolo={staff ? "Answers, and every request from your companies." : "Answers, and a direct line to the Ishtar Lab team."}>
      <div className="fedele">
        <section className="aiuto__ricerca vetro">
          <h2>How can we help?</h2>
          <label className="aiuto__campo">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={cerca} placeholder={'Try "invite", "shipping" or "VAT"'} aria-label="Search the questions" onChange={(e) => cercaTesto(e.target.value)} />
            {cerca ? (
              <button type="button" className="aiuto__pulisci" aria-label="Clear search" onClick={() => cercaTesto("")}><X size={15} aria-hidden="true" /></button>
            ) : null}
          </label>
          <div className="aiuto__pillole" role="group" aria-label="Topic">
            {PILLOLE.map((p) => <button key={p} type="button" onClick={() => cercaTesto(p.toLowerCase())}>{p}</button>)}
          </div>
        </section>

        <div className="aiuto__colonne">
          <Riquadro titolo="Common questions" testo={`${numero(visibili.length)} ${visibili.length === 1 ? "answer" : "answers"}`}>
            {visibili.length ? (
              <div className="domande">
                {visibili.map((d, indice) => {
                  const aperto = aperta === indice
                  return (
                    <div key={d.domanda} className={aperto ? "domanda domanda--aperta" : "domanda"} data-riga>
                      <button type="button" aria-expanded={aperto} onClick={() => setAperta(aperto ? -1 : indice)}>
                        <span className="domanda__tema">{d.categoria}</span>
                        <span className="domanda__testo">{d.domanda}</span>
                        <ChevronDown size={17} aria-hidden="true" />
                      </button>
                      <div className="domanda__corpo"><div><p>{d.risposta}</p></div></div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="aiuto__nulla">
                <span aria-hidden="true"><Search size={18} /></span>
                <strong>Nothing about “{cerca}”</strong>
                <p>Send the team a request and they will answer here.</p>
              </div>
            )}
          </Riquadro>

          <div className="aiuto__lato">
            {puo("assistenza", "edit") ? (
              <Riquadro titolo="Ask the team" testo={staff ? "Team members and the store owner will see it" : "It goes to the Ishtar Lab team, who will reply here"}>
                <ModuloRichiesta />
              </Riquadro>
            ) : null}
            <RichiesteRecenti staff={staff} />
          </div>
        </div>
      </div>
    </Pagina>
  )
}
