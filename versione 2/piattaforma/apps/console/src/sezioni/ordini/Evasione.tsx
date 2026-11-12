import { useQueryClient } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import { useState } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { fa } from "../../lingua"
import { usePermessi } from "../../permessi"
import { useSessione } from "../../sessione"
import { dataBreve } from "../../ui"
import { PASSI, prossimaAzione, STATI_RICHIESTA } from "./dati"
import { Finestra, Pillola } from "./Pezzi"
import type { AzioneEvasione, Richiesta } from "./tipi"

export function percorsoAzione(admin: boolean, r: Pick<Richiesta, "ordine_id" | "azienda_id">, azione: AzioneEvasione) {
  return admin ? `/admin/evasioni/${r.ordine_id}/${r.azienda_id}/${azione}` : `/vendor/evasioni/${r.ordine_id}/${azione}`
}

const FATTI: Record<AzioneEvasione, string> = {
  conferma: "confirmed",
  prepara: "packed",
  spedisci: "shipped",
  consegna: "delivered",
  riapri: "unpacked",
}

/** Stesse azioni su ogni schermata: dopo ciascuna si riaggiornano tutti gli elenchi. */
export function useAvanza() {
  const { sessione } = useSessione()
  const { avvisa, segnalaErrore } = useAvvisi()
  const client = useQueryClient()
  const admin = sessione?.tipo === "admin"
  const [attesa, setAttesa] = useState(false)
  const esegui = async (r: Pick<Richiesta, "ordine_id" | "azienda_id" | "numero">, azione: AzioneEvasione, corpo: Record<string, string> = {}) => {
    setAttesa(true)
    try {
      await api(percorsoAzione(admin, r, azione), { corpo })
      avvisa(`#${r.numero} ${FATTI[azione]}`)
      await client.invalidateQueries({ queryKey: ["ordini"] })
      return true
    } catch (errore) {
      segnalaErrore(errore)
      return false
    } finally {
      setAttesa(false)
    }
  }
  return { esegui, attesa, admin }
}

export function ModuloSpedizione({ richiesta, onChiudi }: { richiesta: Richiesta; onChiudi: () => void }) {
  const { esegui, attesa, admin } = useAvanza()
  const [corriere, setCorriere] = useState("")
  const [tracking, setTracking] = useState("")
  const [link, setLink] = useState("")
  return (
    <Finestra titolo="Mark shipped" sottotitolo={`Order #${richiesta.numero} · ${richiesta.azienda}`} onChiudi={onChiudi}>
      <>
        <form
          className="ord-modulo"
          onSubmit={(e) => {
            e.preventDefault()
            void esegui(richiesta, "spedisci", { corriere, tracking, tracking_url: link }).then((ok) => ok && onChiudi())
          }}
        >
          <label className="ord-campo"><span>Carrier</span><input value={corriere} maxLength={80} onChange={(e) => setCorriere(e.target.value)} /></label>
          <label className="ord-campo"><span>Tracking number</span><input value={tracking} required={!admin} maxLength={120} onChange={(e) => setTracking(e.target.value)} /></label>
          <label className="ord-campo"><span>Tracking link</span><input type="url" value={link} maxLength={500} placeholder="https://" onChange={(e) => setLink(e.target.value)} /></label>
          <div className="ord-piede-modulo">
            <button type="button" className="ord-btn" onClick={onChiudi}>Cancel</button>
            <button type="submit" className="ord-btn ord-btn--primario" disabled={attesa}>Mark shipped</button>
          </div>
        </form>
      </>
    </Finestra>
  )
}

const scritta = (r: Richiesta) => {
  if (!r.scadenza) return null
  if (r.in_ritardo) return `Late: was due ${dataBreve(r.scadenza)}`
  return ["da_confermare", "confermata", "preparata"].includes(r.stato) ? `Due ${fa(r.scadenza)}` : null
}

/** La richiesta di una azienda dentro la scheda ordine. */
export function BloccoRichiesta({ richiesta: r }: { richiesta: Richiesta }) {
  const { puo } = usePermessi()
  const { esegui, attesa } = useAvanza()
  const [spedisco, setSpedisco] = useState(false)
  const stato = STATI_RICHIESTA[r.stato]
  const azione = prossimaAzione(r.stato)
  const scrive = puo("evasioni", "edit")
  const scadenza = scritta(r)
  const pezzi = r.righe.reduce((s, x) => s + x.quantita, 0)
  return (
    <article className={r.in_ritardo ? "ord-richiesta ord-richiesta--ritardo" : "ord-richiesta"}>
      <header>
        <span>
          <b>{r.azienda}</b>
          <small>#{r.numero} · {pezzi} {pezzi === 1 ? "item" : "items"}{scadenza ? ` · ${scadenza}` : ""}</small>
        </span>
        <Pillola tono={stato.tono}>{stato.testo}</Pillola>
      </header>
      {r.colli.filter((c) => c.tracking).map((c) => (
        <p key={c.id} className="ord-tracking">
          {[c.corriere, c.tracking].filter(Boolean).join(" · ")}
          {c.tracking_url ? <a href={c.tracking_url} target="_blank" rel="noreferrer" aria-label="Open the tracking page"><ExternalLink size={14} aria-hidden="true" /></a> : null}
        </p>
      ))}
      {scrive && (azione || r.stato === "preparata") ? (
        <footer>
          {r.stato === "preparata" ? <button type="button" className="ord-btn ord-btn--s ord-btn--fantasma" disabled={attesa} onClick={() => void esegui(r, "riapri")}>{PASSI.riapri}</button> : null}
          {azione ? (
            <button type="button" className="ord-btn ord-btn--s" disabled={attesa} onClick={() => (azione === "spedisci" ? setSpedisco(true) : void esegui(r, azione))}>{PASSI[azione]}</button>
          ) : null}
        </footer>
      ) : null}
      {spedisco ? <ModuloSpedizione richiesta={r} onChiudi={() => setSpedisco(false)} /> : null}
    </article>
  )
}
