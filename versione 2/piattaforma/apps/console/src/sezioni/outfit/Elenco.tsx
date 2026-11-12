import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LayoutGrid, List, Plus, Shirt } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, Tabella, useAvvisi, Vuoto, type Colonna } from "../../componenti"
import { numero } from "../../lingua"
import { anima } from "../../movimenti"
import { usePermessi } from "../../permessi"
import { Campo, euro, Modale, Pagina } from "../../ui"
import { chiaveCapo, ChipDisponibilita, EtichettaStato, FotoComposta, GrigliaAttesa, Segmenti, useRitardato } from "./comuni"
import type { Outfit, OutfitSintesi, RispostaElenco, StatoOutfit } from "./tipi"

const PER_PAGINA = 24

const FILTRI_DISPONIBILITA = [
  { id: "", testo: "Any stock" },
  { id: "acquistabili", testo: "Buyable" },
  { id: "non_acquistabili", testo: "Not buyable" },
]

const VISTE = [
  { id: "griglia", testo: "Tiles", icona: LayoutGrid },
  { id: "elenco", testo: "List", icona: List },
] as const

const SEGMENTI_STATO: { id: StatoOutfit; testo: string; nome: string }[] = [
  { id: "pubblicato", testo: "Published", nome: "published" },
  { id: "bozza", testo: "Drafts", nome: "draft" },
  { id: "archiviato", testo: "Archived", nome: "archived" },
]

/** Rientro delle carte dopo un filtro, campionato sul pannello: salita, piccolo superamento e assestamento. */
const RIENTRO: Keyframe[] = [
  { offset: 0, opacity: 0, transform: "translateY(42px) scale(1.002)" },
  { offset: 0.2, opacity: 0.69, transform: "translateY(13px) scale(1.001)" },
  { offset: 0.36, opacity: 0.95, transform: "translateY(2px)" },
  { offset: 0.47, opacity: 1, transform: "translateY(-2.1px) scale(1.004)" },
  { offset: 0.6, opacity: 1, transform: "translateY(-3.6px) scale(1.0075)" },
  { offset: 0.72, opacity: 1, transform: "translateY(-2.7px) scale(1.006)" },
  { offset: 0.88, opacity: 1, transform: "translateY(-0.6px) scale(1.002)" },
  { offset: 1, opacity: 1, transform: "none" },
]

const prezzoOutfit = (outfit: OutfitSintesi) =>
  outfit.prezzo.finale === null ? "Price to be set" : `${outfit.prezzo.varia_con_taglia ? "from " : ""}${euro(outfit.prezzo.finale)}`

const numeroCapi = (outfit: OutfitSintesi) => (outfit.capi.length === 1 ? "1 piece" : `${numero(outfit.capi.length)} pieces`)

const nomiAziende = (outfit: OutfitSintesi) => [...new Set(outfit.capi.map((c) => c.azienda_nome))].join(", ")

const fotoDi = (outfit: OutfitSintesi) => <FotoComposta nome={outfit.nome} pezzi={outfit.capi.map((c) => ({ ...c, chiave: chiaveCapo(c) }))} />

const COLONNE: Colonna<OutfitSintesi>[] = [
  {
    titolo: "Outfit",
    cella: (o) => (
      <span className="outfit-tabella__capo">
        {fotoDi(o)}
        <span>
          <strong>{o.nome}</strong>
          <small>{numeroCapi(o)}</small>
        </span>
      </span>
    ),
  },
  { titolo: "Companies", cella: nomiAziende },
  { titolo: "Status", cella: (o) => <EtichettaStato stato={o.stato} /> },
  { titolo: "Availability", cella: (o) => <ChipDisponibilita acquistabile={o.disponibilita.acquistabile} /> },
  { titolo: "Price", cella: prezzoOutfit, destra: true },
]

function NuovoOutfit({ onChiudi }: { onChiudi: () => void }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const [nome, setNome] = useState("")
  const [note, setNote] = useState("")
  const [senzaNome, setSenzaNome] = useState(false)
  const crea = useMutation({
    mutationFn: () => api<{ outfit: Outfit }>("/admin/outfit", { corpo: { nome: nome.trim(), descrizione: note.trim() || null } }),
    onSuccess: ({ outfit }) => {
      void client.invalidateQueries({ queryKey: ["outfit-elenco"] })
      avvisa(`${outfit.nome} saved as a draft`)
      navigate(`/outfit/${outfit.id}`)
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    setSenzaNome(!nome.trim())
    if (nome.trim()) crea.mutate()
  }
  return (
    <Modale titolo="New outfit" sottotitolo="It starts as a draft until you publish it." onChiudi={onChiudi}>
      <form className="modulo outfit-modale" noValidate onSubmit={invia}>
        <Campo etichetta="Outfit name" aiuto={senzaNome ? "Give it a name." : null}>
          <input maxLength={120} placeholder="e.g. Weekend in Linen" aria-invalid={senzaNome} value={nome} onChange={(e) => { setNome(e.target.value); setSenzaNome(false) }} />
        </Campo>
        <Campo etichetta="Style notes">
          <input maxLength={2000} placeholder="Occasion, season and mood" value={note} onChange={(e) => setNote(e.target.value)} />
        </Campo>
        {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{(crea.error as Error).message}</p> : null}
        <div className="modale__piede">
          <span className="spazio" />
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button type="submit" className="primario" disabled={crea.isPending}>Save draft</button>
        </div>
      </form>
    </Modale>
  )
}

function SchedaOutfit({ outfit }: { outfit: OutfitSintesi }) {
  const aziende = nomiAziende(outfit)
  return (
    <Link to={`/outfit/${outfit.id}`} className="outfit-scheda vetro">
      {fotoDi(outfit)}
      <span className="outfit-scheda__stato"><EtichettaStato stato={outfit.stato} /></span>
      <div className="outfit-scheda__testo">
        <strong>{outfit.nome}</strong>
        <small>{numeroCapi(outfit)}{aziende ? ` · ${aziende}` : ""}</small>
        <div className="outfit-scheda__piede">
          <span className="outfit-scheda__prezzo">{prezzoOutfit(outfit)}</span>
          <ChipDisponibilita acquistabile={outfit.disponibilita.acquistabile} />
        </div>
      </div>
    </Link>
  )
}

export default function Elenco() {
  const navigate = useNavigate()
  const { puo } = usePermessi()
  const [parametri, setParametri] = useSearchParams()
  const [ricerca, setRicerca] = useState("")
  const [stato, setStato] = useState<StatoOutfit>("pubblicato")
  const [disponibilita, setDisponibilita] = useState("")
  const [azienda, setAzienda] = useState("")
  const [pagina, setPagina] = useState(1)
  const [vista, setVista] = useState<"griglia" | "elenco">("griglia")
  const testo = useRitardato(ricerca.trim())

  const puoCreare = puo("outfit", "edit")
  const nuovoAperto = puoCreare && parametri.get("nuovo") === "1"

  const filtri = new URLSearchParams({ limit: String(PER_PAGINA), offset: String((pagina - 1) * PER_PAGINA) })
  if (testo) filtri.set("q", testo)
  filtri.set("stato", stato)
  if (disponibilita) filtri.set("disponibilita", disponibilita)
  if (azienda) filtri.set("azienda", azienda)

  // Le carte vecchie restano finché arrivano le nuove, che poi entrano in sequenza.
  const { data, isLoading, error, isPlaceholderData } = useQuery({
    queryKey: ["outfit-elenco", filtri.toString()],
    queryFn: () => api<RispostaElenco>(`/admin/outfit?${filtri}`),
    placeholderData: keepPreviousData,
  })
  const griglia = useRef<HTMLDivElement>(null)
  const filtriMostrati = useRef(filtri.toString())
  const mostrati = isPlaceholderData ? filtriMostrati.current : filtri.toString()

  useEffect(() => {
    if (filtriMostrati.current === mostrati) return
    filtriMostrati.current = mostrati
    griglia.current?.querySelectorAll(".outfit-scheda").forEach((carta, indice) => {
      anima(carta, RIENTRO, { duration: 870, delay: indice * 40, easing: "linear" })
    })
  }, [mostrati])

  const cambiaFiltro = <T,>(imposta: (valore: T) => void) => (valore: T) => {
    imposta(valore)
    setPagina(1)
  }
  const chiudiNuovo = () => {
    const prossimi = new URLSearchParams(parametri)
    prossimi.delete("nuovo")
    setParametri(prossimi, { replace: true })
  }

  const pulisciFiltri = () => {
    setRicerca("")
    setDisponibilita("")
    setAzienda("")
    setPagina(1)
  }

  const conteggi = data?.conteggi
  const nessunOutfit = !testo && conteggi && conteggi.bozza + conteggi.pubblicato + conteggi.archiviato === 0
  const nomeStato = SEGMENTI_STATO.find((s) => s.id === stato)?.nome
  const elenco = data?.outfit ?? []

  return (
    <Pagina
      titolo="Outfit Studio"
      sottotitolo={conteggi ? `${numero(conteggi.pubblicato)} published · looks built from real company stock.` : "Looks built from real company stock."}
      azioni={
        puoCreare ? (
          <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}>
            <Plus size={16} aria-hidden="true" /> New outfit
          </button>
        ) : undefined
      }
    >
      <div className="barra-strumenti">
        <CampoRicerca valore={ricerca} etichetta="Search by name, note or piece" onCambia={cambiaFiltro(setRicerca)} />
        <span className="spazio" />
        <Segmenti etichetta="Filter by status" valore={stato} onCambia={cambiaFiltro(setStato)} voci={SEGMENTI_STATO} />
        <Segmenti etichetta="Filter by availability" valore={disponibilita} onCambia={cambiaFiltro(setDisponibilita)} voci={FILTRI_DISPONIBILITA} />
        <Segmenti etichetta="View" valore={vista} onCambia={setVista} voci={[...VISTE]} />
      </div>

      {data?.aziende.length ? (
        <div className="filtri" role="group" aria-label="Filter by company">
          <button type="button" className={azienda ? undefined : "attivo"} aria-pressed={!azienda} onClick={() => cambiaFiltro(setAzienda)("")}>
            Everything <em className="outfit-conteggio">{numero(conteggi?.[stato])}</em>
          </button>
          {data.aziende.map((a) => (
            <button key={a.id} type="button" className={azienda === a.id ? "attivo" : undefined} aria-pressed={azienda === a.id} onClick={() => cambiaFiltro(setAzienda)(a.id)}>
              {a.nome} <em className="outfit-conteggio">{numero(a.outfit)}</em>
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? <GrigliaAttesa /> : null}
      {error ? <p className="avviso-stato avviso-stato--errore" role="alert">{(error as Error).message}</p> : null}

      {data && !elenco.length ? (
        nessunOutfit ? (
          <Vuoto
            icona={Shirt}
            titolo="No outfits yet"
            testo="Create your first outfit by picking pieces from the companies' catalogue."
            azione={puoCreare ? <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}>New outfit</button> : undefined}
          />
        ) : (
          <Vuoto
            icona={Shirt}
            titolo="Nothing here"
            testo={testo ? `No ${nomeStato} outfits match “${testo}”.` : `No ${nomeStato} outfits with these filters.`}
            azione={testo || azienda || disponibilita ? <button type="button" onClick={pulisciFiltri}>Clear filters</button> : undefined}
          />
        )
      ) : null}

      {elenco.length && vista === "griglia" ? (
        <div className="griglia-outfit" ref={griglia}>
          {elenco.map((o) => <SchedaOutfit key={o.id} outfit={o} />)}
        </div>
      ) : null}
      {elenco.length && vista === "elenco" ? (
        <div className="outfit-tabella">
          <Tabella colonne={COLONNE} righe={elenco} chiave={(o) => o.id} onApri={(o) => navigate(`/outfit/${o.id}`)} etichetta="Outfits" />
        </div>
      ) : null}
      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={data?.count ?? 0} onCambia={setPagina} />

      {nuovoAperto ? <NuovoOutfit onChiudi={chiudiNuovo} /> : null}
    </Pagina>
  )
}
