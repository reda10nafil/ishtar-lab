import { Pencil } from "lucide-react"
import { useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { Anello, Barra, Scintilla } from "../../../componenti/Grafici"
import { Cifra } from "../../../movimenti"
import { fa, numero, percentuale } from "../../../lingua"
import { anima, CURVE } from "../../../movimenti"
import { euro } from "../../../ui"
import { COLORE_CANALE } from "../comuni"
import type { PanoramicaAdmin, PanoramicaAzienda } from "../tipi"

const SENZA_DATI = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

/** Il sito non c'è ancora: visitatori e carrelli restano vuoti e lo dicono, senza numeri inventati. */
function Visitatori({ dati }: { dati: PanoramicaAdmin["in_diretta"] }) {
  if (dati) {
    const barre = [
      { nome: "Browsing", valore: dati.visitatori, colore: "var(--serie-online)" },
      { nome: "In a basket", valore: dati.carrello, colore: "var(--serie-ingrosso)" },
      { nome: "At checkout", valore: dati.cassa, colore: "var(--serie-negozio)" },
    ]
    return (
      <>
        <div className="pan-adesso__numero">
          <b><Cifra valore={dati.visitatori} formato={numero} /></b>
          <span>people<br />browsing</span>
          <Scintilla valori={dati.andamento ?? SENZA_DATI} colore="var(--serie-online)" larghezza={110} altezza={40} base={{ l: 110, a: 40 }} />
        </div>
        <div className="pan-adesso__barre">
          {barre.map((b, i) => (
            <div key={b.nome} className="pan-adesso__barra">
              <span>{b.nome}</span>
              <Barra quota={dati.visitatori ? b.valore / dati.visitatori : 0} colore={b.colore} ritardo={470 + i * 80} />
              <b>{numero(b.valore)}</b>
            </div>
          ))}
        </div>
      </>
    )
  }
  return (
    <>
      <div className="pan-adesso__numero">
        <b aria-label="No visitor data">–</b>
        <span>people<br />browsing</span>
        <Scintilla valori={SENZA_DATI} colore="var(--testo-3)" larghezza={110} altezza={40} base={{ l: 110, a: 40 }} />
      </div>
      <div className="pan-adesso__barre">
        {["Browsing", "In a basket", "At checkout"].map((nome) => (
          <div key={nome} className="pan-adesso__barra">
            <span>{nome}</span>
            <Barra quota={0} />
            <b>–</b>
          </div>
        ))}
      </div>
    </>
  )
}

/** L'anello entra ruotando, dopo il blocco che lo contiene. */
function useEntrataAnello() {
  const nodo = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (nodo.current) anima(nodo.current, [{ opacity: 0, transform: "rotate(-20deg) scale(0.94)" }, { opacity: 1, transform: "none" }], { duration: 900, delay: 300, easing: CURVE.entrata })
  }, [])
  return nodo
}

function Obiettivo({ dati, modifica }: { dati: NonNullable<PanoramicaAdmin["obiettivo"]>; modifica: boolean }) {
  const nodo = useEntrataAnello()
  const quota = dati.meta ? dati.incasso / dati.meta : 0
  const ordini = `${numero(dati.ordini)} ${dati.ordini === 1 ? "order" : "orders"} so far`
  return (
    <div ref={nodo} className="pan-adesso__obiettivo">
      <Anello quota={quota} testo={dati.meta ? percentuale(Math.min(quota, 9.99)) : "–"} />
      <span>
        <b>{dati.meta ? `${euro(dati.incasso).replace(/\.00$/, "")} of ${euro(dati.meta).replace(/\.00$/, "")}` : "No goal set"}</b>
        <small>{dati.meta ? `Today's goal · ${ordini}` : `${euro(dati.incasso)} today · ${ordini}`}</small>
      </span>
      {modifica ? (
        <Link to="/impostazioni/negozio" className="pan-icona" aria-label="Change the daily goal">
          <Pencil size={18} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  )
}

export function BloccoAdesso({ dati, modificaObiettivo }: { dati: PanoramicaAdmin; modificaObiettivo: boolean }) {
  return (
    <section className="pan-adesso vetro" data-blocco aria-label="Right now">
      <div className="pan-testa">
        <div>
          <h2>Right now</h2>
          <p>{dati.in_diretta ? "On the online shop" : "Visitors appear once the shop is live"}</p>
        </div>
        <span className={dati.in_diretta ? "pan-stato pan-stato--vivo" : "pan-stato"}><i /> {dati.in_diretta ? "Live" : "Not live"}</span>
      </div>
      <Visitatori dati={dati.in_diretta} />
      <div className="pan-adesso__ultime">
        <small>Latest sales</small>
        {dati.ultime?.length ? (
          dati.ultime.map((o) => (
            <Link key={o.id} to={`/ordini/tutti/${o.id}`} data-riga>
              <i style={{ background: COLORE_CANALE[o.canale] }} />
              <span>
                <b>{o.cliente ?? `Order #${o.numero}`}</b>
                <small>#{o.numero} · {fa(o.quando)}</small>
              </span>
              <b>{euro(o.totale)}</b>
            </Link>
          ))
        ) : (
          <p className="pan-riga-vuota">{dati.ultime ? "No sales yet: they'll appear here as they come in." : "You don't have access to sales."}</p>
        )}
      </div>
      {dati.obiettivo ? <Obiettivo dati={dati.obiettivo} modifica={modificaObiettivo} /> : null}
    </section>
  )
}

/** Per l'azienda il blocco elenca gli ultimi ordini propri e cosa resta da preparare. */
export function BloccoAdessoAzienda({ dati }: { dati: PanoramicaAzienda }) {
  const aperti = dati.coda.da_preparare + dati.coda.pronti
  return (
    <section className="pan-adesso vetro" data-blocco aria-label="Right now">
      <div className="pan-testa">
        <div>
          <h2>Right now</h2>
          <p>Your orders today</p>
        </div>
      </div>
      <div className="pan-adesso__numero">
        <b>{numero(dati.coda.da_preparare)}</b>
        <span>orders<br />to pack</span>
      </div>
      <div className="pan-adesso__ultime">
        <small>Latest orders</small>
        {dati.ultime.length ? (
          dati.ultime.map((o) => (
            <Link key={o.id} to="/evasioni" data-riga>
              <i style={{ background: "var(--serie-online)" }} />
              <span>
                <b>Order #{o.numero}</b>
                <small>{fa(o.quando)}</small>
              </span>
              <b>{numero(o.unita)} {o.unita === 1 ? "unit" : "units"}</b>
            </Link>
          ))
        ) : (
          <p className="pan-riga-vuota">No orders yet: they'll appear here as they come in.</p>
        )}
      </div>
      <div className="pan-adesso__obiettivo">
        <Anello quota={aperti ? dati.coda.pronti / aperti : 0} testo={aperti ? percentuale(dati.coda.pronti / aperti) : "–"} />
        <span>
          <b>{numero(dati.coda.pronti)} of {numero(aperti)} packed</b>
          <small>Open orders</small>
        </span>
      </div>
    </section>
  )
}
