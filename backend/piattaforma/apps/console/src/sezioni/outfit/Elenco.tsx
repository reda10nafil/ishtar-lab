import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Shirt } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, Vuoto } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, euro, Modale, Pagina } from "../../ui"
import { chiaveCapo, ChipDisponibilita, EtichettaStato, FotoComposta, Segmenti, useRitardato } from "./comuni"
import type { Outfit, OutfitSintesi, RispostaElenco, StatoOutfit } from "./tipi"

const PER_PAGINA = 24

const FILTRI_DISPONIBILITA = [
  { id: "", testo: "Any stock" },
  { id: "acquistabili", testo: "Buyable" },
  { id: "non_acquistabili", testo: "Not buyable" },
]

function NuovoOutfit({ onChiudi }: { onChiudi: () => void }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const [nome, setNome] = useState("")
  const crea = useMutation({
    mutationFn: () => api<{ outfit: Outfit }>("/admin/outfit", { corpo: { nome: nome.trim() } }),
    onSuccess: ({ outfit }) => {
      void client.invalidateQueries({ queryKey: ["outfit-elenco"] })
      navigate(`/outfit/${outfit.id}`)
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    crea.mutate()
  }
  return (
    <Modale titolo="New outfit" sottotitolo="It starts as a draft: you pick the pieces on the next page." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Outfit name">
          <input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{(crea.error as Error).message}</p> : null}
        <div className="riga__azioni">
          <button type="submit" className="primario" disabled={crea.isPending || !nome.trim()}>Create outfit</button>
          <button type="button" onClick={onChiudi}>Cancel</button>
        </div>
      </form>
    </Modale>
  )
}

function SchedaOutfit({ outfit }: { outfit: OutfitSintesi }) {
  const aziende = [...new Set(outfit.capi.map((c) => c.azienda_nome))]
  const prezzo = outfit.prezzo.finale
  return (
    <Link to={`/outfit/${outfit.id}`} className="outfit-scheda vetro">
      <FotoComposta nome={outfit.nome} pezzi={outfit.capi.map((c) => ({ ...c, chiave: chiaveCapo(c) }))} />
      <span className="outfit-scheda__stato"><EtichettaStato stato={outfit.stato} /></span>
      <div className="outfit-scheda__testo">
        <strong>{outfit.nome}</strong>
        <small>
          {outfit.capi.length === 1 ? "1 piece" : `${numero(outfit.capi.length)} pieces`}
          {aziende.length ? ` · ${aziende.join(", ")}` : ""}
        </small>
        <div className="outfit-scheda__piede">
          <span>{prezzo === null ? "Price to be set" : `${outfit.prezzo.varia_con_taglia ? "from " : ""}${euro(prezzo)}`}</span>
          <ChipDisponibilita acquistabile={outfit.disponibilita.acquistabile} />
        </div>
      </div>
    </Link>
  )
}

export default function Elenco() {
  const { puo } = usePermessi()
  const [parametri, setParametri] = useSearchParams()
  const [ricerca, setRicerca] = useState("")
  const [stato, setStato] = useState<"" | StatoOutfit>("")
  const [disponibilita, setDisponibilita] = useState("")
  const [azienda, setAzienda] = useState("")
  const [pagina, setPagina] = useState(1)
  const testo = useRitardato(ricerca.trim())

  const puoCreare = puo("outfit", "edit")
  const nuovoAperto = puoCreare && parametri.get("nuovo") === "1"

  const filtri = new URLSearchParams({ limit: String(PER_PAGINA), offset: String((pagina - 1) * PER_PAGINA) })
  if (testo) filtri.set("q", testo)
  if (stato) filtri.set("stato", stato)
  if (disponibilita) filtri.set("disponibilita", disponibilita)
  if (azienda) filtri.set("azienda", azienda)

  const { data, isLoading, error } = useQuery({
    queryKey: ["outfit-elenco", filtri.toString()],
    queryFn: () => api<RispostaElenco>(`/admin/outfit?${filtri}`),
  })

  const cambiaFiltro = <T,>(imposta: (valore: T) => void) => (valore: T) => {
    imposta(valore)
    setPagina(1)
  }
  const chiudiNuovo = () => {
    const prossimi = new URLSearchParams(parametri)
    prossimi.delete("nuovo")
    setParametri(prossimi, { replace: true })
  }

  const conteggi = data?.conteggi
  const totale = conteggi ? conteggi.bozza + conteggi.pubblicato + conteggi.archiviato : undefined
  const nessunFiltro = !testo && !stato && !disponibilita && !azienda
  const elenco = data?.outfit ?? []

  return (
    <Pagina
      titolo="Outfit Studio"
      sottotitolo={conteggi ? `${numero(conteggi.pubblicato)} published · looks built from real company stock.` : "Looks built from real company stock."}
      azioni={
        puoCreare ? (
          <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}>
            <Plus size={18} aria-hidden="true" /> New outfit
          </button>
        ) : undefined
      }
    >
      <div className="barra-strumenti">
        <CampoRicerca valore={ricerca} etichetta="Search outfits by name" onCambia={cambiaFiltro(setRicerca)} />
        <span className="spazio" />
        <Segmenti
          etichetta="Filter by status"
          valore={stato}
          onCambia={cambiaFiltro(setStato)}
          voci={[
            { id: "", testo: "All", conteggio: totale },
            { id: "pubblicato", testo: "Published", conteggio: conteggi?.pubblicato },
            { id: "bozza", testo: "Drafts", conteggio: conteggi?.bozza },
            { id: "archiviato", testo: "Archived", conteggio: conteggi?.archiviato },
          ]}
        />
        <Segmenti etichetta="Filter by availability" valore={disponibilita} onCambia={cambiaFiltro(setDisponibilita)} voci={FILTRI_DISPONIBILITA} />
      </div>

      {data?.aziende.length ? (
        <div className="filtri" role="group" aria-label="Filter by company">
          <button type="button" className={azienda ? undefined : "attivo"} aria-pressed={!azienda} onClick={() => cambiaFiltro(setAzienda)("")}>
            Everything <em className="outfit-conteggio">{numero(totale)}</em>
          </button>
          {data.aziende.map((a) => (
            <button key={a.id} type="button" className={azienda === a.id ? "attivo" : undefined} aria-pressed={azienda === a.id} onClick={() => cambiaFiltro(setAzienda)(a.id)}>
              {a.nome} <em className="outfit-conteggio">{numero(a.outfit)}</em>
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? <p className="avviso-stato">Loading...</p> : null}
      {error ? <p className="avviso-stato avviso-stato--errore" role="alert">{(error as Error).message}</p> : null}

      {data && !elenco.length ? (
        nessunFiltro ? (
          <Vuoto
            icona={Shirt}
            titolo="No outfits yet"
            testo="Create your first outfit by picking pieces from the companies' catalogue."
            azione={puoCreare ? <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}>New outfit</button> : undefined}
          />
        ) : (
          <Vuoto icona={Shirt} titolo="No outfits match these filters" testo="Try removing a filter or changing your search." />
        )
      ) : null}

      {elenco.length ? <div className="griglia-outfit">{elenco.map((o) => <SchedaOutfit key={o.id} outfit={o} />)}</div> : null}
      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={data?.count ?? 0} onCambia={setPagina} />

      {nuovoAperto ? <NuovoOutfit onChiudi={chiudiNuovo} /> : null}
    </Pagina>
  )
}
