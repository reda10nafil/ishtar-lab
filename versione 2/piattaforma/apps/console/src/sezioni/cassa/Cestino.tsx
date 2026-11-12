import { CreditCard, Minus, Plus, ShoppingBag, Tag, X } from "lucide-react"
import { forwardRef, useEffect, useRef, useState, type FormEvent } from "react"
import { useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { euro } from "../../ui"
import { CampoCliente } from "./CampoCliente"
import { leggiConto } from "./dati"
import { battito, lampo } from "./movimenti"
import { Miniatura } from "./Scaffale"
import type { Cliente, Conto, RigaCestino } from "./tipi"

type Proprieta = {
  righe: RigaCestino[]
  pezzi: number
  conto: Conto | undefined
  aggiornando: boolean
  codice: string | null
  cliente: Cliente | null
  puoIncassare: boolean
  motivo: string | null
  aperto: boolean
  onCodice: (codice: string | null) => void
  onCliente: (cliente: Cliente | null) => void
  onQuantita: (offerta_id: string, variazione: number) => void
  onSvuota: () => void
  onIncassa: () => void
  onChiudi: () => void
}

function Riga({ riga, onQuantita }: { riga: RigaCestino; onQuantita: Proprieta["onQuantita"] }) {
  const quantita = useRef<HTMLOutputElement>(null)
  useEffect(() => battito(quantita.current), [riga.quantita])
  return (
    <div className="cassa-riga">
      <Miniatura titolo={riga.titolo} foto={riga.foto} classe="cassa-miniatura--piccola" />
      <span className="cassa-riga__testo">
        <b>{riga.titolo}</b>
        <small>{riga.taglia} · {euro(riga.prezzo)}</small>
      </span>
      <span className="cassa-passo">
        <button type="button" aria-label={`One fewer ${riga.titolo}`} onClick={() => onQuantita(riga.offerta_id, -1)}>
          <Minus size={15} aria-hidden="true" />
        </button>
        <output ref={quantita}>{numero(riga.quantita)}</output>
        <button type="button" className="cassa-passo__piu" aria-label={`One more ${riga.titolo}`} disabled={riga.quantita >= riga.disponibili} onClick={() => onQuantita(riga.offerta_id, 1)}>
          <Plus size={15} aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}

function Totali({ conto, codice }: { conto: Conto | undefined; codice: string | null }) {
  const totale = useRef<HTMLElement>(null)
  const valore = conto?.totale ?? 0
  useEffect(() => {
    if (valore) lampo(totale.current)
  }, [valore])
  return (
    <div className="cassa-totali">
      <span>Subtotal</span>
      <b>{euro(conto?.subtotale ?? 0)}</b>
      {conto?.sconto ? (
        <>
          <span>{codice}</span>
          <b className="cassa-totali__sconto">−{euro(conto.sconto)}</b>
        </>
      ) : null}
      <span>Includes VAT</span>
      {conto ? (conto.iva === null ? <b className="cassa-totali__nulla" title="No VAT rate is set for this shop">Not set</b> : <b>{euro(conto.iva)}</b>) : <b>{euro(0)}</b>}
      <span className="cassa-totali__fine">To pay</span>
      <b className="cassa-totali__fine" ref={totale}>{euro(valore)}</b>
    </div>
  )
}

/** Cestino della cassa: su telefono è un pannello che si apre dal basso. */
export const Cestino = forwardRef<HTMLElement, Proprieta>(function Cestino(p, rif) {
  const { segnalaErrore } = useAvvisi()
  const [scritto, setScritto] = useState("")
  const [verifica, setVerifica] = useState(false)
  const vuoto = !p.righe.length

  const applica = async (evento: FormEvent) => {
    evento.preventDefault()
    const codice = scritto.trim().toUpperCase()
    if (!codice) return
    setVerifica(true)
    try {
      await leggiConto(p.righe, codice)
      p.onCodice(codice)
      setScritto("")
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setVerifica(false)
    }
  }

  return (
    <aside ref={rif} className={`cassa__cestino vetro${p.aperto ? " cassa__cestino--aperto" : ""}`} aria-label="Basket">
      <div className="canale-testa">
        <div>
          <h2>Basket</h2>
          <p>{vuoto ? "Tap a product to add it" : `${numero(p.pezzi)} ${p.pezzi === 1 ? "item" : "items"}`}</p>
        </div>
        {vuoto ? null : <button type="button" className="cassa-svuota" onClick={p.onSvuota}>Clear</button>}
        <button type="button" className="cassa-icona cassa-chiudi" aria-label="Close basket" onClick={p.onChiudi}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {vuoto ? (
        <div className="cassa-vuoto">
          <span className="cassa-vuoto__icona"><ShoppingBag size={24} aria-hidden="true" /></span>
          <b>Empty basket</b>
          <p>Products you tap on the left land here.</p>
        </div>
      ) : (
        <div className="cassa-righe">
          {p.righe.map((riga) => <Riga key={riga.offerta_id} riga={riga} onQuantita={p.onQuantita} />)}
        </div>
      )}

      {vuoto ? null : <CampoCliente cliente={p.cliente} onCambia={p.onCliente} />}

      {p.codice ? (
        <div className="cassa-codice">
          <span className="cassa-applicato">
            <Tag size={16} aria-hidden="true" />
            {p.codice}
            <button type="button" className="cassa-icona" aria-label={`Remove ${p.codice}`} onClick={() => p.onCodice(null)}>
              <X size={16} aria-hidden="true" />
            </button>
          </span>
        </div>
      ) : (
        <form className="cassa-codice" onSubmit={applica}>
          <input value={scritto} placeholder="Discount code" aria-label="Discount code" onChange={(e) => setScritto(e.target.value)} />
          <button type="submit" disabled={!scritto.trim() || vuoto || verifica}>Apply</button>
        </form>
      )}

      <Totali conto={vuoto ? undefined : p.conto} codice={p.codice} />

      {p.motivo ? <p className="cassa-motivo">{p.motivo}</p> : null}

      <button type="button" className="primario cassa-incassa" disabled={vuoto || !p.puoIncassare || p.aggiornando} onClick={p.onIncassa}>
        <CreditCard size={18} aria-hidden="true" /> Charge {euro(vuoto ? 0 : p.conto?.totale ?? 0)}
      </button>
    </aside>
  )
})
