import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BadgePercent, Plus } from "lucide-react"
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Interruttore, Paginazione, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { fa, numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Conferma, Stato, dataBreve } from "../../ui"
import { ChipCodice } from "./CopiaCodice"
import { Guscio } from "./Guscio"
import { ModuloCodice } from "./ModuloCodice"
import { ricomponiBlocco, riempiBarre } from "./movimenti"
import { conteggioDi, giorniRimasti, giornoMese, valoreSconto } from "./testi"
import type { Codice, ElencoCodici } from "./tipi"
import { useRitardato } from "./useRitardato"

const PER_PAGINA = 20
const AVVISO_GIORNI = 14
const SOGLIA_QUASI_FINITO = 0.8

type Gruppo = "vivi" | "fermi" | ""

const FILTRI: { id: Gruppo; testo: string }[] = [
  { id: "vivi", testo: "Live" },
  { id: "fermi", testo: "Paused & ended" },
  { id: "", testo: "All" },
]

/** I comandi dentro una riga non devono aprire anche la riga. */
function Isolati({ children }: { children: ReactNode }) {
  const ferma = (e: MouseEvent | KeyboardEvent) => e.stopPropagation()
  return <div className="sc-comandi" onClick={ferma} onKeyDown={ferma}>{children}</div>
}

function Usi({ codice }: { codice: Codice }) {
  const { usi, limite_usi: limite } = codice
  const quota = limite ? usi / limite : 0
  return (
    <div className="sc-uso">
      <strong>{numero(usi)}{limite ? ` / ${numero(limite)}` : ""}</strong>
      {limite ? <span className="sc-barra-uso"><i className={quota >= SOGLIA_QUASI_FINITO ? "sc-barra-uso--piena" : undefined} style={{ width: `${Math.min(100, quota * 100)}%` }} /></span> : null}
    </div>
  )
}

function Fine({ codice }: { codice: Codice }) {
  const { stato, inizio, fine } = codice
  if (stato === "terminato") return <span className="sc-pillola">{fine ? `Ended ${giornoMese(fine)}` : "Used up"}</span>
  if (stato === "programmato") return <span className="sc-pillola sc-pillola--attesa">Starts {giornoMese(inizio as string)}</span>
  if (!fine) return <span className="sc-tenue">No end date</span>
  const giorni = giorniRimasti(fine)
  if (giorni <= AVVISO_GIORNI) return <span className="sc-pillola sc-pillola--attesa">{conteggioDi(giorni, "day")} left</span>
  return <span className="sc-tenue">{dataBreve(fine)}</span>
}

export default function Codici() {
  const client = useQueryClient()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [parametri, setParametri] = useSearchParams()
  const [testo, setTesto] = useState("")
  const ricerca = useRitardato(testo)
  const [gruppo, setGruppo] = useState<Gruppo>("vivi")
  const [pagina, setPagina] = useState(1)
  const [aperto, setAperto] = useState<Codice | null>(null)
  const [daEliminare, setDaEliminare] = useState<Codice | null>(null)
  const blocco = useRef<HTMLElement>(null)
  const primoFiltro = useRef(true)
  const scrive = puo("sconti", "edit")
  const nuovo = parametri.get("nuovo") === "1" && scrive

  const filtri = new URLSearchParams({ limit: String(PER_PAGINA), offset: String((pagina - 1) * PER_PAGINA) })
  if (ricerca) filtri.set("q", ricerca)
  if (gruppo) filtri.set("stato", gruppo)

  const query = useQuery({
    queryKey: ["sconti", "codici", filtri.toString()],
    queryFn: () => api<ElencoCodici>(`/admin/sconti/codici?${filtri.toString()}`),
    placeholderData: keepPreviousData,
  })
  const codici = query.data?.codici ?? []
  const conteggi = query.data?.conteggi
  const aggiorna = () => client.invalidateQueries({ queryKey: ["sconti"] })

  // Alla scelta di un filtro il blocco si ricompone; le righe rientrano da sole con `Tabella`.
  useEffect(() => {
    if (primoFiltro.current) primoFiltro.current = false
    else if (blocco.current) ricomponiBlocco(blocco.current)
  }, [gruppo])
  const pronti = query.isSuccess && !query.isPlaceholderData
  useEffect(() => {
    if (pronti && blocco.current) riempiBarre(blocco.current.querySelectorAll(".sc-barra-uso i"), 260)
  }, [gruppo, pronti])

  const cambia = useMutation({
    mutationFn: ({ c, attivo }: { c: Codice; attivo: boolean }) => api(`/admin/sconti/codici/${c.id}/stato`, { corpo: { attivo } }),
    onSuccess: (_, { c, attivo }) => {
      void aggiorna()
      avvisa(`${c.codice} ${attivo ? "is live" : "paused"}`)
    },
    onError: segnalaErrore,
  })
  const duplica = useMutation({
    mutationFn: (id: string) => api<{ codice: Codice }>(`/admin/sconti/codici/${id}/duplica`, { corpo: {} }),
    onSuccess: ({ codice }) => {
      void aggiorna()
      avvisa(`${codice.codice} created and paused`)
      setAperto(null)
    },
    onError: segnalaErrore,
  })
  const rimuovi = useMutation({
    mutationFn: (id: string) => api(`/admin/sconti/codici/${id}`, { metodo: "DELETE" }),
    onSuccess: (_, id) => {
      void aggiorna()
      avvisa(`${codici.find((c) => c.id === id)?.codice ?? "Discount"} deleted`)
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
          <small>{c.azienda ? `Proposed by ${c.azienda}` : c.descrizione ?? `Created ${fa(c.creato_il)}`}</small>
        </div>
      ),
    },
    { titolo: "Offer", cella: (c) => <strong className="sc-forte">{valoreSconto(c.tipo, c.valore)}</strong> },
    { titolo: "Used", cella: (c) => <Usi codice={c} /> },
    { titolo: "Ends", cella: (c) => <Fine codice={c} /> },
    {
      titolo: "Live",
      destra: true,
      cella: (c) => (
        <Isolati>
          <Interruttore
            acceso={c.stato === "attivo" || c.stato === "programmato"}
            etichetta={`${c.codice} live`}
            disattivo={!scrive || cambia.isPending}
            onCambia={(attivo) => (c.stato === "terminato" ? avvisa("That code has ended: make a new one") : cambia.mutate({ c, attivo }))}
          />
        </Isolati>
      ),
    },
  ]

  const senzaFiltri = !ricerca && gruppo === ""
  const chiudiNuovo = () => {
    parametri.delete("nuovo")
    setParametri(parametri, { replace: true })
  }
  const creaAzione = <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}><Plus size={17} aria-hidden="true" /> New code</button>
  const vivi = conteggi ? conteggi.attivo + conteggi.programmato : 0
  const frase = conteggi && !ricerca ? `${conteggioDi(vivi, "code")} ready to use right now.` : "Codes your customers enter at checkout."

  return (
    <Guscio sottotitolo={frase} azioni={scrive ? creaAzione : undefined}>
      <section className="sc-blocco vetro" aria-label="Discount codes" ref={blocco}>
        <div className="sc-blocco__barra">
          <CampoRicerca valore={testo} etichetta="Search codes" onCambia={(valore) => { setTesto(valore); setPagina(1) }} />
          <span className="spazio" />
          <div className="selettore" role="group" aria-label="Filter by status">
            {FILTRI.map((f) => (
              <button key={f.id} type="button" className={gruppo === f.id ? "attivo" : undefined} aria-pressed={gruppo === f.id} onClick={() => { setGruppo(f.id); setPagina(1) }}>{f.testo}</button>
            ))}
          </div>
        </div>

        <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
        {query.isSuccess && !codici.length ? (
          senzaFiltri ? (
            <Vuoto icona={BadgePercent} titolo="No codes here" testo="Add one for a new drop, a stockist or a loyal customer." azione={scrive ? creaAzione : undefined} />
          ) : (
            <Vuoto icona={BadgePercent} titolo="No codes here" testo="Add one for a new drop, a stockist or a loyal customer." azione={scrive ? creaAzione : undefined} />
          )
        ) : null}
        {codici.length ? <Tabella etichetta="Discount codes" colonne={colonne} righe={codici} chiave={(c) => c.id} onApri={scrive ? setAperto : undefined} /> : null}
        <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={query.data?.conteggio ?? 0} onCambia={setPagina} />
      </section>

      {nuovo ? <ModuloCodice onChiudi={chiudiNuovo} /> : null}
      {aperto ? (
        <ModuloCodice
          codice={aperto}
          onChiudi={() => setAperto(null)}
          onDuplica={(c) => duplica.mutate(c.id)}
          onElimina={(c) => {
            setAperto(null)
            setDaEliminare(c)
          }}
        />
      ) : null}
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
