import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ClipboardList } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { Vuoto, useAvvisi } from "../../componenti"
import { entraRighe } from "../../movimenti"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Etichetta, Modale, Stato, dataBreve } from "../../ui"
import { Guscio } from "./Guscio"
import { STATI_PROPOSTA, STATI_SCONTO_NATO, periodo, valoreSconto } from "./testi"
import type { ElencoProposte, Proposta, StatoProposta } from "./tipi"

const FILTRI: { id: "" | StatoProposta; testo: string }[] = [
  { id: "in_attesa", testo: "Pending" },
  { id: "approvata", testo: "Approved" },
  { id: "rifiutata", testo: "Rejected" },
  { id: "", testo: "All" },
]

type Decisione = { proposta: Proposta; azione: "approva" | "rifiuta" }

function ModaleDecisione({ proposta, azione, onChiudi }: Decisione & { onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const [nota, setNota] = useState("")
  const [codice, setCodice] = useState("")
  const approva = azione === "approva"

  const decidi = useMutation({
    mutationFn: () => api(`/admin/sconti/proposte/${proposta.id}/${azione}`, { corpo: approva ? { nota, codice } : { nota } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["sconti"] })
      avvisa(approva ? "Proposal approved: the discount has been created" : "Proposal rejected")
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    decidi.mutate()
  }

  return (
    <Modale
      titolo={approva ? "Approve proposal" : "Reject proposal"}
      sottotitolo={`${proposta.titolo}: ${valoreSconto(proposta.tipo, proposta.valore)}, ${periodo(proposta.inizio, proposta.fine)}.`}
      onChiudi={onChiudi}
    >
      <form className="modulo sc-modulo" onSubmit={invia}>
        {approva ? (
          <>
            <p className="avviso-stato">
              The discount is created now and goes live on its start date.
              {proposta.prodotti.length ? ` It covers ${proposta.prodotti.length} chosen products.` : " It covers every product the company has today."}
            </p>
            <Campo etichetta="Code (optional)" aiuto="Leave it empty to generate one from the title.">
              <input value={codice} maxLength={40} onChange={(e) => setCodice(e.target.value.toUpperCase())} />
            </Campo>
          </>
        ) : null}
        <Campo etichetta={approva ? "Note for the company (optional)" : "Reason for rejecting"} aiuto={approva ? undefined : "The company reads this in its portal."}>
          <textarea rows={3} required={!approva} minLength={approva ? undefined : 3} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        {decidi.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{decidi.error.message}</p> : null}
        <div className="sc-piede">
          <span className="spazio" />
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button type="submit" className="primario" disabled={decidi.isPending}>{approva ? "Approve and create discount" : "Confirm rejection"}</button>
        </div>
      </form>
    </Modale>
  )
}

export default function Proposte() {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const [stato, setStato] = useState<"" | StatoProposta>("in_attesa")
  const [decisione, setDecisione] = useState<Decisione | null>(null)
  const [daEliminare, setDaEliminare] = useState<Proposta | null>(null)
  const elenco = useRef<HTMLUListElement>(null)
  const decide = puo("sconti", "manage")

  const query = useQuery({
    queryKey: ["sconti", "proposte", stato],
    queryFn: () => api<ElencoProposte>(`/admin/sconti/proposte${stato ? `?stato=${stato}` : ""}`),
  })
  const proposte = query.data?.proposte ?? []

  // Le proposte rientrano quando l'utente cambia filtro.
  useEffect(() => {
    if (elenco.current && query.isSuccess) entraRighe(elenco.current)
  }, [stato, query.isSuccess])

  const elimina = useMutation({
    mutationFn: (id: string) => api(`/admin/sconti/proposte/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["sconti"] })
      avvisa("Proposal deleted")
      setDaEliminare(null)
    },
    onError: (errore) => {
      segnalaErrore(errore)
      setDaEliminare(null)
    },
  })

  return (
    <Guscio sottotitolo="Offers your companies would like to run: nothing goes live without your approval.">
      <div className="sc-barra">
        <div className="selettore sc-selettore" role="group" aria-label="Filter by status">
          {FILTRI.map((f) => (
            <button key={f.id} type="button" className={stato === f.id ? "attivo" : undefined} aria-pressed={stato === f.id} onClick={() => setStato(f.id)}>{f.testo}</button>
          ))}
        </div>
      </div>

      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !proposte.length ? (
        <Vuoto
          icona={ClipboardList}
          titolo={stato === "in_attesa" ? "Nothing waiting for a decision" : "No proposals here"}
          testo="Companies send proposals from their portal, with dates and a reason."
        />
      ) : null}

      <ul className="elenco" ref={elenco}>
        {proposte.map((p) => {
          const etichetta = STATI_PROPOSTA[p.stato]
          return (
            <li key={p.id} className="vetro sc-proposta">
              <div className="sc-proposta__testa">
                <div>
                  <strong>{p.titolo}</strong>
                  <small>{p.azienda} · proposed {dataBreve(p.creata_il)}</small>
                </div>
                <Etichetta tono={etichetta.tono}>{etichetta.testo}</Etichetta>
              </div>
              <dl className="sc-dati">
                <div><dt>Offer</dt><dd>{valoreSconto(p.tipo, p.valore)}</dd></div>
                <div><dt>Dates</dt><dd>{periodo(p.inizio, p.fine)}</dd></div>
                <div><dt>Products</dt><dd>{p.prodotti.length ? p.prodotti.join(", ") : "All the company's products"}</dd></div>
                {p.codice ? <div><dt>Code</dt><dd><span className="sc-codice">{p.codice}</span></dd></div> : null}
              </dl>
              <p className="sc-nota"><b>Reason:</b> {p.motivo}</p>
              {p.nota ? <p className="sc-nota"><b>Note for the company:</b> {p.nota}</p> : null}
              {p.stato_sconto ? <p className="sc-nota"><b>Discount:</b> {STATI_SCONTO_NATO[p.stato_sconto]}</p> : null}
              {decide && p.stato === "in_attesa" ? (
                <div className="riga__azioni">
                  <button type="button" className="primario" onClick={() => setDecisione({ proposta: p, azione: "approva" })}>Approve</button>
                  <button type="button" onClick={() => setDecisione({ proposta: p, azione: "rifiuta" })}>Reject</button>
                </div>
              ) : null}
              {decide && (p.stato === "rifiutata" || p.stato_sconto === "eliminato") ? (
                <div className="riga__azioni">
                  <button type="button" className="pericolo" onClick={() => setDaEliminare(p)}>Delete</button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {decisione ? <ModaleDecisione {...decisione} onChiudi={() => setDecisione(null)} /> : null}
      {daEliminare ? (
        <Conferma titolo="Delete this proposal?" testo="The company will no longer see it." azione="Delete" attesa={elimina.isPending} onConferma={() => elimina.mutate(daEliminare.id)} onChiudi={() => setDaEliminare(null)} />
      ) : null}
    </Guscio>
  )
}
