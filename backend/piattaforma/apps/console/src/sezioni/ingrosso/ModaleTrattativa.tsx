import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Modale, Stato, dataOra } from "../../ui"
import { ModaleOrdine } from "./ModaleOrdine"
import { FASI, numeroDa } from "./testi"
import type { Fase, Rivenditore, TrattativaConNote } from "./tipi"

function Modulo({ trattativa, rivenditori, onSalvata }: { trattativa: TrattativaConNote; rivenditori: Rivenditore[]; onSalvata: () => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const { puo } = usePermessi()
  const scrive = puo("ingrosso", "edit")
  const [dati, setDati] = useState({
    titolo: trattativa.titolo,
    valore: trattativa.valore_stimato === null ? "" : String(trattativa.valore_stimato),
    rivenditore: trattativa.rivenditore.id,
    fase: trattativa.fase,
  })

  const salva = useMutation({
    mutationFn: async () => {
      await api(`/admin/ingrosso/trattative/${trattativa.id}`, {
        corpo: { titolo: dati.titolo, valore_stimato: numeroDa(dati.valore), rivenditore_id: dati.rivenditore },
      })
      if (dati.fase !== trattativa.fase) await api(`/admin/ingrosso/trattative/${trattativa.id}/sposta`, { corpo: { fase: dati.fase } })
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["ingrosso"] })
      avvisa("Deal updated")
      onSalvata()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <form className="modulo" onSubmit={invia}>
      <fieldset className="ing-gruppo" disabled={!scrive}>
        <Campo etichetta="Title"><input required minLength={2} maxLength={120} value={dati.titolo} onChange={(e) => setDati({ ...dati, titolo: e.target.value })} /></Campo>
        <div className="griglia-due ing-griglia">
          <Campo etichetta="Estimated value" aiuto="Your own estimate: it doesn't become a price.">
            <input type="number" inputMode="decimal" min="0" step="0.01" value={dati.valore} onChange={(e) => setDati({ ...dati, valore: e.target.value })} />
          </Campo>
          <Campo etichetta="Stage">
            <select value={dati.fase} onChange={(e) => setDati({ ...dati, fase: e.target.value as Fase })}>
              {FASI.map((f) => <option key={f.id} value={f.id}>{f.titolo}</option>)}
            </select>
          </Campo>
        </div>
        <Campo etichetta="Stockist">
          <select value={dati.rivenditore} onChange={(e) => setDati({ ...dati, rivenditore: e.target.value })}>
            {rivenditori.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </Campo>
      </fieldset>
      {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
      {scrive ? <button type="submit" disabled={salva.isPending}>{salva.isPending ? "Saving..." : "Save changes"}</button> : null}
    </form>
  )
}

export function ModaleTrattativa({ id, rivenditori, onChiudi }: { id: string; rivenditori: Rivenditore[]; onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const [nota, setNota] = useState("")
  const [ordine, setOrdine] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const scrive = puo("ingrosso", "edit")

  const query = useQuery({ queryKey: ["ingrosso", "trattativa", id], queryFn: () => api<{ trattativa: TrattativaConNote }>(`/admin/ingrosso/trattative/${id}`) })
  const trattativa = query.data?.trattativa

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

  if (!trattativa) {
    return (
      <Modale titolo="Deal" onChiudi={onChiudi}>
        <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      </Modale>
    )
  }

  // Una finestra alla volta: dentro il vetro una seconda finestra resterebbe intrappolata.
  if (ordine) return <ModaleOrdine trattativa={trattativa} onChiudi={() => setOrdine(false)} />
  if (eliminando) {
    return (
      <Conferma
        titolo="Delete this deal?"
        testo={trattativa.ordine_id ? "It goes with its notes. The draft order already created stays." : "It goes with its notes."}
        azione="Delete"
        attesa={elimina.isPending}
        onConferma={() => elimina.mutate()}
        onChiudi={() => setEliminando(false)}
      />
    )
  }

  return (
    <Modale titolo={trattativa.titolo} sottotitolo={trattativa.rivenditore.nome} onChiudi={onChiudi}>
      <Modulo key={`${trattativa.fase}-${trattativa.titolo}`} trattativa={trattativa} rivenditori={rivenditori} onSalvata={onChiudi} />

      <section className="ing-ordine" aria-label="Order">
        <h3 className="ing-titoletto">Order</h3>
        {trattativa.ordine_id ? (
          <p>This deal has a draft order. <Link to="/ordini/bozze">Open drafts</Link></p>
        ) : trattativa.fase === "accordo" ? (
          scrive && puo("orders", "edit") ? (
            <button type="button" className="primario" onClick={() => setOrdine(true)}>Turn into a draft order</button>
          ) : (
            <p>Creating a draft needs permission to edit orders.</p>
          )
        ) : (
          <p>Once the deal reaches the Agreed stage you can turn it into a draft order.</p>
        )}
      </section>

      <section aria-label="Notes">
        <h3 className="ing-titoletto">Notes</h3>
        {scrive ? (
          <form className="modulo" onSubmit={inviaNota}>
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

      {puo("ingrosso", "manage") ? (
        <div className="riga__azioni">
          <button type="button" className="pericolo" onClick={() => setEliminando(true)}>Delete deal</button>
        </div>
      ) : null}
    </Modale>
  )
}
