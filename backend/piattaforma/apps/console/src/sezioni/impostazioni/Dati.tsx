import { useMutation, useQuery } from "@tanstack/react-query"
import { Download } from "lucide-react"
import { api } from "../../api/client"
import { Riquadro, useAvvisi } from "../../componenti"
import { scaricaCsv, scaricaJson } from "../../esporta"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Stato } from "../../ui"
import type { Conteggi, Tabella } from "./tipi"

type Tipo = keyof Conteggi
type Formato = "csv" | "json"

const TIPI: { tipo: Tipo; nome: string; file: string; testo: string }[] = [
  { tipo: "prodotti", nome: "Products", file: "products", testo: "The catalogue with status, companies, categories, variants and offer prices." },
  { tipo: "aziende", nome: "Companies", file: "companies", testo: "Partner companies with their contact details and status." },
  { tipo: "clienti", nome: "Customers", file: "customers", testo: "Customers with contact details and addresses. Contains personal data." },
]

const oggi = () => new Date().toISOString().slice(0, 10)

export default function Dati() {
  const { avvisa, segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const query = useQuery({ queryKey: ["impostazioni", "conteggi"], queryFn: () => api<{ conteggi: Conteggi }>("/admin/impostazioni/esporta") })
  const puoEsportare = puo("impostazioni", "manage")

  const esporta = useMutation({
    mutationFn: async ({ tipo, file, formato }: { tipo: Tipo; file: string; formato: Formato }) => {
      const tabella = await api<Tabella>(`/admin/impostazioni/esporta/${tipo}`, { corpo: {} })
      const nome = `ishtar-lab-${file}-${oggi()}`
      if (formato === "csv") scaricaCsv(nome, tabella.intestazioni, tabella.righe)
      else scaricaJson(nome, tabella.dati)
      return tabella.righe.length
    },
    onSuccess: (quante) => avvisa(`File ready: ${numero(quante)} rows`),
    onError: segnalaErrore,
  })

  return (
    <div className="impostazioni__moduli">
      <Riquadro titolo="Your data" testo="Download a copy of the current data. Every export is kept in the activity log.">
        <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
        <div className="impostazioni__elenco">
          {TIPI.map(({ tipo, nome, file, testo }) => {
            const quanti = query.data?.conteggi[tipo] ?? 0
            const spento = !puoEsportare || !quanti || esporta.isPending
            return (
              <div key={tipo} className="impostazione">
                <div>
                  <strong>{nome} <span className="impostazioni__conteggio">{numero(quanti)}</span></strong>
                  <p>{quanti ? testo : `Nothing to export in ${nome}.`}</p>
                </div>
                <div className="riga__azioni">
                  <button type="button" disabled={spento} aria-label={`Download ${nome} as CSV`} onClick={() => esporta.mutate({ tipo, file, formato: "csv" })}>
                    <Download size={16} aria-hidden="true" /> CSV
                  </button>
                  <button type="button" disabled={spento} aria-label={`Download ${nome} as JSON`} onClick={() => esporta.mutate({ tipo, file, formato: "json" })}>
                    <Download size={16} aria-hidden="true" /> JSON
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Riquadro>
      <p className="avviso-stato">Restoring is not available: these files are copies to keep or open in a spreadsheet, and Ishtar Lab cannot load them back.</p>
    </div>
  )
}
