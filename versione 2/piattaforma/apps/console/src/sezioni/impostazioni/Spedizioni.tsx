import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Truck } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "../../api/client"
import { Interruttore, Riquadro, useAvvisi, Vuoto } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { euro, Stato } from "../../ui"
import { importoDa, testoDa, type Opzione, type RispostaSpedizioni } from "./tipi"

const CHIAVE = ["impostazioni", "spedizioni"]
const VALUTA = ["valuta"]

/** Campo che si salva da solo all'uscita, come ogni riga di questa pagina. */
function CampoImporto({ valore, etichetta, simbolo, unita, spento, onSalva }: { valore: number | null; etichetta: string; simbolo?: string; unita?: string; spento: boolean; onSalva: (valore: number | null) => void }) {
  const [testo, setTesto] = useState(testoDa(valore))
  useEffect(() => setTesto(testoDa(valore)), [valore])

  const conferma = () => {
    const nuovo = importoDa(testo)
    if (nuovo === valore) return
    if (nuovo !== null && (Number.isNaN(nuovo) || nuovo < 0)) {
      setTesto(testoDa(valore))
      return
    }
    onSalva(nuovo)
  }

  return (
    <label className={`importo${unita ? " importo--giorni" : ""}`}>
      {simbolo ? <span aria-hidden="true">{simbolo}</span> : null}
      <input
        inputMode="decimal"
        aria-label={etichetta}
        disabled={spento}
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        onBlur={conferma}
      />
      {unita ? <em aria-hidden="true">{unita}</em> : null}
    </label>
  )
}

export default function Spedizioni() {
  const client = useQueryClient()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const query = useQuery({ queryKey: CHIAVE, queryFn: () => api<RispostaSpedizioni>("/admin/impostazioni/spedizioni") })
  const spento = !puo("impostazioni", "manage")
  // Il simbolo viene dal formattatore comune, così segue la valuta del negozio.
  const simbolo = euro(0).replace(/[\d.,\s]/g, "")

  const riuscito = (testo: string) => {
    avvisa(testo)
    void client.invalidateQueries({ queryKey: CHIAVE })
    void client.invalidateQueries({ queryKey: VALUTA })
  }
  const opzione = useMutation({
    mutationFn: ({ o, ...cambio }: { o: Opzione; tariffa?: number; attiva?: boolean; testo: string }) =>
      api(`/admin/impostazioni/spedizioni/opzioni/${o.id}`, {
        corpo: { nome: o.nome, tariffa: cambio.tariffa ?? o.tariffa ?? 0, soglia_gratuita: o.soglia_gratuita, attiva: cambio.attiva ?? o.attiva },
      }),
    onSuccess: (_, { testo }) => riuscito(testo),
    onError: (errore) => {
      segnalaErrore(errore)
      void client.invalidateQueries({ queryKey: CHIAVE })
    },
  })
  const regole = useMutation({
    mutationFn: ({ corpo }: { corpo: Record<string, number | null>; testo: string }) => api("/admin/impostazioni/spedizioni", { corpo }),
    onSuccess: (_, { testo }) => riuscito(testo),
    onError: (errore) => {
      segnalaErrore(errore)
      void client.invalidateQueries({ queryKey: CHIAVE })
    },
  })

  if (!query.data) return <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
  const { regole: valori, opzioni } = query.data

  return (
    <div className="impostazioni__moduli">
      <Riquadro titolo="Postage" testo="What customers pay for delivery at checkout">
        {opzioni.length ? null : <Vuoto icona={Truck} titolo="No shipping options yet" testo="Options appear here once a company sets up its shipping." />}
        <div className="impostazioni__elenco">
          {opzioni.map((o) => (
            <div key={o.id} className="impostazione impostazione--opzione" data-riga>
              <div>
                <strong>{o.nome}</strong>
                <p>{[o.azienda, o.tipo].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="impostazione__destra">
                <CampoImporto
                  valore={o.tariffa}
                  etichetta={`Rate for ${o.nome}, ${o.azienda ?? ""}`}
                  simbolo={simbolo}
                  spento={spento}
                  onSalva={(tariffa) => opzione.mutate({ o, tariffa: tariffa ?? 0, testo: `${o.nome} set to ${euro(tariffa ?? 0)}` })}
                />
                <Interruttore
                  acceso={o.attiva}
                  etichetta={`Offer ${o.nome}, ${o.azienda ?? ""}`}
                  disattivo={spento || opzione.isPending}
                  onCambia={(attiva) => opzione.mutate({ o, attiva, testo: `${o.nome} is ${attiva ? "on" : "off"}` })}
                />
              </div>
            </div>
          ))}
          {opzioni.length ? (
            <div className="impostazione" data-riga>
              <div>
                <strong>Free postage over</strong>
                <p>Baskets above this amount ship free, on every option</p>
              </div>
              <CampoImporto
                valore={valori.soglia_gratuita}
                etichetta="Free postage over"
                simbolo={simbolo}
                spento={spento}
                onSalva={(soglia) => regole.mutate({ corpo: { soglia_gratuita: soglia }, testo: soglia === null ? "Free postage removed" : `Free postage over ${euro(soglia)}` })}
              />
            </div>
          ) : null}
          <div className="impostazione" data-riga>
            <div>
              <strong>Fulfilment deadline</strong>
              <p>How long each company has to ship an order</p>
            </div>
            <CampoImporto
              valore={valori.giorni_max_evasione}
              etichetta="Fulfilment deadline in days"
              unita="days"
              spento={spento}
              onSalva={(giorni) => regole.mutate({ corpo: { giorni_max_evasione: giorni }, testo: giorni === null ? "Fulfilment deadline removed" : `Fulfilment deadline set to ${numero(giorni)} days` })}
            />
          </div>
        </div>
      </Riquadro>
    </div>
  )
}
