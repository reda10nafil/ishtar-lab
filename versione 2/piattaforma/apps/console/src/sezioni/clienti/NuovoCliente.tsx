import { useMutation } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { Campo, Modale } from "../../ui"
import { useAggiornaClienti } from "./dati"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Il nome intero si divide alla prima parola: il resto dei dati si completa dalla scheda. */
const dividiNome = (intero: string) => {
  const [nome, ...resto] = intero.trim().split(/\s+/)
  return { nome: nome ?? "", cognome: resto.join(" ") }
}

export default function NuovoCliente({ onChiudi, onCreato }: { onChiudi: () => void; onCreato: (id: string) => void }) {
  const aggiorna = useAggiornaClienti()
  const { avvisa } = useAvvisi()
  const [intero, setIntero] = useState("")
  const [email, setEmail] = useState("")
  const [citta, setCitta] = useState("")
  const [newsletter, setNewsletter] = useState("no")
  const [errori, setErrori] = useState<{ nome?: string; email?: string }>({})

  const salva = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/admin/clienti", {
        corpo: { ...dividiNome(intero), email, citta: citta.trim() || undefined, newsletter: newsletter === "si" },
      }),
    onSuccess: ({ id }) => {
      void aggiorna()
      avvisa(`${intero.trim()} added`)
      onChiudi()
      onCreato(id)
    },
  })

  const invia = (e: FormEvent) => {
    e.preventDefault()
    const trovati = {
      nome: intero.trim() ? undefined : "Enter a name",
      email: EMAIL.test(email.trim()) ? undefined : "That email address doesn't look right",
    }
    setErrori(trovati)
    if (!trovati.nome && !trovati.email) salva.mutate()
  }

  return (
    <Modale titolo="New customer" onChiudi={onChiudi}>
      <form className="modulo cli-modale" noValidate onSubmit={invia}>
        <Campo etichetta="Full name">
          <input autoFocus maxLength={200} autoComplete="off" aria-invalid={Boolean(errori.nome)} value={intero} onChange={(e) => setIntero(e.target.value)} />
          {errori.nome ? <small className="cli-errore" role="alert">{errori.nome}</small> : null}
        </Campo>
        <Campo etichetta="Email">
          <input type="email" autoComplete="off" aria-invalid={Boolean(errori.email)} value={email} onChange={(e) => setEmail(e.target.value)} />
          {errori.email ? <small className="cli-errore" role="alert">{errori.email}</small> : null}
        </Campo>
        <div className="griglia-due">
          <Campo etichetta="Town">
            <input maxLength={100} autoComplete="off" value={citta} onChange={(e) => setCitta(e.target.value)} />
          </Campo>
          <Campo etichetta="Newsletter">
            <select value={newsletter} onChange={(e) => setNewsletter(e.target.value)}>
              <option value="no">Not subscribed</option>
              <option value="si">Subscribed</option>
            </select>
          </Campo>
        </div>
        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        <div className="cli-piede-modulo">
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={salva.isPending}>
            <Check size={16} aria-hidden="true" /> {salva.isPending ? "Adding..." : "Add customer"}
          </button>
        </div>
      </form>
    </Modale>
  )
}
