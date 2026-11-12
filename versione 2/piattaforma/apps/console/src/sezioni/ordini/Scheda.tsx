import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Printer, StickyNote } from "lucide-react"
import { useCallback, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { STATI_PAGAMENTO, stato } from "../../lingua"
import { usePermessi } from "../../permessi"
import { dataOra, euro } from "../../ui"
import { evasioneDi, giorno, lineaIndirizzo, NOME_CANALE, PASSI, quando, useAggiorna } from "./dati"
import Distinta from "./Distinta"
import { BloccoRichiesta, ModuloSpedizione, percorsoAzione } from "./Evasione"
import ModuloReso from "./ModuloReso"
import { Avatar, Canale, Cassetto, Domanda, Etichetta, Mini, Pillola } from "./Pezzi"
import type { AzioneEvasione, Scheda as TipoScheda } from "./tipi"
import { fogliDi } from "./Tutti"

const FORNITORI: Record<string, string> = { pp_system_default: "Manual payment" }

export function Cronologia({ voci }: { voci: TipoScheda["cronologia"] }) {
  return (
    <ul className="ord-cronologia">
      {voci.map((v, i) => (
        <li key={`${v.quando}-${i}`}>
          <i aria-hidden="true" />
          <span>
            <b>{v.importo !== undefined ? `Payment of ${euro(v.importo)} received` : v.titolo}</b>
            {v.dettaglio ? <em>{v.dettaglio}</em> : null}
            <small>{quando(v.quando)}</small>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Note({ ordine }: { ordine: TipoScheda }) {
  const { puo } = usePermessi()
  const { segnalaErrore } = useAvvisi()
  const aggiorna = useAggiorna()
  const [testo, setTesto] = useState("")
  const [attesa, setAttesa] = useState(false)
  if (!puo("orders", "edit")) return null
  const aggiungi = async () => {
    setAttesa(true)
    try {
      await api(`/admin/ordini/${ordine.id}/note`, { corpo: { testo } })
      setTesto("")
      await aggiorna()
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setAttesa(false)
    }
  }
  return (
    <form
      className="ord-nota"
      onSubmit={(e) => {
        e.preventDefault()
        void aggiungi()
      }}
    >
      <input value={testo} maxLength={1000} placeholder="Add a note for the team" aria-label="Note" onChange={(e) => setTesto(e.target.value)} />
      <button type="submit" className="ord-btn ord-btn--s" disabled={attesa || !testo.trim()}>Add</button>
    </form>
  )
}

export default function Scheda() {
  const { id = "" } = useParams()
  const { state } = useLocation()
  const naviga = useNavigate()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiorna()
  const [annullo, setAnnullo] = useState(false)
  const [reso, setReso] = useState(false)
  const [stampa, setStampa] = useState(false)
  const [attesa, setAttesa] = useState(false)
  const [spedisco, setSpedisco] = useState(false)
  const query = useQuery({ queryKey: ["ordini", "scheda", id], queryFn: () => api<{ ordine: TipoScheda }>(`/admin/ordini/${id}`) })
  const o = query.data?.ordine
  const chiudi = useCallback(() => naviga((state as { da?: string } | null)?.da ?? "/ordini/tutti"), [naviga, state])
  const fineStampa = useCallback(() => {
    setStampa(false)
    if (o) avvisa(`Packing slip for #${o.numero} sent to the printer`)
  }, [avvisa, o])

  const lavora = async (fatto: string, lavoro: () => Promise<unknown>) => {
    setAttesa(true)
    try {
      await lavoro()
      avvisa(fatto)
      await aggiorna()
      window.setTimeout(() => void aggiorna(), 1500)
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setAttesa(false)
      setAnnullo(false)
    }
  }

  if (!o) {
    return (
      <Cassetto titolo={query.error ? "Order not found" : "Order"} onChiudi={chiudi}>
        <p className="ord-avviso">{query.error ? "This order no longer exists." : "Loading..."}</p>
      </Cassetto>
    )
  }

  const pagamento = stato(STATI_PAGAMENTO, o.pagamento)
  const evasione = evasioneDi(o.evasione)
  const puoAvanzare = puo("evasioni", "edit") && o.azioni.passo
  const resoPossibile = puo("orders.returns", "edit") && o.righe.some((r) => r.spedite - r.in_reso - r.rese > 0)

  const avanza = () => {
    const passo = o.azioni.passo
    if (passo === "spedisci") return setSpedisco(true)
    const azione: AzioneEvasione = passo === "prepara" ? "prepara" : "consegna"
    const scelte = o.richieste.filter((r) => (azione === "prepara" ? r.stato === "da_confermare" || r.stato === "confermata" : r.stato === "spedita"))
    return lavora(`#${o.numero} ${azione === "prepara" ? "packed" : "delivered"}`, () => Promise.all(scelte.map((r) => api(percorsoAzione(true, r, azione), { corpo: {} }))))
  }

  return (
    <Cassetto
      titolo={`Order #${o.numero}`}
      sottotitolo={`${giorno(o.creato_il)}, ${new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" }).format(new Date(o.creato_il))} · ${NOME_CANALE[o.canale]}`}
      onChiudi={chiudi}
      piede={
        <>
          {o.azioni.annulla && puo("orders", "edit") ? <button type="button" className="ord-btn ord-btn--fantasma ord-btn--rosso" onClick={() => setAnnullo(true)}>Cancel order</button> : null}
          <span className="ord-spazio" />
          <button type="button" className="ord-btn ord-btn--fantasma" onClick={() => setStampa(true)}><Printer size={18} aria-hidden="true" /> Packing slip</button>
          {resoPossibile ? <button type="button" className="ord-btn" onClick={() => setReso(true)}>Start a return</button> : null}
          {o.azioni.incassa && puo("payments", "edit") ? <button type="button" className="ord-btn" disabled={attesa} onClick={() => void lavora(`#${o.numero} marked paid`, () => api(`/admin/ordini/${o.id}/incassa`, { corpo: {} }))}>Mark paid</button> : null}
          {puoAvanzare && o.azioni.passo ? (
            <button type="button" className="ord-btn ord-btn--primario" disabled={attesa} onClick={() => void avanza()}>{PASSI[o.azioni.passo]}</button>
          ) : (
            <button type="button" className="ord-btn" onClick={chiudi}>Done</button>
          )}
        </>
      }
    >
      <div className="ord-etichette">
        <Canale canale={o.canale} />
        <Pillola tono={pagamento.tono}>{pagamento.testo}</Pillola>
        <Pillola tono={evasione.tono}>{evasione.testo}</Pillola>
      </div>

      {o.nota ? <p className="ord-nota-ordine"><StickyNote size={16} aria-hidden="true" />{o.nota}</p> : null}

      <Etichetta>Items</Etichetta>
      <div className="ord-righe">
        {o.righe.map((r) => (
          <div key={r.id} className="ord-riga">
            <Mini url={r.miniatura} titolo={r.titolo} misura="m" />
            <span className="ord-riga__testo">
              <b>{r.titolo}</b>
              <small>{[r.variante, r.sku].filter(Boolean).join(" · ")}{r.prezzo !== undefined ? ` · ${euro(r.prezzo)} each` : ""}</small>
            </span>
            <span className="ord-tenue">× {r.quantita}</span>
            <b className="ord-importo">{euro(r.totale)}</b>
          </div>
        ))}
      </div>

      <dl className="ord-totali">
        <dt>Subtotal</dt><dd>{euro(o.importi.articoli)}</dd>
        {o.importi.sconti ? <><dt>Discount</dt><dd>−{euro(o.importi.sconti)}</dd></> : null}
        <dt>Postage</dt><dd>{o.importi.spedizione ? euro(o.importi.spedizione) : "Free"}</dd>
        {o.importi.tasse ? <><dt>Tax</dt><dd>{euro(o.importi.tasse)}</dd></> : null}
        <dt className="ord-totale">Total</dt><dd className="ord-totale">{euro(o.importi.totale)}</dd>
      </dl>

      <Etichetta>Customer</Etichetta>
      {o.cliente.id && puo("customers", "view") ? (
        <Link className="ord-cliente" to={`/clienti/persone/${o.cliente.id}`}>
          <Avatar nome={o.cliente.nome} />
          <span>
            <b>{o.cliente.nome}</b>
            <small>{[o.cliente.email, o.citta].filter(Boolean).join(" · ")}</small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      ) : (
        <div className="ord-cliente">
          <Avatar nome={o.cliente.nome} />
          <span>
            <b>{o.cliente.nome}</b>
            <small>{[o.cliente.email, o.citta].filter(Boolean).join(" · ")}</small>
          </span>
        </div>
      )}

      {o.canale === "cassa" ? (
        <>
          <Etichetta>Paid by</Etichetta>
          <p className="ord-testo">{o.pagato_con === "contanti" ? "Cash on the till" : "Card on the till"}</p>
        </>
      ) : (
        <>
          <Etichetta>Delivery</Etichetta>
          <p className="ord-testo">{[...new Set(o.consegna.map((c) => (c.importo ? c.nome : `${c.nome} · free`)))].join(", ") || "No delivery method"}</p>
        </>
      )}
      {o.indirizzo ? <p className="ord-tenue ord-indirizzo">{[o.indirizzo.nome, lineaIndirizzo(o.indirizzo), o.indirizzo.telefono].filter(Boolean).join(" · ")}</p> : null}

      {o.canale === "cassa" ? null : <Etichetta>Payment</Etichetta>}
      {o.canale === "cassa" ? null : o.pagamenti.length ? (
        <p className="ord-testo">{[...new Set(o.pagamenti.map((p) => FORNITORI[p.fornitore] ?? "Card"))].join(", ")} · {euro(o.incassato)} taken{o.rimborsato ? ` · ${euro(o.rimborsato)} refunded` : ""}</p>
      ) : (
        <p className="ord-testo">Nothing taken yet</p>
      )}

      {o.canale === "cassa" ? null : (
        <>
          <Etichetta>Fulfilment</Etichetta>
          <div className="ord-richieste">
            {o.richieste.map((r) => <BloccoRichiesta key={r.id} richiesta={r} />)}
            {o.senza_azienda.length ? <p className="ord-tenue">Not assigned to a company: {o.senza_azienda.join(", ")}</p> : null}
            {!o.richieste.length && !o.senza_azienda.length ? <p className="ord-tenue">No company is involved yet.</p> : null}
          </div>
        </>
      )}

      <Etichetta>Timeline</Etichetta>
      <Cronologia voci={o.cronologia} />

      <Etichetta>Notes</Etichetta>
      {o.note.length ? (
        <ul className="ord-note">
          {o.note.map((n) => <li key={n.id}><b>{n.chi}</b> <small>{dataOra(n.quando)}</small><p>{n.testo}</p></li>)}
        </ul>
      ) : null}
      <Note ordine={o} />

      {annullo ? (
        <Domanda
          titolo={`Cancel order #${o.numero}?`}
          testo="Every company stops working on it, the stock goes back and anything already paid is refunded."
          azione="Cancel order"
          attesa={attesa}
          onConferma={() => void lavora(`#${o.numero} cancelled`, () => api(`/admin/ordini/${o.id}/annulla`, { corpo: {} }))}
          onChiudi={() => setAnnullo(false)}
        />
      ) : null}
      {reso ? <ModuloReso ordine={o} onChiudi={() => setReso(false)} /> : null}
      {spedisco ? <ModuloSpedizione richiesta={o.richieste.find((r) => r.stato === "preparata") ?? o.richieste[0]} onChiudi={() => setSpedisco(false)} /> : null}
      {stampa ? <Distinta fogli={fogliDi(o)} onFine={fineStampa} /> : null}
    </Cassetto>
  )
}
