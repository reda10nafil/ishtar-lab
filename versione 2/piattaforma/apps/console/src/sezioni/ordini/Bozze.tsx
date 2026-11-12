import { useQuery } from "@tanstack/react-query"
import { FileText, StickyNote, Trash2 } from "lucide-react"
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { euro } from "../../ui"
import { quando, useAggiorna } from "./dati"
import ModuloBozza from "./ModuloBozza"
import { Avatar, Domanda, Mini, Pillola } from "./Pezzi"
import type { Bozza } from "./tipi"

export default function Bozze() {
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const naviga = useNavigate()
  const aggiorna = useAggiorna()
  const [, setParametri] = useSearchParams()
  const [cancello, setCancello] = useState<Bozza | null>(null)
  const [converto, setConverto] = useState<Bozza | null>(null)
  const [attesa, setAttesa] = useState(false)
  const query = useQuery({ queryKey: ["ordini", "bozze"], queryFn: () => api<{ bozze: Bozza[] }>("/admin/ordini/bozze") })
  const bozze = query.data?.bozze ?? []
  const scrive = puo("orders", "edit")

  const elimina = async (b: Bozza) => {
    setAttesa(true)
    try {
      await api(`/admin/draft-orders/${b.id}`, { metodo: "DELETE" })
      avvisa(`D-${b.numero} deleted`)
      await aggiorna()
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setAttesa(false)
      setCancello(null)
    }
  }

  return (
    <>
      {query.error ? <p className="ord-avviso" role="alert">{(query.error as Error).message}</p> : null}
      {query.data && !bozze.length ? (
        <section className="ord-riquadro vetro">
          <div className="ord-vuoto">
            <FileText size={30} aria-hidden="true" />
            <strong>No drafts</strong>
            <p>Quotes, phone orders and wholesale deals wait here until you confirm them.</p>
            {scrive ? <button type="button" className="ord-btn ord-btn--s" onClick={() => setParametri({ nuovo: "1" })}>New order</button> : null}
          </div>
        </section>
      ) : null}
      <div className="ord-bozze">
        {bozze.map((b) => (
          <article key={b.id} className="ord-bozza vetro">
            <div className="ord-bozza__testa">
              <div>
                <h3>D-{b.numero}</h3>
                <p>Saved {quando(b.creata_il)}{b.creata_da ? ` by ${b.creata_da}` : ""}</p>
              </div>
              <Pillola tono="attesa">{b.origine === "ingrosso" ? "Wholesale" : "Draft"}</Pillola>
            </div>
            {b.cliente || b.email ? (
              <div className="ord-bozza__chi">
                <Avatar nome={b.cliente ?? b.email ?? "?"} />
                <span><b>{b.cliente ?? b.email}</b>{b.cliente && b.email ? <small>{b.email}</small> : null}</span>
              </div>
            ) : (
              <p className="ord-tenue">No customer yet</p>
            )}
            <div className="ord-righe">
              {b.righe.map((r) => (
                <div key={r.id} className="ord-riga ord-riga--s">
                  <Mini url={r.miniatura} titolo={r.titolo} />
                  <span className="ord-riga__testo">
                    <b>{r.titolo}</b>
                    <small>{euro(r.prezzo)} each</small>
                  </span>
                  <span className="ord-tenue">× {r.quantita}</span>
                  <b className="ord-importo">{euro(r.totale)}</b>
                </div>
              ))}
            </div>
            {b.nota ? <p className="ord-bozza__nota"><StickyNote size={16} aria-hidden="true" />{b.nota}</p> : null}
            <div className="ord-bozza__piede">
              <b className="ord-bozza__totale">{euro(b.totale)}</b>
              {scrive ? (
                <>
                  <button type="button" className="ord-btn ord-btn--s ord-btn--fantasma ord-btn--rosso" onClick={() => setCancello(b)}><Trash2 size={15} aria-hidden="true" /> Delete</button>
                  <button type="button" className="ord-btn ord-btn--s ord-btn--primario" disabled={attesa} onClick={() => setConverto(b)}>Make it an order</button>
                </>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {cancello ? (
        <Domanda
          titolo={`Delete D-${cancello.numero}?`}
          testo="The draft is gone for good. No money has moved and no stock was held."
          azione="Delete draft"
          attesa={attesa}
          onConferma={() => void elimina(cancello)}
          onChiudi={() => setCancello(null)}
        />
      ) : null}
      {converto ? <ModuloBozza bozza={converto} onChiudi={() => setConverto(null)} onCreata={(a) => naviga(a)} /> : null}
    </>
  )
}
