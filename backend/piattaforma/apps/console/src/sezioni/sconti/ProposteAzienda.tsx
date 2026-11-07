import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BadgePercent, Plus } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { Vuoto, useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Etichetta, Modale, Pagina, Stato, dataBreve } from "../../ui"
import { STATI_PROPOSTA, STATI_SCONTO_NATO, fineGiorno, inizioGiorno, numeroDa, periodo, valoreSconto } from "./testi"
import type { ElencoProposte, Proposta } from "./tipi"

type Prodotto = { id: string; titolo: string }

function NuovaProposta({ onChiudi }: { onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const [dati, setDati] = useState({ titolo: "", tipo: "percentuale" as Proposta["tipo"], valore: "", inizio: "", fine: "", motivo: "" })
  const [tutti, setTutti] = useState(true)
  const [scelti, setScelti] = useState<string[]>([])
  const aggiorna = (chiave: "titolo" | "valore" | "inizio" | "fine" | "motivo") => (e: { target: { value: string } }) => setDati({ ...dati, [chiave]: e.target.value })

  // Solo i prodotti legati all'azienda e solo i titoli: il portale non riceve mai i prezzi di vendita.
  const prodotti = useQuery({
    queryKey: ["sconti", "miei-prodotti"],
    queryFn: () => api<{ prodotti: Prodotto[] }>("/vendor/sconti/prodotti"),
  })

  const proponi = useMutation({
    mutationFn: () =>
      api("/vendor/sconti/proposte", {
        corpo: {
          titolo: dati.titolo,
          tipo: dati.tipo,
          valore: numeroDa(dati.valore),
          inizio: inizioGiorno(dati.inizio),
          fine: fineGiorno(dati.fine),
          motivo: dati.motivo,
          prodotti: tutti ? null : scelti,
        },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["sconti"] })
      avvisa("Proposal sent to the administrator")
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    proponi.mutate()
  }
  const alterna = (id: string) => setScelti(scelti.includes(id) ? scelti.filter((v) => v !== id) : [...scelti, id])

  return (
    <Modale titolo="Propose a discount" sottotitolo="The administrator reviews it: it only starts once approved." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Title"><input required minLength={3} maxLength={80} value={dati.titolo} onChange={aggiorna("titolo")} /></Campo>
        <div className="griglia-due sc-griglia">
          <Campo etichetta="Type">
            <select value={dati.tipo} onChange={(e) => setDati({ ...dati, tipo: e.target.value as Proposta["tipo"] })}>
              <option value="percentuale">Percentage off</option>
              <option value="importo">Fixed amount off</option>
            </select>
          </Campo>
          <Campo etichetta={dati.tipo === "importo" ? "Amount" : "Percent"}>
            <input type="number" required inputMode="decimal" min="0.01" max={dati.tipo === "percentuale" ? 100 : undefined} step="0.01" value={dati.valore} onChange={aggiorna("valore")} />
          </Campo>
        </div>
        <div className="griglia-due sc-griglia">
          <Campo etichetta="From"><input type="date" required value={dati.inizio} onChange={aggiorna("inizio")} /></Campo>
          <Campo etichetta="To"><input type="date" required value={dati.fine} onChange={aggiorna("fine")} /></Campo>
        </div>
        <Campo etichetta="Reason" aiuto="Why you're proposing it: end of season, new collection, high stock.">
          <textarea rows={3} required minLength={5} maxLength={500} value={dati.motivo} onChange={aggiorna("motivo")} />
        </Campo>
        <div className="campo">
          <span id="sc-prodotti">Products</span>
          <div className="selettore sc-selettore" role="group" aria-labelledby="sc-prodotti">
            <button type="button" className={tutti ? "attivo" : undefined} aria-pressed={tutti} onClick={() => setTutti(true)}>All my products</button>
            <button type="button" className={tutti ? undefined : "attivo"} aria-pressed={!tutti} onClick={() => setTutti(false)}>Choose</button>
          </div>
        </div>
        {tutti ? null : (
          <>
            <Stato caricamento={prodotti.isLoading} errore={prodotti.error} vuoto={prodotti.isSuccess && !prodotti.data.prodotti.length} testoVuoto="You don't have any products yet." />
            <ul className="sc-spunte">
              {prodotti.data?.prodotti.map((p) => (
                <li key={p.id}>
                  <label><input type="checkbox" checked={scelti.includes(p.id)} onChange={() => alterna(p.id)} /> {p.titolo}</label>
                </li>
              ))}
            </ul>
          </>
        )}
        {proponi.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{proponi.error.message}</p> : null}
        <div className="riga__azioni sc-piede">
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={proponi.isPending || (!tutti && !scelti.length)}>{proponi.isPending ? "Sending..." : "Send proposal"}</button>
        </div>
      </form>
    </Modale>
  )
}

/** Il portale dell'azienda: solo le sue proposte e il loro stato, nessun altro sconto. */
export default function ProposteAzienda() {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const [parametri, setParametri] = useSearchParams()
  const [daRitirare, setDaRitirare] = useState<Proposta | null>(null)
  const propone = puo("sconti", "edit")
  const nuova = parametri.get("nuovo") === "1" && propone

  const query = useQuery({ queryKey: ["sconti", "mie-proposte"], queryFn: () => api<ElencoProposte>("/vendor/sconti/proposte") })
  const proposte = query.data?.proposte ?? []

  const ritira = useMutation({
    mutationFn: (id: string) => api(`/vendor/sconti/proposte/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["sconti"] })
      avvisa("Proposal withdrawn")
      setDaRitirare(null)
    },
    onError: (errore) => {
      segnalaErrore(errore)
      setDaRitirare(null)
    },
  })

  const chiudiNuova = () => {
    parametri.delete("nuovo")
    setParametri(parametri, { replace: true })
  }
  const creaAzione = <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}><Plus size={17} aria-hidden="true" /> Propose a discount</button>

  return (
    <Pagina titolo="Discounts" sottotitolo="Your proposals: they go live only once the administrator approves them." azioni={propone ? creaAzione : undefined}>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !proposte.length ? (
        <Vuoto icona={BadgePercent} titolo="No proposals yet" testo="Propose a discount with dates and a reason: the administrator approves it or replies with a note." azione={propone ? creaAzione : undefined} />
      ) : null}
      <ul className="elenco">
        {proposte.map((p) => {
          const etichetta = STATI_PROPOSTA[p.stato]
          return (
            <li key={p.id} className="vetro sc-proposta">
              <div className="sc-proposta__testa">
                <div>
                  <strong>{p.titolo}</strong>
                  <small>Proposed {dataBreve(p.creata_il)}</small>
                </div>
                <Etichetta tono={etichetta.tono}>{etichetta.testo}</Etichetta>
              </div>
              <dl className="sc-dati">
                <div><dt>Offer</dt><dd>{valoreSconto(p.tipo, p.valore)}</dd></div>
                <div><dt>Dates</dt><dd>{periodo(p.inizio, p.fine)}</dd></div>
                <div><dt>Products</dt><dd>{p.prodotti.length ? p.prodotti.join(", ") : "All my products"}</dd></div>
                {p.codice ? <div><dt>Code</dt><dd><span className="sc-codice">{p.codice}</span></dd></div> : null}
              </dl>
              {p.nota ? <p className="sc-nota"><b>Note from the administrator:</b> {p.nota}</p> : null}
              {p.stato_sconto ? <p className="sc-nota"><b>Discount:</b> {STATI_SCONTO_NATO[p.stato_sconto]}</p> : null}
              {propone && p.stato === "in_attesa" ? (
                <div className="riga__azioni">
                  <button type="button" onClick={() => setDaRitirare(p)}>Withdraw proposal</button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      {nuova ? <NuovaProposta onChiudi={chiudiNuova} /> : null}
      {daRitirare ? (
        <Conferma titolo="Withdraw this proposal?" testo="The administrator will no longer see it." azione="Withdraw" attesa={ritira.isPending} onConferma={() => ritira.mutate(daRitirare.id)} onChiudi={() => setDaRitirare(null)} />
      ) : null}
    </Pagina>
  )
}
