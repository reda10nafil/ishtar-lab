import { useQuery } from "@tanstack/react-query"
import { Shirt } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, Vuoto } from "../../componenti"
import { numero } from "../../lingua"
import { Pagina } from "../../ui"
import { EtichettaStato, FotoComposta, Segmenti, useRitardato } from "./comuni"
import type { OutfitAzienda, RispostaElencoAzienda, StatoOutfit } from "./tipi"

const PER_PAGINA = 24

const FILTRI: { id: "" | StatoOutfit; testo: string }[] = [
  { id: "", testo: "All" },
  { id: "pubblicato", testo: "Published" },
  { id: "bozza", testo: "Drafts" },
  { id: "archiviato", testo: "Archived" },
]

function Scheda({ outfit }: { outfit: OutfitAzienda }) {
  return (
    <Link to={`/outfit/${outfit.id}`} className="outfit-scheda vetro">
      <FotoComposta nome={outfit.nome} pezzi={outfit.capi.map((c) => ({ ...c, chiave: c.id }))} />
      <span className="outfit-scheda__stato"><EtichettaStato stato={outfit.stato} /></span>
      <div className="outfit-scheda__testo">
        <strong>{outfit.nome}</strong>
        <small>{outfit.capi.length === 1 ? "1 of your pieces" : `${numero(outfit.capi.length)} of your pieces`}</small>
      </div>
    </Link>
  )
}

export default function ElencoAzienda() {
  const [ricerca, setRicerca] = useState("")
  const [stato, setStato] = useState<"" | StatoOutfit>("")
  const [pagina, setPagina] = useState(1)
  const testo = useRitardato(ricerca.trim())

  const filtri = new URLSearchParams({ limit: String(PER_PAGINA), offset: String((pagina - 1) * PER_PAGINA) })
  if (testo) filtri.set("q", testo)
  if (stato) filtri.set("stato", stato)

  const { data, isLoading, error } = useQuery({
    queryKey: ["outfit-azienda", filtri.toString()],
    queryFn: () => api<RispostaElencoAzienda>(`/vendor/outfit?${filtri}`),
  })
  const elenco = data?.outfit ?? []

  return (
    <Pagina titolo="Outfits" sottotitolo="Outfits that include your pieces, read only.">
      <div className="barra-strumenti">
        <CampoRicerca valore={ricerca} etichetta="Search outfits by name" onCambia={(v) => { setRicerca(v); setPagina(1) }} />
        <span className="spazio" />
        <Segmenti etichetta="Filter by status" valore={stato} voci={FILTRI} onCambia={(v) => { setStato(v); setPagina(1) }} />
      </div>
      {isLoading ? <p className="avviso-stato">Loading...</p> : null}
      {error ? <p className="avviso-stato avviso-stato--errore" role="alert">{(error as Error).message}</p> : null}
      {data && !elenco.length ? (
        <Vuoto
          icona={Shirt}
          titolo={testo || stato ? "No outfits match these filters" : "Your pieces are not in an outfit yet"}
          testo={testo || stato ? "Try removing a filter or changing your search." : "You will see it here when one of your pieces joins an outfit."}
        />
      ) : null}
      {elenco.length ? <div className="griglia-outfit">{elenco.map((o) => <Scheda key={o.id} outfit={o} />)}</div> : null}
      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={data?.count ?? 0} onCambia={setPagina} />
    </Pagina>
  )
}
