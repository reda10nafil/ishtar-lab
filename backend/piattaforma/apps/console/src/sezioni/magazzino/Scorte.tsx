import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Boxes, Download, PackageX, TriangleAlert, Wallet, Warehouse, type LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, Riquadro, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { scaricaCsv } from "../../esporta"
import { numero, stato as statoDi } from "../../lingua"
import { Anteprima, Etichetta, Stato, dataOra, euro } from "../../ui"
import { PER_PAGINA, STATI_SCORTA, interrogazione, useMagazzino, useRitardato } from "./dati"
import type { ElencoScorte, Riga, Riepilogo } from "./tipi"

function Tessera({ icona: Icona, valore, testo, nota }: { icona: LucideIcon; valore: string; testo: string; nota?: string }) {
  return (
    <div className="mag-tessera vetro">
      <span className="mag-tessera__icona"><Icona size={19} aria-hidden="true" /></span>
      <span className="mag-tessera__testo">
        <strong>{valore}</strong>
        <span>{testo}</span>
        {nota ? <small>{nota}</small> : null}
      </span>
    </div>
  )
}

function Cifre({ riepilogo, vedeValore }: { riepilogo: Riepilogo; vedeValore: boolean }) {
  const senzaCosto = riepilogo.senza_costo ? `${numero(riepilogo.senza_costo)} without a supply price` : undefined
  return (
    <div className="mag-cifre">
      {vedeValore ? <Tessera icona={Wallet} valore={euro(riepilogo.valore)} testo="Stock value at cost" nota={senzaCosto} /> : null}
      <Tessera icona={Boxes} valore={numero(riepilogo.giacenza)} testo="Units in stock" />
      <Tessera icona={TriangleAlert} valore={numero(riepilogo.in_esaurimento)} testo="Low stock" />
      <Tessera icona={PackageX} valore={numero(riepilogo.esauriti)} testo="Out of stock" />
    </div>
  )
}

export function CellaProdotto({ riga }: { riga: Pick<Riga, "prodotto" | "variante" | "miniatura" | "soglia"> }) {
  return (
    <span className="mag-prodotto">
      <Anteprima url={riga.miniatura} titolo={riga.prodotto ?? "Item"} />
      <span>
        <strong>{riga.prodotto ?? "Unnamed item"}</strong>
        <small>{[riga.variante, `safety stock ${numero(riga.soglia)}`].filter(Boolean).join(" · ")}</small>
      </span>
    </span>
  )
}

/** La barra è piena a tre volte la soglia di sicurezza: dice quanto margine resta. */
function Livello({ riga }: { riga: Riga }) {
  const pieno = Math.min(1, Math.max(0, riga.disponibili / Math.max(riga.soglia * 3, 1)))
  return (
    <span className={`mag-livello mag-livello--${riga.stato}`}>
      <i aria-hidden="true"><b style={{ width: `${pieno * 100}%` }} /></i>
      <span>{numero(riga.disponibili)}</span>
    </span>
  )
}

const colonne = (admin: boolean, vedeValore: boolean): Colonna<Riga>[] => [
  { titolo: "Product", cella: (r) => <CellaProdotto riga={r} /> },
  { titolo: "SKU", cella: (r) => <code className="mag-sku">{r.sku ?? "–"}</code> },
  ...(admin
    ? [
        { titolo: "Company", cella: (r: Riga) => r.azienda },
        { titolo: "Warehouse", cella: (r: Riga) => r.deposito },
      ]
    : []),
  { titolo: "Level", cella: (r) => <Livello riga={r} /> },
  { titolo: "Reserved", destra: true, cella: (r) => numero(r.riservate) },
  ...(vedeValore ? [{ titolo: "Value at cost", destra: true, cella: (r: Riga) => (r.valore === null ? "No supply price" : euro(r.valore)) }] : []),
  {
    titolo: "Status",
    cella: (r) => {
      const s = statoDi(STATI_SCORTA, r.stato)
      return <Etichetta tono={s.tono}>{s.testo}</Etichetta>
    },
  },
]

const csv = (r: Riga, admin: boolean, vedeValore: boolean) => [
  r.prodotto,
  r.variante,
  r.sku,
  ...(admin ? [r.azienda] : []),
  r.deposito,
  r.giacenza,
  r.riservate,
  r.disponibili,
  r.soglia,
  statoDi(STATI_SCORTA, r.stato).testo,
  r.ultimo_conteggio ? dataOra(r.ultimo_conteggio) : "",
  ...(vedeValore ? [r.costo_unitario, r.valore] : []),
]

export default function Scorte() {
  const { admin, base } = useMagazzino()
  const naviga = useNavigate()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [testo, setTesto] = useState("")
  const q = useRitardato(testo.trim())
  const [azienda, setAzienda] = useState("")
  const [deposito, setDeposito] = useState("")
  const [stato, setStato] = useState("")
  const [pagina, setPagina] = useState(1)
  const [esporto, setEsporto] = useState(false)
  const filtri = { q, azienda, deposito, stato }

  useEffect(() => setPagina(1), [q, azienda, deposito, stato])

  const query = useQuery({
    queryKey: ["magazzino", "scorte", base, filtri, pagina],
    queryFn: () => api<ElencoScorte>(`${base}?${interrogazione({ ...filtri, limit: PER_PAGINA, offset: (pagina - 1) * PER_PAGINA })}`),
    placeholderData: keepPreviousData,
  })
  const dati = query.data
  const filtrato = Boolean(q || azienda || deposito || stato)
  const depositi = dati?.depositi.filter((d) => !azienda || d.azienda_id === azienda) ?? []

  const esporta = async () => {
    setEsporto(true)
    try {
      const { righe, vede_valore } = await api<ElencoScorte>(`${base}?${interrogazione({ ...filtri, tutte: 1 })}`)
      scaricaCsv(
        "inventory",
        ["Product", "Variant", "SKU", ...(admin ? ["Company"] : []), "Warehouse", "In stock", "Reserved", "Available", "Safety stock", "Status", "Last counted", ...(vede_valore ? ["Supply price", "Value at cost"] : [])],
        righe.map((r) => csv(r, admin, vede_valore))
      )
      avvisa(`Exported ${numero(righe.length)} rows`)
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setEsporto(false)
    }
  }

  const pillole = (
    <div className="filtri" role="group" aria-label="Filter by stock status">
      <button type="button" className={stato === "" ? "attivo" : undefined} aria-pressed={stato === ""} onClick={() => setStato("")}>Everything</button>
      {Object.entries(STATI_SCORTA).map(([valore, s]) => (
        <button key={valore} type="button" className={stato === valore ? "attivo" : undefined} aria-pressed={stato === valore} onClick={() => setStato(valore)}>{s.testo}</button>
      ))}
    </div>
  )

  return (
    <>
      {dati ? <Cifre riepilogo={dati.riepilogo} vedeValore={dati.vede_valore} /> : null}
      <div className="mag-blocco">
        <Riquadro titolo="Stock" testo={dati ? `${numero(dati.conteggio)} items, lowest first` : "Lowest first"} azioni={pillole}>
          <div className="barra-strumenti mag-barra">
            <CampoRicerca valore={testo} etichetta="Search by SKU or product" onCambia={setTesto} />
            {admin ? (
              <>
                <select aria-label="Company" value={azienda} onChange={(e) => { setAzienda(e.target.value); setDeposito("") }}>
                  <option value="">All companies</option>
                  {dati?.aziende?.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
                <select aria-label="Warehouse" value={deposito} onChange={(e) => setDeposito(e.target.value)}>
                  <option value="">All warehouses</option>
                  {depositi.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </>
            ) : null}
            <span className="spazio" />
            <button type="button" disabled={esporto || !dati?.conteggio} onClick={() => void esporta()}>
              <Download size={16} aria-hidden="true" /> {esporto ? "Exporting..." : "Export CSV"}
            </button>
          </div>
          <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
          {dati && !dati.righe.length ? (
            <Vuoto
              icona={Warehouse}
              titolo={filtrato ? "No items found" : "No stock yet"}
              testo={filtrato ? "No items match these filters." : "Stock appears here once an item is in a warehouse."}
            />
          ) : null}
          {dati?.righe.length ? (
            <Tabella
              etichetta="Stock"
              colonne={colonne(admin, dati.vede_valore)}
              righe={dati.righe}
              chiave={(r) => r.id}
              onApri={(r) => naviga(`/magazzino/scorte/${r.articolo_id}`)}
            />
          ) : null}
          <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={dati?.conteggio ?? 0} onCambia={setPagina} />
        </Riquadro>
      </div>
    </>
  )
}
