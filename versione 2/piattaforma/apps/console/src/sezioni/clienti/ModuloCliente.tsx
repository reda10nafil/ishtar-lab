import { useMutation } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { Interruttore, useAvvisi } from "../../componenti"
import { Campo, Modale } from "../../ui"
import { useAggiornaClienti } from "./dati"
import type { Cliente } from "./tipi"

type Proprieta = { cliente?: Cliente; onChiudi: () => void; onCreato?: (id: string) => void }

/** Lo stesso modulo crea e modifica: con `cliente` parte dai dati già salvati. */
export default function ModuloCliente({ cliente, onChiudi, onCreato }: Proprieta) {
  const aggiorna = useAggiornaClienti()
  const { avvisa } = useAvvisi()
  const [nome, setNome] = useState(cliente?.nome ?? "")
  const [cognome, setCognome] = useState(cliente?.cognome ?? "")
  const [email, setEmail] = useState(cliente?.email ?? "")
  const [telefono, setTelefono] = useState(cliente?.telefono ?? "")
  const [azienda, setAzienda] = useState(cliente?.azienda ?? "")
  const [note, setNote] = useState(cliente?.note ?? "")
  const [newsletter, setNewsletter] = useState(cliente?.newsletter ?? false)
  const [rivenditore, setRivenditore] = useState(cliente?.rivenditore ?? false)

  const salva = useMutation({
    mutationFn: () => {
      const corpo = { nome, cognome, email, telefono, azienda, note, newsletter, rivenditore }
      return cliente ? api<{ id: string }>(`/admin/clienti/${cliente.id}`, { corpo }) : api<{ id: string }>("/admin/clienti", { corpo })
    },
    onSuccess: ({ id }) => {
      void aggiorna()
      avvisa(cliente ? "Customer updated" : "Customer added")
      onChiudi()
      if (!cliente) onCreato?.(id)
    },
  })

  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <Modale titolo={cliente ? "Edit customer" : "Add customer"} sottotitolo={cliente ? undefined : "Only first name and email are required."} onChiudi={onChiudi}>
      <form className="modulo cli-modale" onSubmit={invia}>
        <div className="griglia-due">
          <Campo etichetta="First name">
            <input required maxLength={100} autoComplete="off" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo etichetta="Last name">
            <input maxLength={100} autoComplete="off" value={cognome} onChange={(e) => setCognome(e.target.value)} />
          </Campo>
        </div>
        <div className="griglia-due">
          <Campo etichetta="Email">
            <input type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Campo etichetta="Phone">
            <input type="tel" maxLength={40} autoComplete="off" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Campo>
        </div>
        <Campo etichetta="Company name">
          <input maxLength={150} value={azienda} onChange={(e) => setAzienda(e.target.value)} />
        </Campo>
        <div className="cli-scelta">
          <span>
            <strong>Newsletter consent</strong>
            <small>Only if the customer agreed: the date is kept on record.</small>
          </span>
          <Interruttore acceso={newsletter} etichetta="Newsletter consent" onCambia={setNewsletter} />
        </div>
        <div className="cli-scelta">
          <span>
            <strong>Stockist</strong>
            <small>Buys to resell.</small>
          </span>
          <Interruttore acceso={rivenditore} etichetta="Stockist" onCambia={setRivenditore} />
        </div>
        <Campo etichetta="Notes">
          <textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </Campo>
        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        <button className="primario" type="submit" disabled={salva.isPending}>
          {salva.isPending ? "Saving..." : cliente ? "Save changes" : "Add customer"}
        </button>
      </form>
    </Modale>
  )
}
