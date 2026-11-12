import { useQuery } from "@tanstack/react-query"
import { Printer } from "lucide-react"
import { useCallback, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { api } from "../../api/client"
import { euro } from "../../ui"
import { evasioneDi, giorno, lineaIndirizzo } from "./dati"
import Distinta from "./Distinta"
import { BloccoRichiesta } from "./Evasione"
import { Cassetto, Etichetta, Mini, Pillola } from "./Pezzi"
import { Cronologia } from "./Scheda"
import type { SchedaAzienda as TipoScheda } from "./tipi"

export default function SchedaAzienda() {
  const { id = "" } = useParams()
  const { state } = useLocation()
  const naviga = useNavigate()
  const [stampa, setStampa] = useState(false)
  const query = useQuery({ queryKey: ["ordini", "azienda", id], queryFn: () => api<{ ordine: TipoScheda }>(`/vendor/ordini/${id}`) })
  const o = query.data?.ordine
  const chiudi = useCallback(() => naviga((state as { da?: string } | null)?.da ?? "/ordini/tutti"), [naviga, state])
  const fineStampa = useCallback(() => setStampa(false), [])

  if (!o) {
    return (
      <Cassetto titolo={query.error ? "Order not found" : "Order"} onChiudi={chiudi}>
        <p className="ord-avviso">{query.error ? "This order is not available." : "Loading..."}</p>
      </Cassetto>
    )
  }
  const evasione = evasioneDi(o.evasione)
  return (
    <Cassetto
      titolo={`Order #${o.numero}`}
      sottotitolo={giorno(o.creato_il)}
      onChiudi={chiudi}
      piede={
        <>
          <span className="ord-spazio" />
          <button type="button" className="ord-btn ord-btn--fantasma" onClick={() => setStampa(true)}><Printer size={18} aria-hidden="true" /> Packing slip</button>
          <button type="button" className="ord-btn" onClick={chiudi}>Done</button>
        </>
      }
    >
      <div className="ord-etichette">
        <Pillola tono={evasione.tono}>{evasione.testo}</Pillola>
        {o.in_ritardo ? <Pillola tono="errore">Late</Pillola> : null}
      </div>

      <Etichetta>Items</Etichetta>
      <div className="ord-righe">
        {o.richiesta.righe.map((r) => (
          <div key={r.id} className="ord-riga">
            <Mini url={r.miniatura} titolo={r.titolo} misura="m" />
            <span className="ord-riga__testo">
              <b>{r.titolo}</b>
              <small>{[r.variante, r.sku].filter(Boolean).join(" · ")}</small>
            </span>
            <span className="ord-tenue">× {r.quantita}</span>
            {r.cessione !== null ? <b className="ord-importo">{euro(r.cessione * r.quantita)}</b> : null}
          </div>
        ))}
      </div>
      {o.valore !== null ? (
        <dl className="ord-totali">
          <dt className="ord-totale">Supply value</dt><dd className="ord-totale">{euro(o.valore)}</dd>
        </dl>
      ) : null}

      <Etichetta>Deliver to</Etichetta>
      <p className="ord-testo">{o.destinatario.nome}</p>
      <p className="ord-tenue ord-indirizzo">{[lineaIndirizzo(o.destinatario), o.destinatario.telefono].filter(Boolean).join(" · ")}</p>

      {o.consegna.length ? (
        <>
          <Etichetta>Delivery</Etichetta>
          <p className="ord-testo">{[...new Set(o.consegna.map((c) => c.nome))].join(", ")}</p>
        </>
      ) : null}

      <Etichetta>Fulfilment</Etichetta>
      <div className="ord-richieste"><BloccoRichiesta richiesta={o.richiesta} /></div>

      <Etichetta>Timeline</Etichetta>
      <Cronologia voci={o.cronologia} />

      {stampa ? (
        <Distinta
          fogli={[{ numero: o.numero, data: o.creato_il, azienda: o.azienda, mittente: o.mittente, destinatario: o.destinatario, consegna: o.consegna[0]?.nome ?? null, righe: o.richiesta.righe }]}
          onFine={fineStampa}
        />
      ) : null}
    </Cassetto>
  )
}
