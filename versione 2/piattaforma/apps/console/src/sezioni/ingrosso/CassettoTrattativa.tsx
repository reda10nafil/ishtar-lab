import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as EventoPuntatore } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Modale, dataBreve, dataOra } from "../../ui"
import { ModaleOrdine } from "./ModaleOrdine"
import { FASI, importoTondo, numeroDa, titoloFase, ultimaMossa } from "./testi"
import type { Fase, Rivenditore, TrattativaConNote } from "./tipi"

const USCITA = 280
/** Oltre questa corsa la presa chiude il foglio, come sul pannello. */
const CORSA_CHIUSURA = 130

function ModificaTrattativa({ trattativa, rivenditori, onChiudi }: { trattativa: TrattativaConNote; rivenditori: Rivenditore[]; onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const [dati, setDati] = useState({
    titolo: trattativa.titolo,
    unita: trattativa.unita === null ? "" : String(trattativa.unita),
    valore: trattativa.valore_stimato === null ? "" : String(trattativa.valore_stimato),
    rivenditore: trattativa.rivenditore.id,
  })

  const salva = useMutation({
    mutationFn: () => api(`/admin/ingrosso/trattative/${trattativa.id}`, {
      corpo: { titolo: dati.titolo, unita: numeroDa(dati.unita), valore_stimato: numeroDa(dati.valore), rivenditore_id: dati.rivenditore },
    }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["ingrosso"] })
      avvisa("Deal updated")
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <Modale titolo="Edit deal" onChiudi={onChiudi}>
      <form className="modulo ing-modulo" onSubmit={invia}>
        <Campo etichetta="Stockist">
          <select value={dati.rivenditore} onChange={(e) => setDati({ ...dati, rivenditore: e.target.value })}>
            {rivenditori.map((r) => <option key={r.id} value={r.id}>{r.citta ? `${r.nome} · ${r.citta}` : r.nome}</option>)}
          </select>
        </Campo>
        <Campo etichetta="What it's for"><input required minLength={2} maxLength={120} value={dati.titolo} onChange={(e) => setDati({ ...dati, titolo: e.target.value })} /></Campo>
        <div className="griglia-due ing-griglia">
          <Campo etichetta="Units">
            <input type="number" inputMode="numeric" min="1" step="1" value={dati.unita} onChange={(e) => setDati({ ...dati, unita: e.target.value })} />
          </Campo>
          <Campo etichetta="Value at trade" aiuto="Your own estimate: it doesn't become a price.">
            <input type="number" inputMode="decimal" min="0" step="0.01" value={dati.valore} onChange={(e) => setDati({ ...dati, valore: e.target.value })} />
          </Campo>
        </div>
        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        <div className="ing-piede">
          <span className="spazio" />
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={salva.isPending}>{salva.isPending ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </Modale>
  )
}

type Proprieta = {
  id: string
  /** La corsia viene dalla bacheca: cambia subito, prima che risponda il server. */
  fase: Fase | undefined
  rivenditori: Rivenditore[]
  onSposta: (fase: Fase) => void
  onChiudi: () => void
}

export function CassettoTrattativa({ id, fase, rivenditori, onSposta, onChiudi }: Proprieta) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const pannello = useRef<HTMLDivElement>(null)
  const presa = useRef<number | null>(null)
  const [uscita, setUscita] = useState(false)
  const [nota, setNota] = useState("")
  const [ordine, setOrdine] = useState(false)
  const [modifica, setModifica] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const scrive = puo("ingrosso", "edit")
  const sopra = ordine || modifica || eliminando

  const query = useQuery({ queryKey: ["ingrosso", "trattativa", id], queryFn: () => api<{ trattativa: TrattativaConNote }>(`/admin/ingrosso/trattative/${id}`) })
  const trattativa = query.data?.trattativa
  const corsia = fase ?? trattativa?.fase

  const chiudi = useCallback(() => {
    const fine = () => {
      onChiudi()
      document.querySelector<HTMLElement>(`.ing-carta[data-id="${id}"]`)?.focus({ preventScroll: true })
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return fine()
    setUscita(true)
    window.setTimeout(fine, USCITA)
  }, [id, onChiudi])

  useEffect(() => {
    pannello.current?.focus({ preventScroll: true })
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".velo")) chiudi()
    }
    document.addEventListener("keydown", tasto)
    return () => document.removeEventListener("keydown", tasto)
  }, [chiudi])

  const aggiungiNota = useMutation({
    mutationFn: () => api(`/admin/ingrosso/trattative/${id}/note`, { corpo: { testo: nota } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["ingrosso", "trattativa", id] })
      setNota("")
    },
  })
  const elimina = useMutation({
    mutationFn: () => api(`/admin/ingrosso/trattative/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["ingrosso"] })
      avvisa("Deal deleted")
      onChiudi()
    },
    onError: segnalaErrore,
  })
  const inviaNota = (e: FormEvent) => {
    e.preventDefault()
    aggiungiNota.mutate()
  }

  // Su telefono il foglio segue la presa: oltre la soglia si chiude, altrimenti torna su.
  const prendiFoglio = (e: EventoPuntatore<HTMLElement>) => {
    presa.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
    if (pannello.current) pannello.current.style.transition = "none"
  }
  const muoviFoglio = (e: EventoPuntatore<HTMLElement>) => {
    if (presa.current === null || !pannello.current) return
    pannello.current.style.transform = `translateY(${Math.max(0, e.clientY - presa.current)}px)`
  }
  const lasciaFoglio = (e: EventoPuntatore<HTMLElement>) => {
    if (presa.current === null || !pannello.current) return
    const corsa = e.clientY - presa.current
    presa.current = null
    pannello.current.style.transition = ""
    pannello.current.style.transform = ""
    if (corsa > CORSA_CHIUSURA) chiudi()
  }

  const titolo = trattativa?.titolo ?? "Deal"
  const luogo = trattativa ? [trattativa.rivenditore.nome, trattativa.rivenditore.citta].filter(Boolean).join(" · ") : ""

  return createPortal(
    <>
      <div className={`ing-velo${uscita ? " ing-velo--esce" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && !sopra && chiudi()}>
        <div ref={pannello} className={`ing-cassetto${uscita ? " ing-cassetto--esce" : ""}`} role="dialog" aria-modal="true" aria-label={titolo} tabIndex={-1}>
          <span className="ing-cassetto__presa" aria-hidden="true" onPointerDown={prendiFoglio} onPointerMove={muoviFoglio} onPointerUp={lasciaFoglio} onPointerCancel={lasciaFoglio}><i /></span>
          <header className="ing-cassetto__testa">
            <div>
              <h2>{titolo}</h2>
              {luogo ? <p>{luogo}</p> : null}
            </div>
            <button type="button" aria-label="Close" onClick={chiudi}><X size={20} aria-hidden="true" /></button>
          </header>

          <div className="ing-cassetto__corpo">
            {query.isLoading ? <p className="avviso-stato">Loading...</p> : null}
            {query.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{(query.error as Error).message}</p> : null}
            {trattativa && corsia ? (
              <>
                <dl className="ing-dati">
                  <dt>Stage</dt>
                  <dd>{titoloFase(corsia)}</dd>
                  <dt>Units</dt>
                  <dd>{trattativa.unita ?? "–"}</dd>
                  <dt>Value at trade</dt>
                  <dd>{trattativa.valore_stimato === null ? "No estimate" : importoTondo(trattativa.valore_stimato)}</dd>
                  <dt>Contact</dt>
                  <dd>{trattativa.rivenditore.referente ?? "–"}</dd>
                  <dt>Terms</dt>
                  <dd>{trattativa.rivenditore.pagamento ?? "–"}</dd>
                  <dt>Stockist since</dt>
                  <dd>{dataBreve(trattativa.rivenditore.dal)}</dd>
                  <dt>Last moved</dt>
                  <dd>{ultimaMossa(trattativa.spostata_il)}</dd>
                </dl>

                <h3 className="ing-etichetta">Move to</h3>
                <div className="ing-pillole" role="group" aria-label="Move to">
                  {FASI.map((f) => (
                    <button key={f.id} type="button" aria-pressed={f.id === corsia} disabled={!scrive} onClick={() => f.id !== corsia && onSposta(f.id)}>{f.titolo}</button>
                  ))}
                </div>

                <section className="ing-ordine" aria-label="Order">
                  <h3 className="ing-etichetta">Order</h3>
                  {trattativa.ordine_id ? (
                    <p>This deal has a draft order. <Link to="/ordini/bozze">Open drafts</Link></p>
                  ) : corsia === "accordo" ? (
                    scrive && puo("orders", "edit") ? (
                      <button type="button" className="primario" onClick={() => setOrdine(true)}>Turn into a draft order</button>
                    ) : (
                      <p>Creating a draft needs permission to edit orders.</p>
                    )
                  ) : (
                    <p>Once the deal reaches the Ordered stage you can turn it into a draft order.</p>
                  )}
                </section>

                <section aria-label="Notes">
                  <h3 className="ing-etichetta">Notes</h3>
                  {scrive ? (
                    <form className="modulo ing-modulo" onSubmit={inviaNota}>
                      <Campo etichetta="New note">
                        <textarea rows={2} required maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} />
                      </Campo>
                      {aggiungiNota.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{aggiungiNota.error.message}</p> : null}
                      <button type="submit" disabled={aggiungiNota.isPending}>Add note</button>
                    </form>
                  ) : null}
                  <ul className="ing-note">
                    {trattativa.note.map((n) => (
                      <li key={n.id}>
                        <p>{n.testo}</p>
                        <small>{n.autore} · {dataOra(n.quando)}</small>
                      </li>
                    ))}
                  </ul>
                  {trattativa.note.length ? null : <p className="ing-vuoto">No notes yet.</p>}
                </section>

                <div className="ing-cassetto__azioni">
                  {scrive ? <button type="button" onClick={() => setModifica(true)}><Pencil size={15} aria-hidden="true" /> Edit deal</button> : null}
                  {puo("ingrosso", "manage") ? <button type="button" className="pericolo" onClick={() => setEliminando(true)}><Trash2 size={15} aria-hidden="true" /> Delete deal</button> : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {trattativa && ordine ? <ModaleOrdine trattativa={trattativa} onChiudi={() => setOrdine(false)} /> : null}
      {trattativa && modifica ? <ModificaTrattativa trattativa={trattativa} rivenditori={rivenditori} onChiudi={() => setModifica(false)} /> : null}
      {trattativa && eliminando ? (
        <Conferma
          titolo="Delete this deal?"
          testo={trattativa.ordine_id ? "It goes with its notes. The draft order already created stays." : "It goes with its notes."}
          azione="Delete"
          attesa={elimina.isPending}
          onConferma={() => elimina.mutate()}
          onChiudi={() => setEliminando(false)}
        />
      ) : null}
    </>,
    document.body,
  )
}
