import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Box, Coins, Download, Minus, PackageCheck, PackagePlus, Plus, Truck, Warehouse, type LucideIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { scaricaCsv } from "../../esporta"
import { numero, stato as statoDi } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Cifra } from "../../movimenti"
import { Stato, dataOra, euro } from "../../ui"
import { AvvisoAnnulla, useAvvisoAnnulla } from "./AvvisoAnnulla"
import { PER_PAGINA, STATI_SCORTA, interrogazione, useAggiornaMagazzino, useContatori, useMagazzino, useRitardato } from "./dati"
import { Sezioni } from "./Sezioni"
import type { ElencoScorte, Riga, Riepilogo } from "./tipi"

const nomeRiga = (r: Pick<Riga, "prodotto" | "variante">) => [r.prodotto, r.variante].filter(Boolean).join(" · ") || "Item"

function Tessera({ icona: Icona, tono, valore, formato, testo }: { icona: LucideIcon; tono: string; valore: number | null; formato: (n: number) => string; testo: string }) {
  return (
    <div className="mag-tessera vetro">
      <span className={`mag-tessera__icona mag-tessera__icona--${tono}`}><Icona size={20} aria-hidden="true" /></span>
      <span className="mag-tessera__testo">
        <strong>{valore === null ? "–" : <Cifra valore={valore} formato={formato} />}</strong>
        <small>{testo}</small>
      </span>
    </div>
  )
}

const interi = (n: number) => numero(Math.round(n))

function Tessere({ riepilogo, vedeValore }: { riepilogo: Riepilogo; vedeValore: boolean }) {
  return (
    <div className="mag-tessere">
      {vedeValore ? <Tessera icona={Coins} tono="accento" valore={riepilogo.valore} formato={euro} testo="Stock value at cost" /> : null}
      <Tessera icona={Box} tono="blu" valore={riepilogo.giacenza} formato={interi} testo="Units on the shelves" />
      <Tessera icona={Truck} tono="attesa" valore={riepilogo.in_arrivo} formato={interi} testo="On the way from companies" />
    </div>
  )
}

export function CellaProdotto({ riga, admin = false }: { riga: Pick<Riga, "articolo_id" | "prodotto" | "variante" | "miniatura" | "soglia" | "azienda" | "riservate">; admin?: boolean }) {
  const nome = riga.prodotto ?? "Unnamed item"
  const dettagli = [admin ? riga.azienda : null, riga.variante, riga.riservate ? `${numero(riga.riservate)} reserved` : null, `reorder at ${numero(riga.soglia)}`]
  return (
    <span className="mag-prodotto">
      {riga.miniatura ? <img className="mag-miniatura" src={riga.miniatura} alt="" loading="lazy" /> : <span className="mag-miniatura mag-miniatura--vuota" aria-hidden="true">{nome.slice(0, 2).toUpperCase()}</span>}
      <span className="mag-prodotto__testo">
        <Link to={`/magazzino/scorte/${riga.articolo_id}`}>{nome}</Link>
        <small>{dettagli.filter(Boolean).join(" · ")}</small>
      </span>
    </span>
  )
}

/** La barra è piena a due volte e mezzo il punto di riordino, come nel pannello. */
function Livello({ riga, disponibili }: { riga: Riga; disponibili: number }) {
  const pieno = Math.min(1, Math.max(0, disponibili / Math.max(riga.soglia * 2.5, 1)))
  const stato = disponibili <= 0 ? "esaurito" : disponibili <= riga.soglia ? "esaurimento" : "disponibile"
  return (
    <span className={`mag-livello mag-livello--${stato}`}>
      <i aria-hidden="true"><b style={{ transform: `scaleX(${pieno})` }} /></i>
      <small>{numero(disponibili)}</small>
      <span className="nascosto">{statoDi(STATI_SCORTA, stato).testo}</span>
    </span>
  )
}

function GiorniRimasti({ giorni }: { giorni: number | null }) {
  if (giorni === null) return <>—</>
  const classe = giorni === 0 ? "testo-errore" : giorni < 14 ? "mag-attesa" : undefined
  return <span className={classe}>{numero(giorni)}</span>
}

function Contatore({ riga, valore, onCambia }: { riga: Riga; valore: number; onCambia: (unita: number) => void }) {
  const nome = nomeRiga(riga)
  return (
    <span className="mag-contatore">
      <button type="button" aria-label={`One fewer ${nome}`} onClick={() => valore > 0 && onCambia(-1)}><Minus size={15} aria-hidden="true" /></button>
      <output aria-label={`${nome} in stock`}>{numero(valore)}</output>
      <button type="button" className="mag-contatore__piu" aria-label={`One more ${nome}`} onClick={() => onCambia(1)}><Plus size={15} aria-hidden="true" /></button>
    </span>
  )
}

const csv = (r: Riga, admin: boolean, vedeValore: boolean) => [
  r.prodotto,
  r.variante,
  r.sku,
  ...(admin ? [r.azienda] : []),
  r.deposito,
  r.giacenza,
  r.riservate,
  r.disponibili,
  r.in_arrivo,
  r.soglia,
  r.venduti_30,
  statoDi(STATI_SCORTA, r.stato).testo,
  r.ultimo_conteggio ? dataOra(r.ultimo_conteggio) : "",
  ...(vedeValore ? [r.costo_unitario, r.valore] : []),
]

export default function Scorte() {
  const { admin, base } = useMagazzino()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiornaMagazzino()
  const contatori = useContatori(base)
  const { avviso, mostra, annulla } = useAvvisoAnnulla()
  const [testo, setTesto] = useState("")
  const q = useRitardato(testo.trim())
  const [azienda, setAzienda] = useState("")
  const [deposito, setDeposito] = useState("")
  const [stato, setStato] = useState("")
  const [quanti, setQuanti] = useState(PER_PAGINA)
  const [esporto, setEsporto] = useState(false)
  const filtri = { q, azienda, deposito, stato }

  useEffect(() => setQuanti(PER_PAGINA), [q, azienda, deposito, stato])

  const query = useQuery({
    queryKey: ["magazzino", "scorte", base, filtri, quanti],
    queryFn: () => api<ElencoScorte>(`${base}?${interrogazione({ ...filtri, limit: quanti })}`),
    placeholderData: keepPreviousData,
  })
  const dati = query.data
  const filtrato = Boolean(q || azienda || deposito || stato)

  // Mentre si conta le righe restano ferme: l'ordine si ricalcola solo cambiando filtri o riaprendo la pagina.
  const posizioni = useRef(new Map<string, number>())
  useEffect(() => posizioni.current.clear(), [q, azienda, deposito, stato])
  const righe = useMemo(() => {
    for (const r of dati?.righe ?? []) {
      if (!posizioni.current.has(r.id)) posizioni.current.set(r.id, posizioni.current.size)
    }
    return [...(dati?.righe ?? [])].sort((a, b) => (posizioni.current.get(a.id) ?? 0) - (posizioni.current.get(b.id) ?? 0))
  }, [dati])
  const depositi = dati?.depositi.filter((d) => !azienda || d.azienda_id === azienda) ?? []
  const puoScrivere = puo("magazzino", "edit")

  const chiedi = async (riga: Riga, quantita?: number) => {
    const { quantita: chieste } = await api<{ quantita: number }>(`${base}/articoli/${riga.articolo_id}/rifornimento`, { corpo: { deposito_id: riga.deposito_id, quantita } })
    await aggiorna()
    return chieste
  }

  const rifornisci = async (riga: Riga) => {
    try {
      const chieste = await chiedi(riga)
      mostra({ testo: `Restock of ${numero(chieste)} ${nomeRiga(riga)} requested`, annulla: () => void chiedi(riga, -chieste).catch(segnalaErrore) })
    } catch (errore) {
      segnalaErrore(errore)
    }
  }

  const ricevi = async (riga: Riga) => {
    try {
      const { ricevute } = await api<{ ricevute: number }>(`${base}/articoli/${riga.articolo_id}/ricevi`, { corpo: { deposito_id: riga.deposito_id } })
      await aggiorna()
      mostra({
        testo: `${numero(ricevute)} ${nomeRiga(riga)} on the shelves`,
        annulla: () => {
          void (async () => {
            await api(`${base}/articoli/${riga.articolo_id}/correzione`, { corpo: { deposito_id: riga.deposito_id, variazione: -ricevute, motivo: "rettifica" } })
            await chiedi(riga, ricevute)
          })().catch(segnalaErrore)
        },
      })
    } catch (errore) {
      segnalaErrore(errore)
    }
  }

  const colonne: Colonna<Riga>[] = [
    { titolo: "Product", cella: (r) => <CellaProdotto riga={r} admin={admin} /> },
    { titolo: "Level", cella: (r) => <Livello riga={r} disponibili={r.disponibili + contatori.attesa(r)} /> },
    { titolo: "Sold · 30d", destra: true, cella: (r) => numero(r.venduti_30) },
    { titolo: "Days left", destra: true, cella: (r) => <GiorniRimasti giorni={r.giorni_rimasti} /> },
    {
      titolo: "Count",
      cella: (r) => (puoScrivere ? <Contatore riga={r} valore={r.giacenza + contatori.attesa(r)} onCambia={(unita) => contatori.cambia(r, unita)} /> : numero(r.giacenza)),
    },
    {
      titolo: "Supply",
      destra: true,
      cella: (r) => {
        if (!puoScrivere) return r.in_arrivo ? `${numero(r.in_arrivo)} on the way` : "–"
        return r.in_arrivo ? (
          <button type="button" className="mag-azione mag-azione--primaria" onClick={() => void ricevi(r)}><PackageCheck size={16} aria-hidden="true" /> Shelve {numero(r.in_arrivo)}</button>
        ) : (
          <button type="button" className="mag-azione" onClick={() => void rifornisci(r)}><PackagePlus size={16} aria-hidden="true" /> Restock</button>
        )
      },
    },
  ]

  const esporta = async () => {
    setEsporto(true)
    try {
      const { righe, vede_valore } = await api<ElencoScorte>(`${base}?${interrogazione({ ...filtri, tutte: 1 })}`)
      scaricaCsv(
        "inventory",
        ["Product", "Variant", "SKU", ...(admin ? ["Company"] : []), "Warehouse", "In stock", "Reserved", "Available", "On the way", "Reorder point", "Sold 30d", "Status", "Last counted", ...(vede_valore ? ["Supply price", "Value at cost"] : [])],
        righe.map((r) => csv(r, admin, vede_valore))
      )
      avvisa(`Exported ${numero(righe.length)} rows`)
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setEsporto(false)
    }
  }

  const attenzione = stato === "attenzione"

  return (
    <>
      {dati ? <Tessere riepilogo={dati.riepilogo} vedeValore={dati.vede_valore} /> : null}
      <section className="mag-stock vetro">
        <header className="mag-stock__testa">
          <div>
            <h2>Stock</h2>
            <p>Most urgent first, measured against each item's reorder point</p>
          </div>
          <div className="mag-stock__azioni">
            <Sezioni />
            <div className="selettore" role="group" aria-label="Filter stock">
              <button type="button" className={attenzione ? "" : "attivo"} aria-pressed={!attenzione} onClick={() => setStato("")}>Everything</button>
              <button type="button" className={attenzione ? "attivo" : ""} aria-pressed={attenzione} onClick={() => setStato("attenzione")}>Needs attention</button>
            </div>
          </div>
        </header>
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
          <select aria-label="Stock status" value={attenzione ? "" : stato} onChange={(e) => setStato(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATI_SCORTA).map(([valore, s]) => <option key={valore} value={valore}>{s.testo}</option>)}
          </select>
          <span className="spazio" />
          <button type="button" className="mag-azione" disabled={esporto || !dati?.conteggio} onClick={() => void esporta()}>
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
        {dati?.righe.length ? <Tabella etichetta="Stock" colonne={colonne} righe={righe} chiave={(r) => r.id} /> : null}
        {dati && dati.conteggio > dati.righe.length ? (
          <footer className="mag-piede">
            <span>{numero(dati.righe.length)} of {numero(dati.conteggio)}</span>
            <button type="button" className="mag-azione" onClick={() => setQuanti((n) => n + PER_PAGINA)}>Show {numero(Math.min(PER_PAGINA, dati.conteggio - dati.righe.length))} more</button>
          </footer>
        ) : null}
      </section>
      <AvvisoAnnulla avviso={avviso} onAnnulla={annulla} />
    </>
  )
}
