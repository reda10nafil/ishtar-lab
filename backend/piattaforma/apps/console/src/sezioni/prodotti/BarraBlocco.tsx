import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { useAggiornaCatalogo, useCollezioni } from "./dati"

type Azione = { azione: "pubblica" | "bozza" | "collezione"; collezione_id?: string | null }
type Esito = { aggiornati: number; saltati: number }

const NESSUNA = "nessuna"
const prodotti = (quanti: number) => `${numero(quanti)} ${quanti === 1 ? "product" : "products"}`

export function BarraBlocco({ scelti, onFatto }: { scelti: string[]; onFatto: () => void }) {
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiornaCatalogo()
  const collezioni = useCollezioni()
  const [collezione, setCollezione] = useState("")

  const esegui = useMutation({
    mutationFn: (azione: Azione) => api<Esito>("/admin/catalogo/blocco", { corpo: { ...azione, ids: scelti } }),
    onSuccess: ({ aggiornati, saltati }) => {
      avvisa(saltati ? `${prodotti(aggiornati)} updated, ${numero(saltati)} left as they were` : `${prodotti(aggiornati)} updated`)
      aggiorna()
      onFatto()
    },
    onError: segnalaErrore,
  })

  return (
    <div className="barra-blocco vetro" role="group" aria-label="Actions on selected products">
      <strong>{numero(scelti.length)} selected</strong>
      <button type="button" className="primario" disabled={esegui.isPending} onClick={() => esegui.mutate({ azione: "pubblica" })}>Publish</button>
      <button type="button" disabled={esegui.isPending} onClick={() => esegui.mutate({ azione: "bozza" })}>Back to draft</button>
      {collezioni.data ? (
        <span className="barra-blocco__gruppo">
          <select className="filtro-tendina" aria-label="Collection to assign" value={collezione} onChange={(e) => setCollezione(e.target.value)}>
            <option value="">Choose a collection</option>
            <option value={NESSUNA}>No collection</option>
            {collezioni.data.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button type="button" disabled={!collezione || esegui.isPending} onClick={() => esegui.mutate({ azione: "collezione", collezione_id: collezione === NESSUNA ? null : collezione })}>Assign</button>
        </span>
      ) : null}
      <span className="spazio" />
      <button type="button" onClick={onFatto}>Clear selection</button>
    </div>
  )
}
