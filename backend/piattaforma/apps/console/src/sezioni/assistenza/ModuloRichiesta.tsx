import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Send } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { useSessione } from "../../sessione"
import { Campo } from "../../ui"
import { CATEGORIE } from "./tipi"

/** Apertura di una richiesta: sta nella pagina Help e nella finestra dell'elenco. */
export function ModuloRichiesta() {
  const { sessione } = useSessione()
  const client = useQueryClient()
  const naviga = useNavigate()
  const { segnalaErrore } = useAvvisi()
  const [dati, setDati] = useState({ oggetto: "", categoria: "prodotti", testo: "" })
  const base = sessione?.tipo === "admin" ? "/admin" : "/vendor"

  const crea = useMutation({
    mutationFn: () => api<{ richiesta: { id: string } }>(`${base}/assistenza/richieste`, { corpo: dati }),
    onSuccess: ({ richiesta }) => {
      void client.invalidateQueries({ queryKey: ["assistenza"] })
      void client.invalidateQueries({ queryKey: ["avvisi"] })
      naviga(`/assistenza/richieste/${richiesta.id}`)
    },
    onError: segnalaErrore,
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    crea.mutate()
  }

  return (
    <form className="modulo" onSubmit={invia}>
      <Campo etichetta="Subject">
        <input required maxLength={160} value={dati.oggetto} onChange={(e) => setDati({ ...dati, oggetto: e.target.value })} />
      </Campo>
      <Campo etichetta="Topic">
        <select value={dati.categoria} onChange={(e) => setDati({ ...dati, categoria: e.target.value })}>
          {Object.entries(CATEGORIE).map(([valore, nome]) => <option key={valore} value={valore}>{nome}</option>)}
        </select>
      </Campo>
      <Campo etichetta="Describe the problem">
        <textarea required rows={5} maxLength={5000} value={dati.testo} onChange={(e) => setDati({ ...dati, testo: e.target.value })} />
      </Campo>
      <div className="impostazioni-piede-assistenza">
        <button type="submit" className="primario" disabled={crea.isPending}>
          <Send size={16} aria-hidden="true" /> {crea.isPending ? "Sending..." : "Send request"}
        </button>
      </div>
    </form>
  )
}
