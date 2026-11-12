import { Download, LayoutGrid, List, PackageSearch, Plus } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Outlet, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, useAvvisi, Vuoto } from "../../componenti"
import { scaricaCsv } from "../../esporta"
import { numero, stato as leggiStato } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Pagina, Stato } from "../../ui"
import { BarraBlocco } from "./BarraBlocco"
import { Segmento, SchedeProdotti, STATI_CATALOGO } from "./comuni"
import { percorsoCatalogo, useAziende, useCatalogo, type FiltriCatalogo } from "./dati"
import { ElencoProdotti, GrigliaProdotti } from "./ElencoProdotti"
import { NuovoProdotto } from "./NuovoProdotto"
import type { RispostaCatalogo } from "./tipi"

const PER_PAGINA = 24
const ATTESA_DIGITAZIONE = 300
const MASSIMO_ESPORTAZIONE = 1000
const IN_VENDITA = "published"

const STATI_FILTRO = [
  { valore: IN_VENDITA, testo: "On sale" },
  { valore: "draft", testo: "Drafts" },
  { valore: "archived", testo: "Archived" },
]

/** Stati che nascono dalle aziende: compaiono solo quando c'è qualcosa da vedere. */
const STATI_AZIENDE = [
  { valore: "proposed", testo: "In review" },
  { valore: "rejected", testo: "Rejected" },
]

const NOME_STATO: Record<string, string> = {
  published: "products on sale",
  draft: "drafts",
  archived: "archived products",
  proposed: "products in review",
  rejected: "rejected products",
}

const VISTE = [
  { valore: "griglia", etichetta: "Grid", icona: <LayoutGrid size={16} aria-hidden="true" /> },
  { valore: "elenco", etichetta: "List", icona: <List size={16} aria-hidden="true" /> },
]

async function esporta(filtri: FiltriCatalogo, conMargini: boolean) {
  const { prodotti } = await api<RispostaCatalogo>(percorsoCatalogo({ ...filtri, offset: 0, limit: MASSIMO_ESPORTAZIONE }))
  scaricaCsv(
    "catalogue",
    ["Name", "Status", "Brand", "Company", "Category", "Collection", "Variants", "Price from", "Price to", "Suggested price", ...(conMargini ? ["Supply price"] : []), "Stock", "Sold 30 days"],
    prodotti.map((p) => [
      p.titolo,
      leggiStato(STATI_CATALOGO, p.stato).testo,
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
      p.venduti_30,
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
  const statoScelto = parametri.get("stato") ?? IN_VENDITA
  const filtri = useMemo<FiltriCatalogo>(
    () => ({
      stato: statoScelto,
      categoria: parametri.get("categoria") ?? "",
      azienda: parametri.get("azienda") ?? "",
      q: parametri.get("q") ?? "",
    }),
    [parametri, statoScelto]
  )
  const { data, isLoading, error, isPlaceholderData } = useCatalogo({ ...filtri, offset: (pagina - 1) * PER_PAGINA, limit: PER_PAGINA })
  // Stato, azienda e pagina danno una griglia nuova, che entra a molla quando arrivano i suoi dati.
  const griglia = useRef("")
  if (!isPlaceholderData) griglia.current = [statoScelto, filtri.azienda, pagina].join("|")
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
  const puoModificare = puo("products", "edit")
  const voci = [...STATI_FILTRO, ...STATI_AZIENDE.filter((v) => v.valore === statoScelto || (data?.conteggi[v.valore] ?? 0) > 0)]
  const pulisci = () => {
    setTesto("")
    imposta({ q: "", categoria: "", azienda: "" })
  }

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
      sottotitolo={data ? `${numero(data.conteggi.published)} on sale · ${numero(data.conteggi.tutti)} in the catalogue.` : "The catalogue from every company."}
      azioni={puoModificare ? <button type="button" className="primario azione-testa" onClick={() => imposta({ nuovo: "1" })}><Plus size={18} aria-hidden="true" /> New product</button> : undefined}
    >
      <SchedeProdotti />

      <div className="catalogo-prodotti">
        <div className="barra-catalogo">
          <CampoRicerca valore={testo} etichetta="Search by name, composition or SKU" onCambia={setTesto} />
          {aziende.data ? (
            <select className="filtro-tendina" aria-label="Filter by company" value={filtri.azienda} onChange={(e) => imposta({ azienda: e.target.value })}>
              <option value="">All companies</option>
              {aziende.data.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          ) : null}
          <div className="barra-catalogo__fine">
            <Segmento etichetta="Status" voci={voci} valore={statoScelto} onCambia={(valore) => imposta({ stato: valore === IN_VENDITA ? "" : valore })} />
            <Segmento etichetta="View" voci={VISTE} valore={vista} onCambia={(valore) => imposta({ vista: valore === "griglia" ? "" : valore, pagina: String(pagina) })} />
            <button type="button" className="icona-pulsante barra-catalogo__esporta" aria-label="Export CSV" title="Export CSV" onClick={scaricaCatalogo} disabled={!prodotti.length}><Download size={16} aria-hidden="true" /></button>
          </div>
        </div>

        <div className="pillole" role="group" aria-label="Category">
          <button type="button" className={filtri.categoria ? "" : "attivo"} aria-pressed={!filtri.categoria} onClick={() => imposta({ categoria: "" })}>
            Everything <span>{numero(data?.categorie?.totale ?? 0)}</span>
          </button>
          {(data?.categorie?.voci ?? []).map((c) => (
            <button key={c.id} type="button" className={filtri.categoria === c.id ? "attivo" : ""} aria-pressed={filtri.categoria === c.id} onClick={() => imposta({ categoria: c.id })}>
              {c.nome} <span>{numero(c.conteggio)}</span>
            </button>
          ))}
        </div>

        {puoModificare && scelti.size ? <BarraBlocco scelti={[...scelti]} onFatto={() => setScelti(new Set())} /> : null}

        <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
        {data && !prodotti.length ? (
          <Vuoto
            icona={PackageSearch}
            titolo="Nothing here"
            testo={filtri.q ? `No ${NOME_STATO[statoScelto] ?? "products"} match “${filtri.q}”.` : "Try another type or status."}
            azione={<button type="button" onClick={pulisci}>Clear filters</button>}
          />
        ) : null}
        {prodotti.length && vista === "griglia" ? <GrigliaProdotti key={griglia.current} prodotti={prodotti} categoria={filtri.categoria ?? ""} scelti={scelti} onScegli={puoModificare ? scegli : undefined} /> : null}
        {prodotti.length && vista === "elenco" ? <ElencoProdotti prodotti={prodotti} scelti={scelti} onScegli={puoModificare ? scegli : undefined} /> : null}

        <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={data?.totale ?? 0} onCambia={(nuova) => imposta({ pagina: nuova > 1 ? String(nuova) : "" })} />
      </div>

      {parametri.get("nuovo") && puoModificare ? <NuovoProdotto onChiudi={() => imposta({ nuovo: "" })} /> : null}
      <Outlet />
    </Pagina>
  )
}
