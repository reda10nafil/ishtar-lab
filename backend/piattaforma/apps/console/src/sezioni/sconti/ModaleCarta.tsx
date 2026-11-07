import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Etichetta, Modale, Stato, dataBreve, dataOra, euro } from "../../ui"
import { CopiaCodice } from "./CopiaCodice"
import { STATI_CARTA, TIPI_MOVIMENTO, numeroDa } from "./testi"
import type { CartaCompleta } from "./tipi"

const segno = (importo: number) => `${importo > 0 ? "+" : ""}${euro(importo)}`

export function ModaleCarta({ id, onChiudi }: { id: string; onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const [rettifica, setRettifica] = useState({ importo: "", nota: "" })
  const [motivo, setMotivo] = useState("")
  const [annullando, setAnnullando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const gestisce = puo("sconti", "manage")

  const query = useQuery({ queryKey: ["sconti", "carta", id], queryFn: () => api<{ carta: CartaCompleta }>(`/admin/carte-regalo/${id}`) })
  const carta = query.data?.carta
  const aggiorna = () => client.invalidateQueries({ queryKey: ["sconti"] })

  const salvaRettifica = useMutation({
    mutationFn: () => api(`/admin/carte-regalo/${id}/movimenti`, { corpo: { importo: numeroDa(rettifica.importo), nota: rettifica.nota } }),
    onSuccess: () => {
      void aggiorna()
      avvisa("Balance updated")
      setRettifica({ importo: "", nota: "" })
    },
  })
  const annulla = useMutation({
    mutationFn: () => api(`/admin/carte-regalo/${id}/annulla`, { corpo: { motivo } }),
    onSuccess: () => {
      void aggiorna()
      avvisa("Gift card cancelled")
      setAnnullando(false)
    },
  })
  const elimina = useMutation({
    mutationFn: () => api(`/admin/carte-regalo/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiorna()
      avvisa("Gift card deleted")
      onChiudi()
    },
    onError: segnalaErrore,
  })

  const inviaRettifica = (e: FormEvent) => {
    e.preventDefault()
    salvaRettifica.mutate()
  }
  const inviaAnnullamento = (e: FormEvent) => {
    e.preventDefault()
    annulla.mutate()
  }

  if (!carta) {
    return (
      <Modale titolo="Gift card" onChiudi={onChiudi}>
        <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      </Modale>
    )
  }

  const stato = STATI_CARTA[carta.stato]
  const annullata = carta.stato === "annullata"

  // Una finestra alla volta: dentro il vetro una seconda finestra resterebbe intrappolata.
  if (annullando) {
    return (
      <Modale titolo="Cancel this gift card?" sottotitolo={`Its balance of ${euro(carta.saldo)} drops to zero and it can't be reactivated.`} onChiudi={() => setAnnullando(false)}>
        <form className="modulo" onSubmit={inviaAnnullamento}>
          <Campo etichetta="Reason">
            <input required minLength={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Campo>
          {annulla.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{annulla.error.message}</p> : null}
          <div className="riga__azioni sc-piede">
            <button type="button" onClick={() => setAnnullando(false)}>Go back</button>
            <button type="submit" className="primario" disabled={annulla.isPending}>Confirm cancellation</button>
          </div>
        </form>
      </Modale>
    )
  }
  if (eliminando) {
    return <Conferma titolo="Delete this gift card?" testo="It leaves the list along with its activity." azione="Delete" attesa={elimina.isPending} onConferma={() => elimina.mutate()} onChiudi={() => setEliminando(false)} />
  }

  return (
    <Modale titolo="Gift card" sottotitolo={`Issued ${dataBreve(carta.creata_il)}`} onChiudi={onChiudi}>
      <div className="sc-carta-testa">
        <code className="sc-codice sc-codice--grande">{carta.codice}</code>
        <CopiaCodice codice={carta.codice} />
        <Etichetta tono={stato.tono}>{stato.testo}</Etichetta>
      </div>

      <dl className="sc-dati">
        <div><dt>Balance</dt><dd>{euro(carta.saldo)}</dd></div>
        <div><dt>Original amount</dt><dd>{euro(carta.importo_iniziale)}</dd></div>
        <div><dt>Expires</dt><dd>{carta.scadenza ? dataBreve(carta.scadenza) : "Never"}</dd></div>
        <div><dt>Recipient</dt><dd>{carta.destinatario_nome ?? carta.destinatario_email ?? "Unassigned"}</dd></div>
      </dl>
      {carta.nota ? <p className="sc-nota">{carta.nota}</p> : null}
      {carta.motivo_annullamento ? <p className="avviso-stato avviso-stato--errore">Cancelled: {carta.motivo_annullamento}</p> : null}

      <section aria-label="Activity">
        <h3 className="sc-titoletto">Activity</h3>
        <ul className="sc-movimenti">
          {carta.movimenti.map((m) => (
            <li key={m.id}>
              <div>
                <strong>{TIPI_MOVIMENTO[m.tipo]}</strong>
                <small>{dataOra(m.quando)} · {m.attore}</small>
                {m.nota ? <small>{m.nota}</small> : null}
              </div>
              <div className="sc-movimenti__importi">
                <strong>{segno(m.importo)}</strong>
                <small>Balance {euro(m.saldo_dopo)}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {gestisce && !annullata ? (
        <form className="modulo" onSubmit={inviaRettifica} aria-label="Adjust balance">
          <h3 className="sc-titoletto">Adjust balance</h3>
          <div className="griglia-due sc-griglia">
            <Campo etichetta="Change in balance" aiuto="Negative to take off, positive to add.">
              <input type="number" required step="0.01" inputMode="decimal" value={rettifica.importo} onChange={(e) => setRettifica({ ...rettifica, importo: e.target.value })} />
            </Campo>
            <Campo etichetta="Reason">
              <input required minLength={3} maxLength={500} value={rettifica.nota} onChange={(e) => setRettifica({ ...rettifica, nota: e.target.value })} />
            </Campo>
          </div>
          {salvaRettifica.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salvaRettifica.error.message}</p> : null}
          <button type="submit" disabled={salvaRettifica.isPending}>Record adjustment</button>
        </form>
      ) : null}

      {gestisce ? (
        <div className="riga__azioni">
          {annullata ? (
            <button type="button" className="pericolo" onClick={() => setEliminando(true)}>Delete from list</button>
          ) : (
            <button type="button" className="pericolo" onClick={() => setAnnullando(true)}>Cancel gift card</button>
          )}
        </div>
      ) : null}
    </Modale>
  )
}
