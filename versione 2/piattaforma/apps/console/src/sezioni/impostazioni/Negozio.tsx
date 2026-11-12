import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { Interruttore, Riquadro, useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Stato } from "../../ui"
import { importoDa, simboloDi, testoDa, type Negozio as DatiNegozio, type RispostaNegozio } from "./tipi"

const FUSI: [valore: string, nome: string][] = [
  ["Europe/Rome", "Italy (Rome)"],
  ["Europe/London", "United Kingdom (London)"],
  ["Europe/Paris", "France (Paris)"],
  ["Europe/Madrid", "Spain (Madrid)"],
  ["Europe/Berlin", "Germany (Berlin)"],
  ["Europe/Zurich", "Switzerland (Zurich)"],
  ["Europe/Athens", "Greece (Athens)"],
  ["America/New_York", "United States (New York)"],
  ["America/Los_Angeles", "United States (Los Angeles)"],
  ["Asia/Dubai", "United Arab Emirates (Dubai)"],
  ["Asia/Tokyo", "Japan (Tokyo)"],
]

function Modulo({ iniziali, valute, soloLettura }: { iniziali: DatiNegozio; valute: RispostaNegozio["valute"]; soloLettura: boolean }) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [dati, setDati] = useState(iniziali)
  const [obiettivo, setObiettivo] = useState(testoDa(iniziali.obiettivo_giornaliero))

  const imposta = <C extends keyof DatiNegozio>(campo: C, valore: DatiNegozio[C]) => setDati((d) => ({ ...d, [campo]: valore }))

  const salva = useMutation({
    mutationFn: () => api("/admin/impostazioni/negozio", { corpo: { ...dati, obiettivo_giornaliero: importoDa(obiettivo) } }),
    onSuccess: () => {
      avvisa("Store details saved")
      void client.invalidateQueries({ queryKey: ["impostazioni"] })
      void client.invalidateQueries({ queryKey: ["valuta"] })
    },
    onError: segnalaErrore,
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }
  const fuso = FUSI.some(([v]) => v === dati.fuso) ? FUSI : [...FUSI, [dati.fuso, dati.fuso] as [string, string]]

  return (
    <form noValidate onSubmit={invia}>
      <fieldset className="impostazioni__moduli" disabled={soloLettura}>
        <Riquadro titolo="Store details" testo="Your store's name, contacts and address">
          <div className="modulo">
            <Campo etichetta="Store name">
              <input maxLength={120} value={dati.nome} onChange={(e) => imposta("nome", e.target.value)} />
            </Campo>
            <div className="griglia-due">
              <Campo etichetta="Contact email">
                <input autoComplete="off" value={dati.email} onChange={(e) => imposta("email", e.target.value)} />
              </Campo>
              <Campo etichetta="Phone">
                <input autoComplete="off" value={dati.telefono} onChange={(e) => imposta("telefono", e.target.value)} />
              </Campo>
            </div>
            <Campo etichetta="Shop address">
              <input maxLength={240} value={dati.indirizzo} onChange={(e) => imposta("indirizzo", e.target.value)} />
            </Campo>
            <div className="griglia-due">
              <Campo etichetta="VAT number">
                <input maxLength={30} value={dati.partita_iva} onChange={(e) => imposta("partita_iva", e.target.value)} />
              </Campo>
              <Campo etichetta={`Daily sales goal (${simboloDi(dati.valuta)})`}>
                <input inputMode="decimal" value={obiettivo} onChange={(e) => setObiettivo(e.target.value)} />
              </Campo>
              <Campo etichetta="Store currency">
                <select value={dati.valuta} onChange={(e) => imposta("valuta", e.target.value)}>
                  {valute.map((v) => <option key={v.codice} value={v.codice}>{v.codice} · {v.nome}</option>)}
                </select>
              </Campo>
              <Campo etichetta="Time zone">
                <select value={dati.fuso} onChange={(e) => imposta("fuso", e.target.value)}>
                  {fuso.map(([valore, nome]) => <option key={valore} value={valore}>{nome}</option>)}
                </select>
              </Campo>
            </div>
            <p className="impostazioni__nota">Changing the currency only changes the symbol shown next to amounts. Prices are not converted: 100 stays 100.</p>
            <div className="impostazioni__iva">
              <div>
                <strong>Prices include VAT</strong>
                <p>Customers pay the price they see, with VAT already in it</p>
              </div>
              <Interruttore acceso={dati.prezzi_con_iva} etichetta="Prices include VAT" disattivo={soloLettura} onCambia={(acceso) => imposta("prezzi_con_iva", acceso)} />
            </div>
            <div className="impostazioni__piede">
              <button type="submit" className="primario" disabled={salva.isPending}>
                <Check size={16} aria-hidden="true" /> {salva.isPending ? "Saving..." : "Save details"}
              </button>
            </div>
          </div>
        </Riquadro>
      </fieldset>
    </form>
  )
}

export default function Negozio() {
  const { puo } = usePermessi()
  const query = useQuery({ queryKey: ["impostazioni", "negozio"], queryFn: () => api<RispostaNegozio>("/admin/impostazioni") })
  if (!query.data) return <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
  return <Modulo iniziali={query.data.negozio} valute={query.data.valute} soloLettura={!puo("impostazioni", "manage")} />
}
