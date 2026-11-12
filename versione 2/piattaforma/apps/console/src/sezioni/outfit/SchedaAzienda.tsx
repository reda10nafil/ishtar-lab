import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { api } from "../../api/client"
import { Riquadro } from "../../componenti"
import { numero } from "../../lingua"
import { Anteprima, dataOra, Etichetta, euro, Pagina } from "../../ui"
import { Taglie } from "./Capi"
import { EtichettaStato, FotoComposta } from "./comuni"
import type { CapoAzienda, OutfitAzienda, TipoValore } from "./tipi"

const ETICHETTE_VALORE: Record<TipoValore, string> = { cessione: "Supply price", offerta: "Your offer price" }

function RigaCapo({ capo }: { capo: CapoAzienda }) {
  return (
    <li className="capo-riga">
      <span className="capo-riga__apri"><Anteprima url={capo.foto} titolo={capo.titolo} /></span>
      <div className="capo-riga__corpo">
        <div className="capo-riga__testa">
          <div className="riga__testo">
            <strong>{capo.titolo}</strong>
            <small>{capo.ruolo === "alternativa" ? "Alternative to another piece" : "Piece in the outfit"}</small>
          </div>
          {capo.acquistabile ? <Etichetta tono="ok">Available</Etichetta> : <Etichetta tono="attesa">{capo.problema ?? "Not available"}</Etichetta>}
        </div>
        <Taglie varianti={capo.varianti} />
        <dl className="conti">
          <div><dt>{ETICHETTE_VALORE[capo.valore_tipo]}</dt><dd>{euro(capo.valore)}</dd></div>
          {capo.sconto_a_carico ? <div><dt>Discount you fund on this piece</dt><dd>{euro(capo.sconto_a_carico)}</dd></div> : null}
        </dl>
      </div>
    </li>
  )
}

const testoCompagni = (altri: number) => {
  if (altri === 0) return "All the pieces in this outfit are yours."
  return altri === 1 ? "Together with one other piece in this outfit." : `Together with ${numero(altri)} other pieces in this outfit.`
}

/** Sola lettura: il server manda solo i capi dell'azienda collegata, con i suoi numeri. */
export default function SchedaAzienda() {
  const { id = "" } = useParams()
  const { data, isLoading, error } = useQuery({
    queryKey: ["outfit-azienda", id],
    queryFn: async () => (await api<{ outfit: OutfitAzienda }>(`/vendor/outfit/${id}`)).outfit,
  })

  if (isLoading) return <p className="avviso-stato">Loading...</p>
  if (error) return <p className="avviso-stato avviso-stato--errore" role="alert">{(error as Error).message}</p>
  if (!data) return null

  return (
    <Pagina titolo={data.nome} sottotitolo={data.pubblicato_il ? `Published on ${dataOra(data.pubblicato_il)}` : "Not published yet."}>
      <div className="studio__barra">
        <Link to="/outfit" className="studio__indietro"><ArrowLeft size={17} aria-hidden="true" /> All outfits</Link>
        <EtichettaStato stato={data.stato} />
      </div>
      <div className="studio">
        <div className="studio__colonna">
          <Riquadro titolo="Your pieces in the outfit" testo={testoCompagni(data.altri_capi)}>
            <FotoComposta nome={data.nome} pezzi={data.capi.map((c) => ({ ...c, chiave: c.id }))} />
          </Riquadro>
        </div>
        <div className="studio__colonna">
          <Riquadro titolo="Stock and value" testo="Only your pieces, with your numbers.">
            <ul className="capi-elenco">{data.capi.map((capo) => <RigaCapo key={capo.id} capo={capo} />)}</ul>
          </Riquadro>
          {data.descrizione ? <Riquadro titolo="Description"><p>{data.descrizione}</p></Riquadro> : null}
        </div>
      </div>
    </Pagina>
  )
}
