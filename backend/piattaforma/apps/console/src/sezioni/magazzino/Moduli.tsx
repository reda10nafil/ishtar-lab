import { useMutation } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { api, ErroreApi } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { Campo, Modale } from "../../ui"
import { MOTIVI, useAggiornaMagazzino, useMagazzino } from "./dati"
import type { Riga } from "./tipi"

const nomeRiga = (r: Riga) => [r.prodotto, r.variante].filter(Boolean).join(" · ")

const Errore = ({ errore }: { errore: Error | null }) =>
  errore ? <p className="avviso-stato avviso-stato--errore" role="alert">{errore.message}</p> : null

export function ModuloCorrezione({ riga, onChiudi }: { riga: Riga; onChiudi: () => void }) {
  const aggiorna = useAggiornaMagazzino()
  const { avvisa } = useAvvisi()
  const [modo, setModo] = useState<"quantita" | "variazione">("quantita")
  const [valore, setValore] = useState("")
  const [motivo, setMotivo] = useState("rifornimento")
  const [nota, setNota] = useState("")
  // Giacenza mostrata all'apertura: una «New quantity» si scrive solo se è ancora questa (altrimenti 412, e la finestra
  // passa a quella attuale).
  const [giacenza, setGiacenza] = useState(riga.giacenza)
  // Stessa correzione, stesso id: rimandata dopo una risposta persa non conta due volte.
  const [ids] = useState(() => new Map<string, string>())
  const idPer = (chiave: string) => {
    if (!ids.has(chiave)) ids.set(chiave, crypto.randomUUID().replaceAll("-", ""))
    return ids.get(chiave)!
  }
  const finale = modo === "quantita" ? Number(valore) : giacenza + Number(valore)

  const salva = useMutation({
    mutationFn: () =>
      api(`/vendor/magazzino/articoli/${riga.articolo_id}/correzione`, {
        corpo: {
          deposito_id: riga.deposito_id,
          [modo]: Number(valore),
          ...(modo === "quantita" ? { prima: giacenza } : {}),
          id: idPer(`${modo}:${valore}`),
          motivo,
          nota: nota.trim() || undefined,
        },
      }),
    onSuccess: () => {
      void aggiorna()
      avvisa("Quantity updated")
      onChiudi()
    },
    onError: (errore) => {
      // Giacenza cambiata altrove (una vendita, un'altra correzione): niente salvato. La finestra resta aperta con la
      // giacenza attuale, che diventa quella di partenza; quantità, motivo e nota restano per salvare di nuovo.
      if (errore instanceof ErroreApi && errore.stato === 412) {
        const attuale = (errore.dettagli as { conflitti?: { attuale?: unknown }[] } | undefined)?.conflitti?.[0]?.attuale
        if (typeof attuale === "number") setGiacenza(attuale)
        void aggiorna()
      }
    },
  })
  const conflitto = salva.error instanceof ErroreApi && salva.error.stato === 412

  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <Modale titolo="Adjust quantity" sottotitolo={`${nomeRiga(riga)}: ${numero(giacenza)} in stock now`} onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <div className="selettore selettore--stretto" role="group" aria-label="How to enter the adjustment">
          <button type="button" className={modo === "quantita" ? "attivo" : undefined} onClick={() => { setModo("quantita"); setValore("") }}>New quantity</button>
          <button type="button" className={modo === "variazione" ? "attivo" : undefined} onClick={() => { setModo("variazione"); setValore("") }}>Change</button>
        </div>
        {modo === "quantita" ? (
          <Campo etichetta="New quantity" aiuto="The units physically in the warehouse.">
            <input type="number" required min={0} step={1} inputMode="numeric" value={valore} onChange={(e) => setValore(e.target.value)} />
          </Campo>
        ) : (
          <Campo etichetta="Units added or removed" aiuto={valore ? `Stock will become ${numero(finale)}` : "For example 10 or -3."}>
            <input type="number" required step={1} value={valore} onChange={(e) => setValore(e.target.value)} />
          </Campo>
        )}
        <Campo etichetta="Reason">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVI.map((m) => <option key={m.valore} value={m.valore}>{m.testo}</option>)}
          </select>
        </Campo>
        <Campo etichetta="Note">
          <textarea rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        <Errore errore={salva.error && conflitto ? new Error(`${salva.error.message} Check the quantity and save again.`) : salva.error} />
        <button className="primario" type="submit" disabled={salva.isPending}>{salva.isPending ? "Saving..." : "Save adjustment"}</button>
      </form>
    </Modale>
  )
}

export function ModuloRiserva({ riga, onChiudi }: { riga: Riga; onChiudi: () => void }) {
  const aggiorna = useAggiornaMagazzino()
  const { avvisa } = useAvvisi()
  const [quantita, setQuantita] = useState("1")
  const [descrizione, setDescrizione] = useState("")

  const salva = useMutation({
    mutationFn: () =>
      api("/admin/magazzino/riserve", {
        corpo: { articolo_id: riga.articolo_id, deposito_id: riga.deposito_id, quantita: Number(quantita), descrizione: descrizione.trim() || undefined },
      }),
    onSuccess: () => {
      void aggiorna()
      avvisa("Units set aside")
      onChiudi()
    },
  })

  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <Modale titolo="Set aside" sottotitolo={`${nomeRiga(riga)}: ${numero(riga.disponibili)} available`} onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Quantity">
          <input type="number" required min={1} max={riga.disponibili} step={1} inputMode="numeric" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
        </Campo>
        <Campo etichetta="Description" aiuto="Who or what the units are set aside for.">
          <input maxLength={200} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </Campo>
        <Errore errore={salva.error} />
        <button className="primario" type="submit" disabled={salva.isPending}>{salva.isPending ? "Saving..." : "Save reservation"}</button>
      </form>
    </Modale>
  )
}

/** Vuoto significa nessuna soglia propria: l'articolo usa quella dell'azienda o la predefinita. */
export function ModuloSoglia({ articoloId, attuale, onChiudi }: { articoloId: string; attuale: number | null; onChiudi: () => void }) {
  const { base } = useMagazzino()
  const aggiorna = useAggiornaMagazzino()
  const { avvisa } = useAvvisi()
  const [valore, setValore] = useState(attuale === null ? "" : String(attuale))

  const salva = useMutation({
    mutationFn: () => api(`${base}/articoli/${articoloId}/soglia`, { corpo: { soglia: valore.trim() === "" ? null : Number(valore) } }),
    onSuccess: () => {
      void aggiorna()
      avvisa("Safety stock updated")
      onChiudi()
    },
  })

  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <Modale titolo="Safety stock for this item" sottotitolo="Leave empty to use the company level." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Safety stock">
          <input type="number" min={0} step={1} inputMode="numeric" value={valore} onChange={(e) => setValore(e.target.value)} />
        </Campo>
        <Errore errore={salva.error} />
        <button className="primario" type="submit" disabled={salva.isPending}>{salva.isPending ? "Saving..." : "Save safety stock"}</button>
      </form>
    </Modale>
  )
}
