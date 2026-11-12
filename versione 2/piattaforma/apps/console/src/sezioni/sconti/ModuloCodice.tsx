import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, CopyPlus, Sparkles, Trash2 } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { Interruttore, useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Modale } from "../../ui"
import { fineGiorno, inizioGiorno, numeroDa, perCampoData } from "./testi"
import type { Codice, TipoSconto } from "./tipi"

function suggerisci(): string {
  const [numero] = crypto.getRandomValues(new Uint16Array(1))
  return `ISHTAR${String(1000 + (numero % 9000))}`
}

type Proprieta = { codice?: Codice; onChiudi: () => void; onDuplica?: (codice: Codice) => void; onElimina?: (codice: Codice) => void }

export function ModuloCodice({ codice, onChiudi, onDuplica, onElimina }: Proprieta) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const { puo } = usePermessi()
  const [dati, setDati] = useState({
    codice: codice?.codice ?? "",
    descrizione: codice?.descrizione ?? "",
    tipo: codice?.tipo ?? ("percentuale" as TipoSconto),
    valore: codice?.valore === null || codice?.valore === undefined ? "10" : String(codice.valore),
    limite: codice?.limite_usi ? String(codice.limite_usi) : "",
    inizio: perCampoData(codice?.inizio ?? null),
    fine: perCampoData(codice?.fine ?? null),
    attivo: true,
  })
  const aggiorna = (chiave: "descrizione" | "valore" | "limite" | "inizio" | "fine") => (e: { target: { value: string } }) =>
    setDati({ ...dati, [chiave]: e.target.value })
  const suProdotti = Boolean(codice?.prodotti)
  const pulito = dati.codice.replace(/\s+/g, "")

  const salva = useMutation({
    mutationFn: () =>
      api(codice ? `/admin/sconti/codici/${codice.id}` : "/admin/sconti/codici", {
        corpo: {
          codice: pulito,
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
      avvisa(codice ? `${pulito} updated` : dati.attivo ? `${pulito} is live at checkout` : `${pulito} created and paused`)
      onChiudi()
    },
  })

  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  // Un errore sul codice sta sotto il suo campo; gli altri in fondo al modulo.
  const erroreCodice = salva.error && /\bcodes?\b/i.test(salva.error.message) ? salva.error.message : null

  return (
    <Modale titolo={codice ? `Edit ${codice.codice}` : "New discount code"} onChiudi={onChiudi}>
      <form className="modulo sc-modulo" onSubmit={invia}>
        {codice?.azienda ? <p className="avviso-stato">Proposed by {codice.azienda}: it applies only to the {codice.prodotti} products named in the proposal.</p> : null}
        <Campo etichetta="Code">
          <div className={`sc-campo-azione${erroreCodice ? " sc-campo-azione--errore" : ""}`}>
            <input placeholder="WINTERSALE" autoFocus aria-invalid={Boolean(erroreCodice)} value={dati.codice} onChange={(e) => setDati({ ...dati, codice: e.target.value.toUpperCase() })} />
            {codice ? null : <button type="button" onClick={() => setDati({ ...dati, codice: suggerisci() })}><Sparkles size={15} aria-hidden="true" /> Generate</button>}
          </div>
          {erroreCodice ? <small className="sc-errore" role="alert">{erroreCodice}</small> : null}
        </Campo>
        <div className="griglia-due sc-griglia">
          <Campo etichetta="Type">
            <select value={dati.tipo} onChange={(e) => setDati({ ...dati, tipo: e.target.value as TipoSconto })}>
              <option value="percentuale">Percentage off</option>
              <option value="importo">Amount off</option>
              <option value="spedizione" disabled={suProdotti}>Free postage</option>
            </select>
          </Campo>
          <Campo etichetta={dati.tipo === "importo" ? "Amount" : dati.tipo === "spedizione" ? "Value" : "Percent"}>
            {dati.tipo === "spedizione" ? (
              <input disabled value="Free" readOnly />
            ) : (
              <input type="number" required inputMode="decimal" min="0.01" max={dati.tipo === "percentuale" ? 100 : undefined} step="0.01" value={dati.valore} onChange={aggiorna("valore")} />
            )}
          </Campo>
        </div>
        <Campo etichetta="Use limit (optional)" aiuto={codice?.usi ? `Used ${codice.usi} times so far.` : undefined}>
          <input type="number" inputMode="numeric" min="1" step="1" placeholder="No limit" value={dati.limite} onChange={aggiorna("limite")} />
        </Campo>
        <div className="griglia-due sc-griglia">
          <Campo etichetta="Starts (optional)"><input type="date" value={dati.inizio} onChange={aggiorna("inizio")} /></Campo>
          <Campo etichetta="Ends (optional)"><input type="date" value={dati.fine} onChange={aggiorna("fine")} /></Campo>
        </div>
        <Campo etichetta="Note (optional)">
          <input value={dati.descrizione} maxLength={200} onChange={aggiorna("descrizione")} />
        </Campo>
        {codice ? null : (
          <div className="sc-riga-interruttore">
            <span>Live straight away</span>
            <Interruttore acceso={dati.attivo} etichetta="Live straight away" onCambia={(attivo) => setDati({ ...dati, attivo })} />
          </div>
        )}
        {salva.error && !erroreCodice ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        <div className="sc-piede">
          {codice && onElimina && puo("sconti", "manage") ? (
            <button type="button" className="icona-pulsante pericolo" aria-label={`Delete ${codice.codice}`} title="Delete" onClick={() => onElimina(codice)}><Trash2 size={16} aria-hidden="true" /></button>
          ) : null}
          {codice && onDuplica ? (
            <button type="button" className="icona-pulsante" aria-label={`Duplicate ${codice.codice}`} title="Duplicate" onClick={() => onDuplica(codice)}><CopyPlus size={16} aria-hidden="true" /></button>
          ) : null}
          <span className="spazio" />
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={salva.isPending}>
            <Check size={16} aria-hidden="true" /> {salva.isPending ? "Saving..." : codice ? "Save changes" : "Create code"}
          </button>
        </div>
      </form>
    </Modale>
  )
}
