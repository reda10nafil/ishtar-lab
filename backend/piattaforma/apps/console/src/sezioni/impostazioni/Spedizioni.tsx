import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Truck } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { Interruttore, Riquadro, useAvvisi, Vuoto } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Etichetta, euro, Modale, Stato } from "../../ui"
import { importoDa, testoDa, type Opzione, type RispostaSpedizioni } from "./tipi"

const CHIAVE = ["impostazioni", "spedizioni"]

function ModaleOpzione({ opzione, onChiudi }: { opzione: Opzione; onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [nome, setNome] = useState(opzione.nome)
  const [tariffa, setTariffa] = useState(testoDa(opzione.tariffa))
  const [soglia, setSoglia] = useState(testoDa(opzione.soglia_gratuita))
  const [attiva, setAttiva] = useState(opzione.attiva)

  const salva = useMutation({
    mutationFn: () =>
      api(`/admin/impostazioni/spedizioni/opzioni/${opzione.id}`, {
        corpo: { nome, tariffa: importoDa(tariffa), soglia_gratuita: importoDa(soglia), attiva },
      }),
    onSuccess: () => {
      avvisa("Shipping option saved")
      void client.invalidateQueries({ queryKey: CHIAVE })
      onChiudi()
    },
    onError: segnalaErrore,
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <Modale titolo="Edit shipping option" sottotitolo={opzione.azienda ?? undefined} onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Name">
          <input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <div className="griglia-due impostazioni__coppia">
          <Campo etichetta="Rate">
            <input required type="number" min="0" step="0.01" inputMode="decimal" value={tariffa} onChange={(e) => setTariffa(e.target.value)} />
          </Campo>
          <Campo etichetta="Free over" aiuto="Basket value above which shipping is free. Leave empty for no threshold.">
            <input type="number" min="0.01" step="0.01" inputMode="decimal" value={soglia} onChange={(e) => setSoglia(e.target.value)} />
          </Campo>
        </div>
        <div className="impostazione">
          <div>
            <strong>Offered to customers</strong>
            <p>Switch it off and this option no longer appears in the basket.</p>
          </div>
          <Interruttore acceso={attiva} etichetta="Offered to customers" onCambia={setAttiva} />
        </div>
        <button type="submit" className="primario" disabled={salva.isPending}>{salva.isPending ? "Saving..." : "Save"}</button>
      </form>
    </Modale>
  )
}

function TempoEvasione({ iniziale, soloLettura }: { iniziale: number | null; soloLettura: boolean }) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [giorni, setGiorni] = useState(testoDa(iniziale))
  const salva = useMutation({
    mutationFn: () => api("/admin/impostazioni/spedizioni", { corpo: { giorni_max_evasione: importoDa(giorni) } }),
    onSuccess: () => {
      avvisa("Fulfilment deadline saved")
      void client.invalidateQueries({ queryKey: CHIAVE })
    },
    onError: segnalaErrore,
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }
  return (
    <Riquadro titolo="Fulfilment deadline" testo="Each company keeps its own stock and ships its own orders. This is how long it has to do so.">
      <form className="impostazioni__riga-modulo" onSubmit={invia}>
        <Campo etichetta="Days from the order" aiuto="Leave empty for no limit.">
          <input type="number" min="1" max="60" step="1" inputMode="numeric" disabled={soloLettura} value={giorni} onChange={(e) => setGiorni(e.target.value)} />
        </Campo>
        <button type="submit" className="primario" disabled={soloLettura || salva.isPending}>{salva.isPending ? "Saving..." : "Save"}</button>
      </form>
    </Riquadro>
  )
}

export default function Spedizioni() {
  const { puo } = usePermessi()
  const [aperta, setAperta] = useState<Opzione | null>(null)
  const query = useQuery({ queryKey: CHIAVE, queryFn: () => api<RispostaSpedizioni>("/admin/impostazioni/spedizioni") })
  const puoCambiare = puo("impostazioni", "manage")

  if (!query.data) return <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
  const { regole, opzioni } = query.data

  return (
    <div className="impostazioni__moduli">
      <Riquadro titolo="Shipping options" testo="What customers pay at checkout, with each company's rates and free shipping thresholds.">
        {opzioni.length ? (
          <div className="impostazioni__elenco">
            {opzioni.map((o) => (
              <div key={o.id} className="impostazione impostazione--opzione">
                <div>
                  <strong>{o.nome}</strong>
                  <p>{[o.azienda, o.tipo].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="impostazioni__valori">
                  <span>
                    <strong>{euro(o.tariffa)}</strong>
                    <small>{o.soglia_gratuita === null ? "No free threshold" : `Free over ${euro(o.soglia_gratuita)}`}</small>
                  </span>
                  <Etichetta tono={o.attiva ? "ok" : "neutro"}>{o.attiva ? "On" : "Off"}</Etichetta>
                  {puoCambiare ? <button type="button" aria-label={`Edit ${o.nome}, ${o.azienda ?? ""}`} onClick={() => setAperta(o)}>Edit</button> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Vuoto icona={Truck} titolo="No shipping options yet" testo="Options appear here once a company sets up its shipping." />
        )}
      </Riquadro>
      <TempoEvasione iniziale={regole.giorni_max_evasione} soloLettura={!puoCambiare} />
      {aperta ? <ModaleOpzione opzione={aperta} onChiudi={() => setAperta(null)} /> : null}
    </div>
  )
}
