import { useMutation } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { Interruttore, useAvvisi } from "../../componenti"
import { Campo, Modale } from "../../ui"
import { PAESI, nomePaese, useAggiornaClienti } from "./dati"
import type { Indirizzo } from "./tipi"

type Proprieta = { clienteId: string; indirizzo?: Indirizzo; onChiudi: () => void }

export default function ModuloIndirizzo({ clienteId, indirizzo, onChiudi }: Proprieta) {
  const aggiorna = useAggiornaClienti()
  const { avvisa } = useAvvisi()
  const [etichetta, setEtichetta] = useState(indirizzo?.etichetta ?? "")
  const [nome, setNome] = useState(indirizzo?.nome ?? "")
  const [cognome, setCognome] = useState(indirizzo?.cognome ?? "")
  const [via, setVia] = useState(indirizzo?.indirizzo ?? "")
  const [interno, setInterno] = useState(indirizzo?.indirizzo_2 ?? "")
  const [citta, setCitta] = useState(indirizzo?.citta ?? "")
  const [provincia, setProvincia] = useState(indirizzo?.provincia ?? "")
  const [cap, setCap] = useState(indirizzo?.cap ?? "")
  const [paese, setPaese] = useState(indirizzo?.paese ?? "it")
  const [telefono, setTelefono] = useState(indirizzo?.telefono ?? "")
  const [spedizione, setSpedizione] = useState(indirizzo?.predefinito_spedizione ?? false)
  const [fatturazione, setFatturazione] = useState(indirizzo?.predefinito_fatturazione ?? false)
  const paesi = PAESI.includes(paese) ? PAESI : [paese, ...PAESI]

  const salva = useMutation({
    mutationFn: () => {
      const corpo = {
        etichetta,
        nome,
        cognome,
        indirizzo: via,
        indirizzo_2: interno,
        citta,
        provincia,
        cap,
        paese,
        telefono,
        predefinito_spedizione: spedizione,
        predefinito_fatturazione: fatturazione,
      }
      const percorso = `/admin/clienti/${clienteId}/indirizzi${indirizzo ? `/${indirizzo.id}` : ""}`
      return api(percorso, { corpo })
    },
    onSuccess: () => {
      void aggiorna()
      avvisa(indirizzo ? "Address updated" : "Address added")
      onChiudi()
    },
  })

  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <Modale titolo={indirizzo ? "Edit address" : "Add address"} onChiudi={onChiudi}>
      <form className="modulo cli-modale" onSubmit={invia}>
        <Campo etichetta="Label" aiuto="For example Home or Office.">
          <input maxLength={80} value={etichetta} onChange={(e) => setEtichetta(e.target.value)} />
        </Campo>
        <div className="griglia-due">
          <Campo etichetta="Recipient first name">
            <input maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo etichetta="Recipient last name">
            <input maxLength={100} value={cognome} onChange={(e) => setCognome(e.target.value)} />
          </Campo>
        </div>
        <Campo etichetta="Street address">
          <input required maxLength={200} value={via} onChange={(e) => setVia(e.target.value)} />
        </Campo>
        <Campo etichetta="Flat or unit">
          <input maxLength={200} value={interno} onChange={(e) => setInterno(e.target.value)} />
        </Campo>
        <div className="griglia-due">
          <Campo etichetta="Town or city">
            <input required maxLength={100} value={citta} onChange={(e) => setCitta(e.target.value)} />
          </Campo>
          <Campo etichetta="County or province">
            <input maxLength={60} value={provincia} onChange={(e) => setProvincia(e.target.value)} />
          </Campo>
        </div>
        <div className="griglia-due">
          <Campo etichetta="Postcode">
            <input maxLength={16} value={cap} onChange={(e) => setCap(e.target.value)} />
          </Campo>
          <Campo etichetta="Country">
            <select value={paese} onChange={(e) => setPaese(e.target.value)}>
              {paesi.map((p) => <option key={p} value={p}>{nomePaese(p)}</option>)}
            </select>
          </Campo>
        </div>
        <Campo etichetta="Recipient phone">
          <input type="tel" maxLength={40} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </Campo>
        <div className="cli-scelta">
          <span><strong>Default for delivery</strong></span>
          <Interruttore acceso={spedizione} etichetta="Default for delivery" onCambia={setSpedizione} />
        </div>
        <div className="cli-scelta">
          <span><strong>Default for billing</strong></span>
          <Interruttore acceso={fatturazione} etichetta="Default for billing" onCambia={setFatturazione} />
        </div>
        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        <button className="primario" type="submit" disabled={salva.isPending}>{salva.isPending ? "Saving..." : "Save address"}</button>
      </form>
    </Modale>
  )
}
