import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BadgePercent, CopyPlus, Plus, Trash2 } from "lucide-react"
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Interruttore, Paginazione, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Conferma, Etichetta, Stato, dataBreve } from "../../ui"
import { ChipCodice } from "./CopiaCodice"
import { Guscio } from "./Guscio"
import { ModuloCodice } from "./ModuloCodice"
import { STATI_CODICE, conteggioDi, giorniRimasti, valoreSconto } from "./testi"
import type { Codice, ElencoCodici, StatoSconto } from "./tipi"
import { useRitardato } from "./useRitardato"

const PER_PAGINA = 20
const AVVISO_GIORNI = 14

const FILTRI: { id: "" | StatoSconto; testo: string }[] = [
  { id: "", testo: "All" },
  { id: "attivo", testo: "Live" },
  { id: "programmato", testo: "Scheduled" },
  { id: "in_pausa", testo: "Paused" },
  { id: "terminato", testo: "Ended" },
]

/** I comandi dentro una riga non devono aprire anche la riga. */
function Isolati({ children }: { children: ReactNode }) {
  const ferma = (e: MouseEvent | KeyboardEvent) => e.stopPropagation()
  return <div className="sc-comandi" onClick={ferma} onKeyDown={ferma}>{children}</div>
}

function Usi({ codice }: { codice: Codice }) {
  const { usi, limite_usi: limite } = codice
  return (
    <div className="sc-uso">
      <strong>{numero(usi)}{limite ? ` / ${numero(limite)}` : ""}</strong>
      {limite ? <span className="sc-barra-uso"><i style={{ width: `${Math.min(100, (usi / limite) * 100)}%` }} /></span> : null}
    </div>
  )
}

function Fine({ codice }: { codice: Codice }) {
  const { stato, inizio, fine } = codice
  const giorni = fine ? giorniRimasti(fine) : null
  const data = fine ? dataBreve(fine) : "No end date"
  if (stato === "terminato" || stato === "in_pausa") {
    return <div className="sc-fine"><span>{data}</span><Etichetta tono={STATI_CODICE[stato].tono}>{STATI_CODICE[stato].testo}</Etichetta></div>
  }
  if (stato === "programmato") return <div className="sc-fine"><span>{data}</span><Etichetta tono="attesa">Starts {dataBreve(inizio as string)}</Etichetta></div>
  if (giorni !== null && giorni <= AVVISO_GIORNI) return <Etichetta tono="attesa">{conteggioDi(giorni, "day")} left</Etichetta>
  return <span>{data}</span>
}

export default function Codici() {
  const client = useQueryClient()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [parametri, setParametri] = useSearchParams()
  const [testo, setTesto] = useState("")
  const ricerca = useRitardato(testo)
  const [stato, setStato] = useState<"" | StatoSconto>("")
  const [tipo, setTipo] = useState("")
  const [pagina, setPagina] = useState(1)
  const [aperto, setAperto] = useState<Codice | null>(null)
  const [daEliminare, setDaEliminare] = useState<Codice | null>(null)
  const scrive = puo("sconti", "edit")
  const elimina = puo("sconti", "manage")
  const nuovo = parametri.get("nuovo") === "1" && scrive

  const filtri = new URLSearchParams({ limit: String(PER_PAGINA), offset: String((pagina - 1) * PER_PAGINA) })
  if (ricerca) filtri.set("q", ricerca)
  if (stato) filtri.set("stato", stato)
  if (tipo) filtri.set("tipo", tipo)

  const query = useQuery({
    queryKey: ["sconti", "codici", filtri.toString()],
    queryFn: () => api<ElencoCodici>(`/admin/sconti/codici?${filtri.toString()}`),
    placeholderData: keepPreviousData,
  })
  const codici = query.data?.codici ?? []
  const conteggi = query.data?.conteggi
  const aggiorna = () => client.invalidateQueries({ queryKey: ["sconti"] })

  const cambia = useMutation({
    mutationFn: ({ id, attivo }: { id: string; attivo: boolean }) => api(`/admin/sconti/codici/${id}/stato`, { corpo: { attivo } }),
    onSuccess: (_, { attivo }) => {
      void aggiorna()
      avvisa(attivo ? "Discount resumed" : "Discount paused")
    },
    onError: segnalaErrore,
  })
  const duplica = useMutation({
    mutationFn: (id: string) => api<{ codice: Codice }>(`/admin/sconti/codici/${id}/duplica`, { corpo: {} }),
    onSuccess: ({ codice }) => {
      void aggiorna()
      avvisa(`Copy created and paused: ${codice.codice}`)
    },
    onError: segnalaErrore,
  })
  const rimuovi = useMutation({
    mutationFn: (id: string) => api(`/admin/sconti/codici/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiorna()
      avvisa("Discount deleted")
      setDaEliminare(null)
    },
    onError: (errore) => {
      segnalaErrore(errore)
      setDaEliminare(null)
    },
  })

  const colonne: Colonna<Codice>[] = [
    {
      titolo: "Code",
      cella: (c) => (
        <div className="sc-cella-codice">
          <ChipCodice codice={c.codice} />
          <small>{c.azienda ? `Proposed by ${c.azienda}` : c.descrizione ?? ""}</small>
        </div>
      ),
    },
    { titolo: "Offer", cella: (c) => <strong className="sc-offerta">{valoreSconto(c.tipo, c.valore)}</strong> },
    { titolo: "Used", cella: (c) => <Usi codice={c} /> },
    { titolo: "Ends", cella: (c) => <Fine codice={c} /> },
    {
      titolo: "Live",
      destra: true,
      cella: (c) => (
        <Isolati>
          <Interruttore
            acceso={c.stato === "attivo" || c.stato === "programmato"}
            etichetta={`Pause or resume ${c.codice}`}
            disattivo={!scrive || c.stato === "terminato" || cambia.isPending}
            onCambia={(attivo) => cambia.mutate({ id: c.id, attivo })}
          />
        </Isolati>
      ),
    },
    {
      titolo: "",
      destra: true,
      cella: (c) => (
        <Isolati>
          {scrive ? (
            <button type="button" className="icona-pulsante" aria-label={`Duplicate ${c.codice}`} title="Duplicate" disabled={duplica.isPending} onClick={() => duplica.mutate(c.id)}>
              <CopyPlus size={16} aria-hidden="true" />
            </button>
          ) : null}
          {elimina ? (
            <button type="button" className="icona-pulsante pericolo" aria-label={`Delete ${c.codice}`} title="Delete" onClick={() => setDaEliminare(c)}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          ) : null}
        </Isolati>
      ),
    },
  ]

  const senzaFiltri = !ricerca && !stato && !tipo
  const chiudiNuovo = () => {
    parametri.delete("nuovo")
    setParametri(parametri, { replace: true })
  }
  const creaAzione = <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}><Plus size={17} aria-hidden="true" /> New code</button>
  const frase = conteggi && !ricerca && !tipo ? `${conteggioDi(conteggi.attivo, "code")} running right now.` : "Codes your customers enter at checkout."

  return (
    <Guscio sottotitolo={frase} azioni={scrive ? creaAzione : undefined}>
      <section className="sc-blocco vetro" aria-label="Discount codes">
        <div className="sc-blocco__barra">
          <CampoRicerca valore={testo} etichetta="Search codes" onCambia={(valore) => { setTesto(valore); setPagina(1) }} />
          <select className="scelta-ruolo sc-scelta" aria-label="Filter by type" value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(1) }}>
            <option value="">All types</option>
            <option value="percentuale">Percentage off</option>
            <option value="importo">Fixed amount off</option>
            <option value="spedizione">Free shipping</option>
          </select>
          <span className="spazio" />
          <div className="selettore" role="group" aria-label="Filter by status">
            {FILTRI.map((f) => (
              <button key={f.id} type="button" className={stato === f.id ? "attivo" : undefined} aria-pressed={stato === f.id} onClick={() => { setStato(f.id); setPagina(1) }}>
                {f.testo}{conteggi ? <em>{numero(f.id ? conteggi[f.id] : conteggi.tutti)}</em> : null}
              </button>
            ))}
          </div>
        </div>

        <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
        {query.isSuccess && !codici.length ? (
          senzaFiltri ? (
            <Vuoto icona={BadgePercent} titolo="No discounts yet" testo="Create your first code: a percentage, a fixed amount or free shipping." azione={scrive ? creaAzione : undefined} />
          ) : (
            <Vuoto icona={BadgePercent} titolo="No discounts match these filters" testo="Change your search or pick another status." />
          )
        ) : null}
        {codici.length ? <Tabella etichetta="Discount codes" colonne={colonne} righe={codici} chiave={(c) => c.id} onApri={scrive ? setAperto : undefined} /> : null}
        <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={query.data?.conteggio ?? 0} onCambia={setPagina} />
      </section>

      {nuovo ? <ModuloCodice onChiudi={chiudiNuovo} /> : null}
      {aperto ? <ModuloCodice codice={aperto} onChiudi={() => setAperto(null)} /> : null}
      {daEliminare ? (
        <Conferma
          titolo={`Delete ${daEliminare.codice}?`}
          testo={daEliminare.usi ? `It has been used ${daEliminare.usi} times: past orders stay as they are, but the code stops working.` : "The code stops working straight away."}
          azione="Delete discount"
          attesa={rimuovi.isPending}
          onConferma={() => rimuovi.mutate(daEliminare.id)}
          onChiudi={() => setDaEliminare(null)}
        />
      ) : null}
    </Guscio>
  )
}
