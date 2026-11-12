import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Send } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { useSessione } from "../../sessione"
import { Campo } from "../../ui"
import { CATEGORIE } from "./tipi"

const VUOTO = { oggetto: "", categoria: "ordini", testo: "" }

/** Apertura di una richiesta: sta nella pagina Help e nella finestra dell'elenco. */
export function ModuloRichiesta({ onInviata }: { onInviata?: () => void }) {
  const { sessione } = useSessione()
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [dati, setDati] = useState(VUOTO)
  const base = sessione?.tipo === "admin" ? "/admin" : "/vendor"

  const crea = useMutation({
    mutationFn: () => api<{ richiesta: { id: string; codice: string } }>(`${base}/assistenza/richieste`, { corpo: dati }),
    onSuccess: ({ richiesta }) => {
      avvisa(`${richiesta.codice} sent`)
      setDati(VUOTO)
      void client.invalidateQueries({ queryKey: ["assistenza"] })
      void client.invalidateQueries({ queryKey: ["avvisi"] })
      onInviata?.()
    },
    onError: segnalaErrore,
  })
  // Come nel pannello, senza oggetto o testo l'invio non parte e non compare alcun messaggio.
  const invia = (e: FormEvent) => {
    e.preventDefault()
    if (dati.oggetto.trim() && dati.testo.trim()) crea.mutate()
  }

  return (
    <form className="modulo" noValidate onSubmit={invia}>
      <Campo etichetta="Subject">
        <input maxLength={160} value={dati.oggetto} onChange={(e) => setDati({ ...dati, oggetto: e.target.value })} />
      </Campo>
      <Campo etichetta="Topic">
        <select value={dati.categoria} onChange={(e) => setDati({ ...dati, categoria: e.target.value })}>
          {Object.entries(CATEGORIE).map(([valore, nome]) => <option key={valore} value={valore}>{nome}</option>)}
        </select>
      </Campo>
      <Campo etichetta="Describe the problem">
        <textarea rows={5} maxLength={5000} value={dati.testo} onChange={(e) => setDati({ ...dati, testo: e.target.value })} />
      </Campo>
      <div className="impostazioni-piede-assistenza">
        <button type="submit" className="primario" disabled={crea.isPending}>
          <Send size={16} aria-hidden="true" /> {crea.isPending ? "Sending..." : "Send request"}
        </button>
      </div>
    </form>
  )
}
