import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Download, History } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { scaricaCsv } from "../../esporta"
import { numero, stato as statoDi } from "../../lingua"
import { Etichetta, Stato, dataOra } from "../../ui"
import { PER_PAGINA, TIPI_MOVIMENTO, interrogazione, testoMotivo, useMagazzino, useRitardato } from "./dati"
import type { ElencoMovimenti, Movimento } from "./tipi"

const segno = (valore: number) => (valore > 0 ? `+${numero(valore)}` : numero(valore))

export default function Movimenti() {
  const { admin, base } = useMagazzino()
  const naviga = useNavigate()
  const { segnalaErrore } = useAvvisi()
  const [testo, setTesto] = useState("")
  const q = useRitardato(testo.trim())
  const [tipo, setTipo] = useState("")
  const [pagina, setPagina] = useState(1)

  useEffect(() => setPagina(1), [q, tipo])

  const query = useQuery({
    queryKey: ["magazzino", "movimenti", base, q, tipo, pagina],
    queryFn: () => api<ElencoMovimenti>(`${base}/movimenti?${interrogazione({ q, tipo, limit: PER_PAGINA, offset: (pagina - 1) * PER_PAGINA })}`),
    placeholderData: keepPreviousData,
  })
  const dati = query.data

  const colonne: Colonna<Movimento>[] = [
    { titolo: "When", cella: (m) => dataOra(m.quando) },
    { titolo: "Product", cella: (m) => [m.prodotto, m.variante].filter(Boolean).join(" · ") || "Unnamed item" },
    { titolo: "SKU", cella: (m) => <code className="mag-sku">{m.sku ?? "–"}</code> },
    ...(admin ? [{ titolo: "Company", cella: (m: Movimento) => m.azienda }] : []),
    {
      titolo: "Type",
      cella: (m) => {
        const s = statoDi(TIPI_MOVIMENTO, m.tipo)
        return <Etichetta tono={s.tono}>{s.testo}</Etichetta>
      },
    },
    { titolo: "From", destra: true, cella: (m) => numero(m.prima) },
    { titolo: "To", destra: true, cella: (m) => numero(m.dopo) },
    { titolo: "Difference", destra: true, cella: (m) => segno(m.differenza) },
    { titolo: "Reason", cella: (m) => testoMotivo(m.motivo) },
    { titolo: "Who", cella: (m) => m.chi },
  ]

  const esporta = async () => {
    try {
      const { movimenti } = await api<ElencoMovimenti>(`${base}/movimenti?${interrogazione({ q, tipo, tutte: 1 })}`)
      scaricaCsv(
        "inventory-movements",
        ["When", "Product", "Variant", "SKU", ...(admin ? ["Company"] : []), "Warehouse", "Type", "From", "To", "Difference", "Reason", "Who", "Note"],
        movimenti.map((m) => [
          dataOra(m.quando),
          m.prodotto,
          m.variante,
          m.sku,
          ...(admin ? [m.azienda] : []),
          m.deposito,
          statoDi(TIPI_MOVIMENTO, m.tipo).testo,
          m.prima,
          m.dopo,
          m.differenza,
          testoMotivo(m.motivo),
          m.chi,
          m.nota,
        ])
      )
    } catch (errore) {
      segnalaErrore(errore)
    }
  }

  return (
    <>
      <div className="barra-strumenti mag-barra">
        <CampoRicerca valore={testo} etichetta="Search by SKU or product" onCambia={setTesto} />
        <select aria-label="Movement type" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(TIPI_MOVIMENTO).map(([valore, s]) => <option key={valore} value={valore}>{s.testo}</option>)}
        </select>
        <span className="spazio" />
        <button type="button" disabled={!dati?.conteggio} onClick={() => void esporta()}>
          <Download size={16} aria-hidden="true" /> Export CSV
        </button>
      </div>
      <p className="mag-nota">Adjustments and counts made in Ishtar Lab, the latest 100 per item. Sales and returns are not in this history yet.</p>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {dati && !dati.movimenti.length ? (
        <Vuoto
          icona={History}
          titolo={q || tipo ? "No movements found" : "No movements"}
          testo={q || tipo ? "No movements match these filters." : "Every stock adjustment or count appears here, with who made it and why."}
        />
      ) : null}
      {dati?.movimenti.length ? (
        <Tabella etichetta="Movements" colonne={colonne} righe={dati.movimenti} chiave={(m) => m.id} onApri={(m) => naviga(`/magazzino/scorte/${m.articolo_id}`)} />
      ) : null}
      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={dati?.conteggio ?? 0} onCambia={setPagina} />
    </>
  )
}
