import { useQuery } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { useState } from "react"
import { api } from "../../api/client"
import type { Cliente } from "./tipi"

type Proprieta = { cliente: Cliente | null; onCambia: (cliente: Cliente | null) => void }

/** Cliente facoltativo: senza, la vendita resta anonima come al banco. */
export function CampoCliente({ cliente, onCambia }: Proprieta) {
  const [testo, setTesto] = useState("")
  const ricerca = testo.trim()
  const { data } = useQuery({
    queryKey: ["cassa", "clienti", ricerca],
    queryFn: () => api<{ clienti: Cliente[] }>(`/admin/cassa/clienti?q=${encodeURIComponent(ricerca)}`),
    enabled: ricerca.length >= 2,
    refetchInterval: false,
  })

  if (cliente) {
    return (
      <div className="cassa-cliente cassa-cliente--scelto">
        <span>
          <b>{cliente.nome}</b>
          <small>{cliente.email}</small>
        </span>
        <button type="button" className="cassa-icona" aria-label="Remove customer" onClick={() => onCambia(null)}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    )
  }

  const trovati = data?.clienti ?? []
  return (
    <div className="cassa-cliente">
      <label className="cassa-cerca">
        <Search size={18} aria-hidden="true" />
        <input type="search" value={testo} placeholder="Customer (optional)" aria-label="Customer (optional)" onChange={(e) => setTesto(e.target.value)} />
      </label>
      {ricerca.length >= 2 ? (
        <ul className="cassa-cliente__elenco">
          {trovati.map((voce) => (
            <li key={voce.id}>
              <button type="button" onClick={() => { onCambia(voce); setTesto("") }}>
                <b>{voce.nome}</b>
                <small>{voce.email}</small>
              </button>
            </li>
          ))}
          {data && !trovati.length ? <li className="cassa-cliente__nulla">No customer found</li> : null}
        </ul>
      ) : null}
    </div>
  )
}
