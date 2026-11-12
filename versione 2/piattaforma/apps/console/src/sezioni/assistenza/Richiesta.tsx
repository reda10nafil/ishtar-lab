import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { api } from "../../api/client"
import { Riquadro, useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { useSessione } from "../../sessione"
import { Campo, Conferma, dataOra, Etichetta, Pagina, Stato } from "../../ui"
import { CATEGORIE, statoRichiesta, type DettaglioRichiesta, type StatoRichiesta } from "./tipi"

const AGGIORNAMENTO_MS = 30_000

export default function Richiesta() {
  const { id } = useParams()
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [risposta, setRisposta] = useState("")
  const [elimina, setElimina] = useState(false)
  const staff = sessione?.tipo === "admin"
  const percorso = `/${staff ? "admin" : "vendor"}/assistenza/richieste/${id}`

  const query = useQuery({
    queryKey: ["assistenza", "richiesta", percorso],
    queryFn: () => api<{ richiesta: DettaglioRichiesta }>(percorso),
    refetchInterval: AGGIORNAMENTO_MS,
  })

  const aggiorna = () => {
    void client.invalidateQueries({ queryKey: ["assistenza"] })
    void client.invalidateQueries({ queryKey: ["avvisi"] })
  }
  const rispondi = useMutation({
    mutationFn: () => api(`${percorso}/messaggi`, { corpo: { testo: risposta } }),
    onSuccess: () => {
      setRisposta("")
      aggiorna()
    },
    onError: segnalaErrore,
  })
  const cambiaStato = useMutation({
    mutationFn: (stato: StatoRichiesta) => api(`${percorso}/stato`, { corpo: { stato } }),
    onSuccess: (_, stato) => {
      avvisa(stato === "chiusa" ? "Request closed" : "Request reopened")
      aggiorna()
    },
    onError: segnalaErrore,
  })
  const cancella = useMutation({
    mutationFn: () => api(percorso, { metodo: "DELETE" }),
    onSuccess: () => {
      avvisa("Request deleted")
      aggiorna()
      naviga("/assistenza/richieste")
    },
    onError: segnalaErrore,
  })

  const invia = (e: FormEvent) => {
    e.preventDefault()
    rispondi.mutate()
  }

  const richiesta = query.data?.richiesta
  const indietro = (
    <Link className="assistenza__indietro" to="/assistenza/richieste"><ArrowLeft size={16} aria-hidden="true" /> All requests</Link>
  )
  if (!richiesta) {
    return (
      <Pagina titolo="Help request" sottotitolo="The conversation with the team.">
        {indietro}
        <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      </Pagina>
    )
  }

  const { testo, tono } = statoRichiesta(richiesta.stato, staff)
  const chiusa = richiesta.stato === "chiusa"
  const puoScrivere = puo("assistenza", "edit")

  return (
    <Pagina titolo="Help request" sottotitolo="The conversation with the team.">
      <div className="fedele">
      {indietro}
      <Riquadro
        titolo={richiesta.oggetto}
        testo={[richiesta.codice, CATEGORIE[richiesta.categoria] ?? "Something else", staff ? richiesta.azienda ?? "Internal" : null, `opened ${dataOra(richiesta.aperta_il)}`].filter(Boolean).join(" · ")}
        azioni={<Etichetta tono={tono}>{testo}</Etichetta>}
      >
        <ol className="dialogo">
          {richiesta.messaggi.map((m) => (
            <li key={m.id} className={m.da_staff === staff ? "dialogo__voce dialogo__voce--mia" : "dialogo__voce"}>
              <header>
                <strong>{m.autore}</strong>
                <time dateTime={m.quando}>{dataOra(m.quando)}</time>
              </header>
              <p>{m.testo}</p>
            </li>
          ))}
        </ol>

        {chiusa ? <p className="avviso-stato">This request is closed. Reopen it to write again.</p> : null}
        {!chiusa && puoScrivere ? (
          <form className="modulo" onSubmit={invia}>
            <Campo etichetta="Your reply">
              <textarea required rows={4} maxLength={5000} value={risposta} onChange={(e) => setRisposta(e.target.value)} />
            </Campo>
            <div className="riga__azioni">
              <button type="submit" className="primario" disabled={rispondi.isPending}>{rispondi.isPending ? "Sending..." : "Send reply"}</button>
            </div>
          </form>
        ) : null}

        {puoScrivere ? (
          <div className="riga__azioni">
            <button type="button" disabled={cambiaStato.isPending} onClick={() => cambiaStato.mutate(chiusa ? "aperta" : "chiusa")}>
              {chiusa ? "Reopen request" : "Close request"}
            </button>
            {staff && puo("assistenza", "manage") ? <button type="button" className="pericolo" onClick={() => setElimina(true)}>Delete</button> : null}
          </div>
        ) : null}
      </Riquadro>

      {elimina ? (
        <Conferma
          titolo="Delete this request"
          testo="The request and its messages will be removed for everyone."
          azione="Delete"
          attesa={cancella.isPending}
          onConferma={() => cancella.mutate()}
          onChiudi={() => setElimina(false)}
        />
      ) : null}
      </div>
    </Pagina>
  )
}
