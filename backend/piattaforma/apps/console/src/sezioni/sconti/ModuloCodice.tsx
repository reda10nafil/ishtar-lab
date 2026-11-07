import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Sparkles } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { Interruttore, useAvvisi } from "../../componenti"
import { Campo, Modale } from "../../ui"
import { fineGiorno, inizioGiorno, numeroDa, perCampoData } from "./testi"
import type { Codice, TipoSconto } from "./tipi"

const SEGNI = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function suggerisci(): string {
  const casuali = crypto.getRandomValues(new Uint8Array(8))
  return `OFFER-${[...casuali].map((byte) => SEGNI[byte % SEGNI.length]).join("")}`
}

export function ModuloCodice({ codice, onChiudi }: { codice?: Codice; onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const [dati, setDati] = useState({
    codice: codice?.codice ?? "",
    descrizione: codice?.descrizione ?? "",
    tipo: codice?.tipo ?? ("percentuale" as TipoSconto),
    valore: codice?.valore === null || codice?.valore === undefined ? "" : String(codice.valore),
    limite: codice?.limite_usi ? String(codice.limite_usi) : "",
    inizio: perCampoData(codice?.inizio ?? null),
    fine: perCampoData(codice?.fine ?? null),
    attivo: true,
  })
  const aggiorna = (chiave: "descrizione" | "valore" | "limite" | "inizio" | "fine") => (e: { target: { value: string } }) =>
    setDati({ ...dati, [chiave]: e.target.value })
  const suProdotti = Boolean(codice?.prodotti)

  const salva = useMutation({
    mutationFn: () =>
      api(codice ? `/admin/sconti/codici/${codice.id}` : "/admin/sconti/codici", {
        corpo: {
          codice: dati.codice,
          descrizione: dati.descrizione || null,
          tipo: dati.tipo,
          valore: dati.tipo === "spedizione" ? null : numeroDa(dati.valore),
          limite_usi: numeroDa(dati.limite),
          inizio: inizioGiorno(dati.inizio),
          fine: fineGiorno(dati.fine),
          ...(codice ? {} : { attivo: dati.attivo }),
        },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["sconti"] })
      avvisa(codice ? "Discount updated" : "Discount created")
      onChiudi()
    },
  })

  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <Modale titolo={codice ? `Edit ${codice.codice}` : "New discount code"} onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        {codice?.azienda ? <p className="avviso-stato">Proposed by {codice.azienda}: it applies only to the {codice.prodotti} products named in the proposal.</p> : null}
        <Campo etichetta="Code" aiuto="3 to 40 characters: letters, numbers and hyphens.">
          <div className="sc-campo-azione">
            <input required value={dati.codice} onChange={(e) => setDati({ ...dati, codice: e.target.value.toUpperCase() })} />
            {codice ? null : <button type="button" onClick={() => setDati({ ...dati, codice: suggerisci() })}><Sparkles size={15} aria-hidden="true" /> Generate</button>}
          </div>
        </Campo>
        <div className="griglia-due sc-griglia">
          <Campo etichetta="Type">
            <select value={dati.tipo} onChange={(e) => setDati({ ...dati, tipo: e.target.value as TipoSconto })}>
              <option value="percentuale">Percentage off</option>
              <option value="importo">Fixed amount off</option>
              <option value="spedizione" disabled={suProdotti}>Free shipping</option>
            </select>
          </Campo>
          {dati.tipo === "spedizione" ? (
            <p className="sc-spiega">Takes the shipping charge off the order.</p>
          ) : (
            <Campo etichetta={dati.tipo === "importo" ? "Amount" : "Percent"}>
              <input type="number" required inputMode="decimal" min="0.01" max={dati.tipo === "percentuale" ? 100 : undefined} step="0.01" value={dati.valore} onChange={aggiorna("valore")} />
            </Campo>
          )}
        </div>
        <Campo etichetta="Use limit (optional)" aiuto={codice?.usi ? `Used ${codice.usi} times so far.` : undefined}>
          <input type="number" inputMode="numeric" min="1" step="1" placeholder="No limit" value={dati.limite} onChange={aggiorna("limite")} />
        </Campo>
        <div className="griglia-due sc-griglia">
          <Campo etichetta="Starts (optional)"><input type="date" value={dati.inizio} onChange={aggiorna("inizio")} /></Campo>
          <Campo etichetta="Ends (optional)"><input type="date" value={dati.fine} onChange={aggiorna("fine")} /></Campo>
        </div>
        <Campo etichetta="Note (optional)" aiuto="Only you see this.">
          <input value={dati.descrizione} maxLength={200} onChange={aggiorna("descrizione")} />
        </Campo>
        {codice ? null : (
          <div className="sc-riga-interruttore">
            <span>Live straight away</span>
            <Interruttore acceso={dati.attivo} etichetta="Live straight away" onCambia={(attivo) => setDati({ ...dati, attivo })} />
          </div>
        )}
        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        <div className="riga__azioni sc-piede">
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={salva.isPending}>
            <Check size={16} aria-hidden="true" /> {salva.isPending ? "Saving..." : codice ? "Save changes" : "Create code"}
          </button>
        </div>
      </form>
    </Modale>
  )
}
