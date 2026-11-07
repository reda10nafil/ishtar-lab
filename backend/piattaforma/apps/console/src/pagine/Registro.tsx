import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { api } from "../api/client"
import { Riquadro, Tabella, Vuoto, type Colonna } from "../componenti"
import type { Tono } from "../lingua"
import { Etichetta, Stato, dataOra } from "../ui"
import { PaginaImpostazioni } from "./SchedeImpostazioni"
import "./team.css"

type Voce = { id: string; quando: string; chi: string; azienda: string | null; azione: string; esito: number }

function esito(codice: number): { testo: string; tono: Tono } {
  if (codice < 400) return { testo: "Done", tono: "ok" }
  if (codice === 401 || codice === 403) return { testo: "Denied", tono: "attesa" }
  return { testo: "Failed", tono: "errore" }
}

const colonne: Colonna<Voce>[] = [
  { titolo: "Action", cella: (v) => <strong>{v.azione}</strong> },
  { titolo: "Who", cella: (v) => v.chi },
  { titolo: "Company", cella: (v) => v.azienda ?? "–" },
  { titolo: "When", cella: (v) => dataOra(v.quando) },
  {
    titolo: "Result",
    cella: (v) => {
      const { testo, tono } = esito(v.esito)
      return <Etichetta tono={tono}>{testo}</Etichetta>
    },
  },
]

export default function Registro() {
  const query = useQuery({ queryKey: ["registro"], queryFn: () => api<{ voci: Voce[] }>("/admin/registro") })
  const voci = query.data?.voci ?? []
  return (
    <PaginaImpostazioni>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !voci.length ? <Vuoto icona={History} titolo="No changes recorded yet" testo="Every change made in the panel will appear here." /> : null}
      {voci.length ? (
        <Riquadro titolo="Activity log" testo="The latest 100 changes: who did what and when.">
          <Tabella etichetta="Activity log" colonne={colonne} righe={voci} chiave={(v) => v.id} />
        </Riquadro>
      ) : null}
    </PaginaImpostazioni>
  )
}
