import { useQuery } from "@tanstack/react-query"
import { api } from "../api/client"
import type { Ordine } from "../api/tipi"
import { Etichetta, Pagina, Stato } from "../ui"

const data = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" })

export default function OrdiniAzienda() {
  const query = useQuery({
    queryKey: ["mie-ordini"],
    queryFn: () => api<{ orders: Ordine[] }>("/vendor/orders?limit=50&fields=id,display_id,status,created_at"),
  })
  const elenco = query.data?.orders ?? []

  return (
    <Pagina titolo="Ordini" sottotitolo="Gli ordini che contengono i tuoi prodotti.">
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={!elenco.length} testoVuoto="Nessun ordine per ora." />
      <ul className="elenco">
        {elenco.map((o) => (
          <li key={o.id} className="riga vetro">
            <div className="riga__testo">
              <strong>Ordine #{o.display_id}</strong>
              <small>{data.format(new Date(o.created_at))}</small>
            </div>
            <Etichetta tono="neutro">{o.status}</Etichetta>
          </li>
        ))}
      </ul>
    </Pagina>
  )
}
