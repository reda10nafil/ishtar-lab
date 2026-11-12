import { Pencil } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { numero, percentuale } from "../../lingua"
import { usePermessi } from "../../permessi"
import { euro } from "../../ui"
import { Stepper } from "./comuni"
import { conPrezzo, prezzoDaTesto, testoDa, useAggiornaCatalogo, useSchedaSubito } from "./dati"
import type { OffertaScheda, SchedaProdotto, VarianteScheda } from "./tipi"

const ATTESA_SCORTE = 500

const margineDi = (o: OffertaScheda) => (o.margine === null || o.margine === undefined ? null : `Margin ${euro(o.margine)} (${percentuale(o.margine_percento)})`)

function dettagli(o: OffertaScheda, conMargini: boolean) {
  const voci = [
    conMargini && o.prezzo_cessione !== null && o.prezzo_cessione !== undefined ? `Supply ${euro(o.prezzo_cessione)}` : null,
    o.prezzo_consigliato === null ? null : `Suggested ${euro(o.prezzo_consigliato)}`,
    conMargini ? margineDi(o) : null,
  ]
  return voci.filter(Boolean).join(" · ") || "No company prices yet"
}

type Modifica = { prezzo?: number | null; quantita?: number }
type ProprietaRiga = { scheda: SchedaProdotto; variante: VarianteScheda; offerta: OffertaScheda; conMargini: boolean }

/** Prezzo e scorte si cambiano in riga e si salvano al volo: un prezzo sbagliato torna a quello di prima. */
function RigaOfferta({ scheda, variante, offerta, conMargini }: ProprietaRiga) {
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiornaCatalogo()
  const subito = useSchedaSubito(scheda.id)
  const [prezzo, setPrezzo] = useState(testoDa(offerta.prezzo))
  const [scorte, setScorte] = useState(offerta.scorte)
  const inviato = useRef(offerta.prezzo)
  const scorteInAttesa = useRef<number | null>(null)
  const attesa = useRef<ReturnType<typeof setTimeout>>()
  const nome = `${variante.titolo}, ${offerta.azienda.nome}`
  const nomeAvviso = scheda.varianti.length > 1 ? `${scheda.titolo} · ${variante.titolo}` : scheda.titolo

  const scrivi = useCallback(
    async (modifica: Modifica) => {
      await api(`/admin/catalogo/prodotti/${scheda.id}/varianti/${variante.id}`, { corpo: { offerte: [{ id: offerta.id, ...modifica }] } })
      aggiorna(scheda.id)
    },
    [aggiorna, offerta.id, scheda.id, variante.id]
  )

  useEffect(() => {
    inviato.current = offerta.prezzo
    setPrezzo(testoDa(offerta.prezzo))
  }, [offerta.prezzo])
  useEffect(() => {
    if (scorteInAttesa.current === null) setScorte(offerta.scorte)
  }, [offerta.scorte])

  const inviaScorte = useCallback(() => {
    clearTimeout(attesa.current)
    const valore = scorteInAttesa.current
    if (valore === null) return
    scorteInAttesa.current = null
    scrivi({ quantita: valore }).catch((errore) => {
      segnalaErrore(errore)
      setScorte(offerta.scorte)
    })
  }, [offerta.scorte, scrivi, segnalaErrore])
  const ultimaInvio = useRef(inviaScorte)
  ultimaInvio.current = inviaScorte
  // Chiudere il cassetto subito dopo un clic non deve perdere la quantità.
  useEffect(() => () => ultimaInvio.current(), [])

  const salvaPrezzo = (e?: FormEvent) => {
    e?.preventDefault()
    const nuovo = prezzoDaTesto(prezzo)
    const prima = inviato.current
    if (nuovo === null) return setPrezzo(testoDa(prima))
    if (nuovo === prima) return
    const applica = (valore: number | null) => {
      inviato.current = valore
      setPrezzo(testoDa(valore))
      subito((attuale) => conPrezzo(attuale, offerta.id, valore))
    }
    const scriviPrezzo = (valore: number | null, indietro: number | null) =>
      scrivi({ prezzo: valore }).catch((errore) => {
        segnalaErrore(errore)
        applica(indietro)
        return Promise.reject(errore)
      })
    const annulla = () => {
      applica(prima)
      scriviPrezzo(prima, nuovo).catch(() => undefined)
    }
    applica(nuovo)
    avvisa(`${nomeAvviso} is now ${euro(nuovo)}`, { etichetta: "Undo", esegui: annulla })
    scriviPrezzo(nuovo, prima).catch(() => undefined)
  }
  const cambiaScorte = (valore: number) => {
    setScorte(valore)
    scorteInAttesa.current = valore
    clearTimeout(attesa.current)
    attesa.current = setTimeout(inviaScorte, ATTESA_SCORTE)
  }

  return (
    <>
      <div className="riga-impostazione">
        <span className="riga-impostazione__testo">
          <b>{variante.offerte.length > 1 ? `Price · ${offerta.azienda.nome}` : "Price"}</b>
          <small>{dettagli(offerta, conMargini)}</small>
        </span>
        {puo("products", "edit") ? (
          <form className="riga-offerta__prezzo" onSubmit={salvaPrezzo}>
            <input type="text" inputMode="decimal" aria-label={`Selling price: ${nome}`} placeholder="Price" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} onBlur={() => salvaPrezzo()} />
          </form>
        ) : (
          <b>{offerta.prezzo === null ? "To be set" : euro(offerta.prezzo)}</b>
        )}
      </div>
      <div className="riga-impostazione">
        <span className="riga-impostazione__testo">
          <b>{variante.offerte.length > 1 ? `Stock · ${offerta.azienda.nome}` : "Stock"}</b>
          <small>{scorte > 0 ? `${numero(scorte)} in stock` : "Sold out"} · reorder at {numero(offerta.soglia)}</small>
        </span>
        {puo("inventory_items", "edit") && offerta.depositi <= 1 ? <Stepper valore={scorte} etichetta={`stock of ${nome}`} onCambia={cambiaScorte} /> : <b className="riga-offerta__scorte">{numero(offerta.scorte)}</b>}
      </div>
    </>
  )
}

type Proprieta = { scheda: SchedaProdotto; conMargini: boolean; onApri?: (variante: VarianteScheda) => void }

/** Una variante può avere più offerte, una per azienda: ogni offerta ha le sue righe. */
export function TabellaVarianti({ scheda, conMargini, onApri }: Proprieta) {
  return (
    <ul className="varianti" aria-label="Product variants">
      {scheda.varianti.map((v) => (
        <li key={v.id} className="variante">
          <div className="variante__testa">
            <b>{v.titolo}</b>
            <span className="codice">{v.sku ?? "No SKU"}</span>
            <span className="codice">{v.ean ?? "No EAN"}</span>
            <span className="spazio" />
            {onApri ? (
              <button type="button" className="icona-pulsante icona-pulsante--piatta variante__modifica" aria-label={`Edit variant ${v.titolo}`} onClick={() => onApri(v)}>
                <Pencil size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {v.offerte.length ? null : <p className="testo-tenue">No company sells this variant yet.</p>}
          {v.offerte.map((o) => <RigaOfferta key={o.id} scheda={scheda} variante={v} offerta={o} conMargini={conMargini} />)}
        </li>
      ))}
    </ul>
  )
}
