import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { useAggiorna } from "./dati"
import { Finestra, Mini } from "./Pezzi"
import type { Scheda } from "./tipi"

export type MotivoReso = { id: string; label: string; value: string }

/** Un reso torna a una sola azienda: si sceglie quale parte dell'ordine rientra. */
export default function ModuloReso({ ordine, onChiudi }: { ordine: Scheda; onChiudi: () => void }) {
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiorna()
  const naviga = useNavigate()
  const motivi = useQuery({ queryKey: ["ordini", "motivi"], queryFn: () => api<{ return_reasons: MotivoReso[] }>("/admin/return-reasons?limit=100") })
  const richieste = useMemo(
    () => ordine.richieste.filter((r) => r.righe.some((x) => x.spedite - x.in_reso - x.rese > 0)),
    [ordine]
  )
  const [richiesta, setRichiesta] = useState(richieste[0]?.id ?? "")
  const [quantita, setQuantita] = useState<Record<string, number>>({})
  const [motivo, setMotivo] = useState("")
  const [nota, setNota] = useState("")
  const [attesa, setAttesa] = useState(false)
  const scelta = richieste.find((r) => r.id === richiesta)
  const righe = scelta?.righe.filter((x) => x.spedite - x.in_reso - x.rese > 0) ?? []
  const pronte = Object.entries(quantita).filter(([id, q]) => q > 0 && righe.some((r) => r.id === id))

  const invia = async () => {
    setAttesa(true)
    try {
      await api("/admin/ordini/resi", {
        corpo: { ordine_id: scelta?.ordine_id, motivo_id: motivo || undefined, nota: nota.trim() || undefined, righe: pronte.map(([id, q]) => ({ id, quantita: q })) },
      })
      avvisa("Return started")
      await aggiorna()
      onChiudi()
      naviga("/ordini/resi")
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setAttesa(false)
    }
  }

  return (
    <Finestra titolo="Start a return" sottotitolo={`Order #${ordine.numero}: each item goes back to the company that shipped it.`} onChiudi={onChiudi}>
      <>
        <form
          className="ord-griglia-modulo"
          onSubmit={(e) => {
            e.preventDefault()
            void invia()
          }}
        >
          {richieste.length > 1 ? (
            <label className="ord-campo ord-tutta">
              <span>Company</span>
              <select value={richiesta} onChange={(e) => { setRichiesta(e.target.value); setQuantita({}) }}>
                {richieste.map((r) => <option key={r.id} value={r.id}>{r.azienda}</option>)}
              </select>
            </label>
          ) : null}
          <div className="ord-campo ord-tutta">
            <span>Items</span>
            <div className="ord-righe ord-righe--modulo">
              {righe.map((r) => {
                const massimo = r.spedite - r.in_reso - r.rese
                return (
                  <div key={r.id} className="ord-riga ord-riga--s">
                    <Mini url={r.miniatura} titolo={r.titolo} />
                    <span className="ord-riga__testo"><b>{r.titolo}</b><small>{[r.variante, `${massimo} can be returned`].filter(Boolean).join(" · ")}</small></span>
                    <input type="number" min={0} max={massimo} value={quantita[r.id] ?? 0} aria-label={`Quantity of ${r.titolo} to return`} onChange={(e) => setQuantita({ ...quantita, [r.id]: Math.min(massimo, Math.max(0, Number(e.target.value) || 0)) })} />
                  </div>
                )
              })}
            </div>
          </div>
          <label className="ord-campo ord-tutta">
            <span>Reason</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="">{motivi.data?.return_reasons.length ? "Choose a reason…" : "No reasons yet: add them in Returns"}</option>
              {motivi.data?.return_reasons.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label className="ord-campo ord-tutta"><span>Note</span><input value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} /></label>
          <div className="ord-piede-modulo ord-tutta">
            <button type="button" className="ord-btn" onClick={onChiudi}>Cancel</button>
            <button type="submit" className="ord-btn ord-btn--primario" disabled={attesa || !pronte.length}>Start return</button>
          </div>
        </form>
      </>
    </Finestra>
  )
}
