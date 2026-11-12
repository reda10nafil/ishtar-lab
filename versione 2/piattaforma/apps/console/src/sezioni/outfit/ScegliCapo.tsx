import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione } from "../../componenti"
import { numero } from "../../lingua"
import { Anteprima, euro, Modale } from "../../ui"
import { chiaveCapo, useRitardato } from "./comuni"
import type { RispostaCatalogo, Sorgente } from "./tipi"

const PER_PAGINA = 12

function Voce({ voce, gia, onScegli }: { voce: Sorgente; gia: boolean; onScegli: (voce: Sorgente) => void }) {
  const disponibili = voce.varianti.filter((v) => v.disponibile).length
  const senzaOfferta = !voce.varianti.length
  return (
    <li className="catalogo-capi__voce">
      <Anteprima url={voce.foto} titolo={voce.titolo} />
      <div className="riga__testo">
        <strong>{voce.titolo}</strong>
        <small>{voce.azienda_nome}</small>
        <small>
          {voce.prezzo === null ? "No price" : `${voce.prezzo_varia ? "from " : ""}${euro(voce.prezzo)}`}
          {senzaOfferta ? "" : ` · ${numero(disponibili)} of ${numero(voce.varianti.length)} sizes available`}
        </small>
        {voce.problema ? <small className="testo-attesa">{voce.problema}</small> : null}
      </div>
      <button type="button" disabled={gia || senzaOfferta} onClick={() => onScegli(voce)}>{gia ? "Added" : "Choose"}</button>
    </li>
  )
}

/** Sceglie un capo dal catalogo vero: ogni voce è un prodotto con l'azienda che lo vende. */
export default function ScegliCapo({ titolo, testo, esclusi, onScegli, onChiudi }: { titolo: string; testo: string; esclusi: string[]; onScegli: (voce: Sorgente) => void; onChiudi: () => void }) {
  const [ricerca, setRicerca] = useState("")
  const [azienda, setAzienda] = useState("")
  const [pagina, setPagina] = useState(1)
  const q = useRitardato(ricerca.trim())

  const filtri = new URLSearchParams({ limit: String(PER_PAGINA), offset: String((pagina - 1) * PER_PAGINA) })
  if (q) filtri.set("q", q)
  if (azienda) filtri.set("azienda", azienda)

  const { data, isLoading, error } = useQuery({
    queryKey: ["outfit-catalogo", filtri.toString()],
    queryFn: () => api<RispostaCatalogo>(`/admin/outfit/catalogo?${filtri}`),
  })

  return (
    <Modale titolo={titolo} sottotitolo={testo} onChiudi={onChiudi}>
      <div className="catalogo-capi outfit-modale">
        <div className="catalogo-capi__filtri">
          <CampoRicerca valore={ricerca} etichetta="Search the catalogue" onCambia={(v) => { setRicerca(v); setPagina(1) }} />
          <select aria-label="Filter by company" value={azienda} onChange={(e) => { setAzienda(e.target.value); setPagina(1) }}>
            <option value="">All companies</option>
            {data?.aziende.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        {isLoading ? <p className="avviso-stato">Loading...</p> : null}
        {error ? <p className="avviso-stato avviso-stato--errore" role="alert">{(error as Error).message}</p> : null}
        {data && !data.capi.length ? <p className="avviso-stato">No pieces found: the catalogue only shows approved products.</p> : null}
        <ul className="catalogo-capi__elenco">
          {data?.capi.map((voce) => <Voce key={chiaveCapo(voce)} voce={voce} gia={esclusi.includes(chiaveCapo(voce))} onScegli={onScegli} />)}
        </ul>
        <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={data?.count ?? 0} onCambia={setPagina} />
      </div>
    </Modale>
  )
}
