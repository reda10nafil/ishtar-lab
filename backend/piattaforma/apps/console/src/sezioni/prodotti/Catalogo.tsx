import { Download, LayoutGrid, List, PackageSearch, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Outlet, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, useAvvisi, Vuoto } from "../../componenti"
import { scaricaCsv } from "../../esporta"
import { numero, STATI_PRODOTTO, stato as leggiStato } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Pagina, Stato } from "../../ui"
import { BarraBlocco } from "./BarraBlocco"
import { SchedeProdotti } from "./comuni"
import { percorsoCatalogo, useAziende, useCatalogo, type FiltriCatalogo } from "./dati"
import { ElencoProdotti, GrigliaProdotti } from "./ElencoProdotti"
import { NuovoProdotto } from "./NuovoProdotto"
import type { RispostaCatalogo } from "./tipi"

const PER_PAGINA = 24
const ATTESA_DIGITAZIONE = 300
const MASSIMO_ESPORTAZIONE = 1000

const STATI_FILTRO = [
  { valore: "published", testo: "On sale" },
  { valore: "draft", testo: "Drafts" },
  { valore: "proposed", testo: "In review" },
  { valore: "rejected", testo: "Rejected" },
  { valore: "", testo: "All" },
]

async function esporta(filtri: FiltriCatalogo, conMargini: boolean) {
  const { prodotti } = await api<RispostaCatalogo>(percorsoCatalogo({ ...filtri, offset: 0, limit: MASSIMO_ESPORTAZIONE }))
  scaricaCsv(
    "catalogue",
    ["Name", "Status", "Brand", "Company", "Category", "Collection", "Variants", "Price from", "Price to", "Suggested price", ...(conMargini ? ["Supply price"] : []), "Stock"],
    prodotti.map((p) => [
      p.titolo,
      leggiStato(STATI_PRODOTTO, p.stato).testo,
      p.brand,
      p.aziende.map((a) => a.nome).join(", "),
      p.categorie.map((c) => c.nome).join(", "),
      p.collezione?.titolo,
      p.varianti,
      p.prezzo_min,
      p.prezzo_max,
      p.prezzo_consigliato,
      ...(conMargini ? [p.prezzo_cessione] : []),
      p.scorte,
    ])
  )
  return prodotti.length
}

export default function Catalogo() {
  const [parametri, setParametri] = useSearchParams()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [testo, setTesto] = useState(parametri.get("q") ?? "")
  const [scelti, setScelti] = useState<Set<string>>(new Set())

  const pagina = Math.max(1, Number(parametri.get("pagina")) || 1)
  const vista = parametri.get("vista") === "elenco" ? "elenco" : "griglia"
  const filtri = useMemo<FiltriCatalogo>(
    () => ({
      stato: parametri.get("stato") ?? "",
      categoria: parametri.get("categoria") ?? "",
      azienda: parametri.get("azienda") ?? "",
      q: parametri.get("q") ?? "",
      ordine: parametri.get("ordine") ?? "recenti",
    }),
    [parametri]
  )
  const { data, isLoading, error } = useCatalogo({ ...filtri, offset: (pagina - 1) * PER_PAGINA, limit: PER_PAGINA })
  const aziende = useAziende()

  const imposta = (modifiche: Record<string, string>) => {
    setScelti(new Set())
    setParametri(
      (attuali) => {
        const nuovi = new URLSearchParams(attuali)
        for (const [chiave, valore] of Object.entries(modifiche)) {
          if (valore) nuovi.set(chiave, valore)
          else nuovi.delete(chiave)
        }
        if (!("pagina" in modifiche)) nuovi.delete("pagina")
        return nuovi
      },
      { replace: true }
    )
  }

  useEffect(() => {
    const attesa = setTimeout(() => {
      if (testo.trim() !== (parametri.get("q") ?? "")) imposta({ q: testo.trim() })
    }, ATTESA_DIGITAZIONE)
    return () => clearTimeout(attesa)
    // `imposta` cambia a ogni disegno: l'attesa dipende solo dal testo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testo])

  const prodotti = data?.prodotti ?? []
  const conteggi = data?.conteggi ?? {}
  const puoModificare = puo("products", "edit")
  const conFiltri = Boolean(filtri.stato || filtri.categoria || filtri.azienda || filtri.q)

  const scegli = (id: string, attivo: boolean) => {
    setScelti((attuali) => {
      const nuovi = new Set(attuali)
      if (attivo) nuovi.add(id)
      else nuovi.delete(id)
      return nuovi
    })
  }

  const scaricaCatalogo = () => {
    esporta(filtri, puo("margini", "view"))
      .then((quanti) => avvisa(`Exported ${numero(quanti)} products`))
      .catch(segnalaErrore)
  }

  return (
    <Pagina
      titolo="Products"
      sottotitolo={data ? `${numero(conteggi.published)} on sale · ${numero(conteggi.tutti)} in the catalogue from every company.` : "The catalogue from every company."}
      azioni={
        <div className="riga__azioni">
          <button type="button" onClick={scaricaCatalogo} disabled={!prodotti.length}><Download size={17} aria-hidden="true" /> Export CSV</button>
          {puoModificare ? <button type="button" className="primario" onClick={() => imposta({ nuovo: "1" })}><Plus size={17} aria-hidden="true" /> New product</button> : null}
        </div>
      }
    >
      <SchedeProdotti />

      <div className="barra-catalogo">
        <CampoRicerca valore={testo} etichetta="Search by name or code" onCambia={setTesto} />
        {aziende.data ? (
          <select className="filtro-tendina" aria-label="Filter by company" value={filtri.azienda} onChange={(e) => imposta({ azienda: e.target.value })}>
            <option value="">All companies</option>
            {aziende.data.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        ) : null}
        <select className="filtro-tendina" aria-label="Sort by" value={filtri.ordine} onChange={(e) => imposta({ ordine: e.target.value === "recenti" ? "" : e.target.value })}>
          <option value="recenti">Newest first</option>
          <option value="nome">Name A–Z</option>
          <option value="nome_z">Name Z–A</option>
        </select>
        <span className="spazio" />
        <div className="selettore" role="group" aria-label="Status">
          {STATI_FILTRO.map(({ valore, testo: etichetta }) => (
            <button key={etichetta} type="button" className={filtri.stato === valore ? "attivo" : ""} aria-pressed={filtri.stato === valore} onClick={() => imposta({ stato: valore })}>{etichetta}</button>
          ))}
        </div>
        <div className="selettore" role="group" aria-label="View">
          <button type="button" className={vista === "griglia" ? "attivo" : ""} aria-label="Grid" aria-pressed={vista === "griglia"} onClick={() => imposta({ vista: "", pagina: String(pagina) })}><LayoutGrid size={17} aria-hidden="true" /></button>
          <button type="button" className={vista === "elenco" ? "attivo" : ""} aria-label="List" aria-pressed={vista === "elenco"} onClick={() => imposta({ vista: "elenco", pagina: String(pagina) })}><List size={17} aria-hidden="true" /></button>
        </div>
      </div>

      <div className="filtri" role="group" aria-label="Category">
        <button type="button" className={filtri.categoria ? "" : "attivo"} aria-pressed={!filtri.categoria} onClick={() => imposta({ categoria: "" })}>
          Everything <span className="filtri__numero">{numero(data?.categorie?.totale ?? 0)}</span>
        </button>
        {(data?.categorie?.voci ?? []).map((c) => (
          <button key={c.id} type="button" className={filtri.categoria === c.id ? "attivo" : ""} aria-pressed={filtri.categoria === c.id} onClick={() => imposta({ categoria: c.id })}>
            {c.nome} <span className="filtri__numero">{numero(c.conteggio)}</span>
          </button>
        ))}
      </div>

      {puoModificare && scelti.size ? <BarraBlocco scelti={[...scelti]} onFatto={() => setScelti(new Set())} /> : null}

      <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
      {data && !prodotti.length ? (
        <Vuoto
          icona={PackageSearch}
          titolo={conFiltri ? "No products match these filters" : "The catalogue is empty"}
          testo={conFiltri ? "Change the filters or search for another name." : "Add the first product, or invite a company to upload theirs."}
          azione={conFiltri ? <button type="button" onClick={() => { setTesto(""); setParametri({}, { replace: true }) }}>Clear filters</button> : undefined}
        />
      ) : null}
      {prodotti.length && vista === "griglia" ? <GrigliaProdotti prodotti={prodotti} scelti={scelti} onScegli={puoModificare ? scegli : undefined} /> : null}
      {prodotti.length && vista === "elenco" ? <ElencoProdotti prodotti={prodotti} scelti={scelti} onScegli={puoModificare ? scegli : undefined} /> : null}

      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={data?.totale ?? 0} onCambia={(nuova) => imposta({ pagina: nuova > 1 ? String(nuova) : "" })} />

      {parametri.get("nuovo") && puoModificare ? <NuovoProdotto onChiudi={() => imposta({ nuovo: "" })} /> : null}
      <Outlet />
    </Pagina>
  )
}
