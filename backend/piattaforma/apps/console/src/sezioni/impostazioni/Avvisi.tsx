import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../../api/client"
import { Interruttore, Riquadro, useAvvisi } from "../../componenti"
import { Stato } from "../../ui"
import type { FonteAvvisi } from "./tipi"

const CHIAVE = ["impostazioni", "avvisi"]

export default function Avvisi() {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const query = useQuery({ queryKey: CHIAVE, queryFn: () => api<{ fonti: FonteAvvisi[] }>("/admin/avvisi/preferenze") })
  const fonti = query.data?.fonti ?? []

  const salva = useMutation({
    mutationFn: (disattivate: string[]) => api<{ fonti: FonteAvvisi[] }>("/admin/avvisi/preferenze", { corpo: { disattivate } }),
    onSuccess: (risposta) => {
      client.setQueryData(CHIAVE, risposta)
      void client.invalidateQueries({ queryKey: ["avvisi"] })
      avvisa("Preferences saved")
    },
    onError: segnalaErrore,
  })
  const cambia = (id: string, acceso: boolean) => {
    const spente = fonti.filter((f) => (f.id === id ? !acceso : !f.attiva)).map((f) => f.id)
    salva.mutate(spente)
  }

  return (
    <div className="impostazioni__moduli">
      <Riquadro titolo="Alerts" testo="This choice applies to your account only. Alerts appear in the bell at the top; they are not sent by email yet.">
        <Stato caricamento={query.isLoading} errore={query.error} vuoto={!query.isLoading && !fonti.length} testoVuoto="No alerts available for your role." />
        <div className="impostazioni__elenco">
          {fonti.map((f) => (
            <div key={f.id} className="impostazione">
              <div>
                <strong>{f.etichetta}</strong>
                <p>{f.descrizione}</p>
              </div>
              <Interruttore acceso={f.attiva} etichetta={f.etichetta} disattivo={salva.isPending} onCambia={(acceso) => cambia(f.id, acceso)} />
            </div>
          ))}
        </div>
      </Riquadro>
    </div>
  )
}
