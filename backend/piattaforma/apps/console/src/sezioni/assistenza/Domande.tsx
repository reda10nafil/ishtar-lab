import { useQuery } from "@tanstack/react-query"
import { ChevronDown, SearchX } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Riquadro, Vuoto } from "../../componenti"
import { fa, numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { useSessione } from "../../sessione"
import { Etichetta, Pagina, Stato } from "../../ui"
import { DOMANDE } from "./elenco-domande"
import { ModuloRichiesta } from "./ModuloRichiesta"
import { CATEGORIE, statoRichiesta, type Richiesta } from "./tipi"

const TUTTE = "All"
const RICHIESTE_RECENTI = 5

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
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={query.isSuccess && !righe.length} testoVuoto="No requests yet." />
      {righe.length ? (
        <ul className="aiuto__richieste">
          {righe.map((r) => {
            const { testo, tono } = statoRichiesta(r.stato, staff)
            return (
              <li key={r.id}>
                <Link to={`/assistenza/richieste/${r.id}`}>
                  <span>
                    <strong>{r.oggetto}</strong>
                    <small>{[CATEGORIE[r.categoria] ?? "Other", staff ? r.azienda ?? "Internal" : null, fa(r.ultimo_messaggio_il)].filter(Boolean).join(" · ")}</small>
                  </span>
                  <Etichetta tono={tono}>{testo}</Etichetta>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
      {righe.length ? <Link className="pulsante-collegamento" to="/assistenza/richieste">View all requests ({numero(query.data?.totale ?? 0)})</Link> : null}
    </Riquadro>
  )
}

export default function Domande() {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const staff = sessione?.tipo === "admin"
  const profilo = staff ? "admin" : "azienda"
  const [cerca, setCerca] = useState("")
  const [categoria, setCategoria] = useState(TUTTE)

  const proprie = useMemo(() => DOMANDE.filter((d) => d.profili.includes(profilo)), [profilo])
  const categorie = [TUTTE, ...new Set(proprie.map((d) => d.categoria))]
  const parole = piano(cerca).split(/\s+/).filter(Boolean)
  const visibili = proprie.filter((d) => {
    if (categoria !== TUTTE && d.categoria !== categoria) return false
    const testo = piano(`${d.domanda} ${d.risposta} ${d.categoria}`)
    return parole.every((p) => testo.includes(p))
  })

  return (
    <Pagina titolo="Help" sottotitolo={staff ? "Answers to common questions, and every request from your companies." : "Answers to common questions, and a direct line to the Ishtar Lab team."}>
      <section className="aiuto__ricerca vetro">
        <h2>Find an answer</h2>
        <div className="aiuto__campo">
          <CampoRicerca valore={cerca} etichetta="Search the questions" onCambia={setCerca} />
        </div>
        <div className="filtri" role="group" aria-label="Topic">
          {categorie.map((c) => (
            <button key={c} type="button" aria-pressed={categoria === c} className={categoria === c ? "attivo" : ""} onClick={() => setCategoria(c)}>{c}</button>
          ))}
        </div>
      </section>

      <div className="aiuto__colonne">
        <Riquadro titolo="Common questions" testo={`${numero(visibili.length)} ${visibili.length === 1 ? "answer" : "answers"}`}>
          {visibili.length ? (
            <div className="domande">
              {visibili.map((d) => (
                <details key={d.domanda} className="domanda">
                  <summary>
                    <span className="domanda__tema">{d.categoria}</span>
                    <span className="domanda__testo">{d.domanda}</span>
                    <ChevronDown size={17} aria-hidden="true" />
                  </summary>
                  <p>{d.risposta}</p>
                </details>
              ))}
            </div>
          ) : (
            <Vuoto icona={SearchX} titolo="No questions found" testo="Try other words, or send a request to the team." />
          )}
        </Riquadro>

        <div className="aiuto__lato">
          {puo("assistenza", "edit") ? (
            <Riquadro titolo="Ask the team" testo={staff ? "Team members and the store owner will see it." : "It goes to the Ishtar Lab team, who will reply here."}>
              <ModuloRichiesta />
            </Riquadro>
          ) : null}
          <RichiesteRecenti staff={staff} />
        </div>
      </div>
    </Pagina>
  )
}
