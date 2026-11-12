import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Check, ClipboardCheck, Lightbulb, Package, PackagePlus, Plus, Send, ShieldCheck, Truck } from "lucide-react"
import type { KeyboardEvent, MouseEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { api } from "../../../api/client"
import { useAvvisi } from "../../../componenti"
import { Barra } from "../../../componenti/Grafici"
import { fa, numero } from "../../../lingua"
import { euro } from "../../../ui"
import { Avatar, Miniatura } from "../comuni"
import type { Coda, Migliore, PanoramicaAdmin, RigaCoda, ScortaBassa } from "../tipi"

function Vuota({ testo }: { testo: string }) {
  return <p className="pan-vuota">{testo}</p>
}

/** Pagato, preparato, spedito: nella coda il punto attivo è sempre la preparazione. */
function Passi({ pagato, preparato }: { pagato: boolean; preparato: boolean }) {
  return (
    <ol className="pan-passi" aria-label={preparato ? "Packed, waiting to ship" : pagato ? "Paid, waiting to be packed" : "Waiting for payment"}>
      <li>
        <span className={pagato ? "fatto" : "attivo"}>{pagato ? <Check size={10} strokeWidth={3.5} aria-hidden="true" /> : null}</span>
        <em className={pagato ? "pieno" : undefined} />
      </li>
      <li>
        <span className={preparato ? "fatto" : pagato ? "attivo" : undefined}>{preparato ? <Check size={10} strokeWidth={3.5} aria-hidden="true" /> : null}</span>
        <em className={preparato ? "pieno" : undefined} />
      </li>
      <li>
        <span className={preparato ? "attivo" : undefined} />
      </li>
    </ol>
  )
}

function RigaImballo({ riga, azienda }: { riga: RigaCoda; azienda: boolean }) {
  const naviga = useNavigate()
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [, setCerca] = useSearchParams()
  const nome = riga.cliente ?? `Order #${riga.numero}`
  const aggiorna = () => client.invalidateQueries({ queryKey: ["panoramica"] })
  const passo = (azione: "prepara" | "spedisci") =>
    azienda ? Promise.all(riga.richieste.map((r) => api(`/vendor/evasioni/${r.ordine}/${azione}`, { corpo: {} }))) : api(`/admin/ordini/${riga.id}/avanza`, { corpo: {} })
  const disfa = () =>
    Promise.all(riga.richieste.map((r) => api(azienda ? `/vendor/evasioni/${r.ordine}/riapri` : `/admin/evasioni/${r.ordine}/${r.azienda}/riapri`, { corpo: {} })))
      .then(aggiorna)
      .catch(segnalaErrore)
  const avanza = useMutation({
    mutationFn: () => passo(riga.preparato ? "spedisci" : "prepara"),
    onSuccess: () => {
      aggiorna()
      if (riga.preparato) avvisa(`#${riga.numero} shipped`)
      else avvisa(`#${riga.numero} packed`, { etichetta: "Undo", esegui: () => void disfa() })
    },
    onError: segnalaErrore,
  })
  const apri = () => (azienda ? naviga("/evasioni") : setCerca({ ordine: riga.id }))
  const premi = (e: MouseEvent) => {
    e.stopPropagation()
    avanza.mutate()
  }
  const tasto = (e: KeyboardEvent) => {
    if (e.key === "Enter" && e.target === e.currentTarget) apri()
  }
  return (
    <div className="pan-coda__riga" data-riga role="button" tabIndex={0} aria-label={`Open order #${riga.numero}`} onClick={apri} onKeyDown={tasto}>
      <span className="pan-coda__numero">#{riga.numero}</span>
      <span className="pan-coda__cliente">
        <Avatar nome={nome} />
        <span>
          <b>{nome}</b>
          <small>{fa(riga.quando)}{riga.pagato ? "" : " · awaiting payment"}</small>
        </span>
      </span>
      <span className="pan-coda__articoli">
        {riga.righe.map((r, i) => <Miniatura key={`${r.titolo}-${i}`} nome={r.titolo} url={r.miniatura} />)}
      </span>
      <Passi pagato={riga.pagato} preparato={riga.preparato} />
      <b className="pan-coda__totale">{riga.totale === null ? `${numero(riga.unita)} ${riga.unita === 1 ? "unit" : "units"}` : euro(riga.totale)}</b>
      <button type="button" className="primario pan-piccolo" disabled={!riga.pagato || avanza.isPending} onClick={premi}>
        {riga.preparato ? <Truck size={16} aria-hidden="true" /> : <Package size={16} aria-hidden="true" />} {riga.preparato ? "Ship" : "Pack"}
      </button>
    </div>
  )
}

export function CodaImballo({ coda, azienda = false }: { coda: Coda; azienda?: boolean }) {
  const sotto = coda.da_preparare || coda.pronti ? `${numero(coda.da_preparare)} to pack · ${numero(coda.pronti)} packed and ready to ship` : "Nothing waiting"
  return (
    <section className="pan-coda vetro" data-blocco aria-label="Packing queue">
      <div className="pan-testa pan-testa--coda">
        <div>
          <h2>Packing queue</h2>
          <p>{sotto}</p>
        </div>
        <Link to={azienda ? "/evasioni" : "/ordini/tutti"} className="pan-collegamento">
          {azienda ? "Fulfilment" : "All orders"} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="pan-coda__righe">
        {coda.voci.length ? coda.voci.map((r) => <RigaImballo key={r.id} riga={r} azienda={azienda} />) : <Vuota testo="Orders waiting to be packed appear here." />}
      </div>
    </section>
  )
}

export function PiuVenduti({ voci, azienda = false }: { voci: Migliore[] | null; azienda?: boolean }) {
  const massimo = Math.max(1, ...(voci ?? []).map((v) => v.unita))
  return (
    <section className="pan-migliori vetro" data-blocco aria-label="Best sellers">
      <div className="pan-testa">
        <div>
          <h2>Best sellers</h2>
          <p>Units sold in the last 7 days</p>
        </div>
        <Link to={azienda ? "/prodotti" : "/prodotti/catalogo"} className="pan-testo-collegamento">Catalogue</Link>
      </div>
      {voci?.length ? (
        <ol>
          {voci.map((v, i) => (
            <li key={v.id}>
              <Link to={azienda ? "/prodotti" : `/prodotti/catalogo/${v.id}`}>
                <span className="pan-migliori__posto">{i + 1}</span>
                <Miniatura nome={v.nome} url={v.miniatura} classe="miniatura--grande" />
                <span className="pan-migliori__nome">
                  <b>{v.nome}</b>
                  <small>{v.importo === undefined ? `${numero(v.unita)} ${v.unita === 1 ? "unit" : "units"}` : euro(v.importo)}</small>
                </span>
                <span className="pan-migliori__quanti">{numero(v.unita)}</span>
              </Link>
              <Barra quota={v.unita / massimo} classe="pan-migliori__barra" ritardo={420 + i * 55} />
            </li>
          ))}
        </ol>
      ) : (
        <Vuota testo="Products that sell in the last 7 days appear here." />
      )}
    </section>
  )
}

function RigaScorta({ scorta: s, azienda, puoChiedere }: { scorta: ScortaBassa; azienda: boolean; puoChiedere: boolean }) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const nome = [s.prodotto, s.variante].filter(Boolean).join(" · ") || "Item"
  const percorso = `${azienda ? "/vendor" : "/admin"}/magazzino/articoli/${s.articolo_id}/rifornimento`
  const aggiorna = () => client.invalidateQueries({ queryKey: ["scorte-basse"] })
  const chiedi = useMutation({
    mutationFn: () => api<{ quantita: number }>(percorso, { corpo: { deposito_id: s.deposito_id } }),
    onSuccess: ({ quantita }) => {
      aggiorna()
      avvisa(`Restock of ${numero(quantita)} ${nome} requested`, {
        etichetta: "Undo",
        esegui: () => void api(percorso, { corpo: { deposito_id: s.deposito_id, quantita: -quantita } }).then(aggiorna).catch(segnalaErrore),
      })
    },
    onError: segnalaErrore,
  })
  const stato = s.disponibili <= 0 ? "Sold out" : `${numero(s.disponibili)} left · reorder at ${numero(s.soglia)}`
  return (
    <div className="pan-scorte__riga" data-riga>
      <Miniatura nome={nome} url={s.miniatura} />
      <span>
        <b>{nome}</b>
        <small>{s.in_arrivo ? `${stato} · ${numero(s.in_arrivo)} on the way` : stato}</small>
      </span>
      <Barra quota={s.soglia ? s.disponibili / s.soglia : 0} colore="var(--serie-negozio)" classe="pan-scorte__barra" ritardo={620} />
      <button type="button" className="pan-collegamento" disabled={Boolean(s.in_arrivo) || !puoChiedere || chiedi.isPending} onClick={() => chiedi.mutate()}>
        {s.in_arrivo ? <Truck size={16} aria-hidden="true" /> : <PackagePlus size={16} aria-hidden="true" />} {s.in_arrivo ? "On the way" : "Restock"}
      </button>
    </div>
  )
}

export function ScorteBasse({ azienda = false, puoChiedere }: { azienda?: boolean; puoChiedere: boolean }) {
  const percorso = azienda ? "/vendor/magazzino/scorte-basse" : "/admin/magazzino/scorte-basse"
  const { data } = useQuery({ queryKey: ["scorte-basse", azienda], queryFn: () => api<{ scorte_basse: ScortaBassa[]; conteggio: number }>(percorso) })
  const voci = data?.scorte_basse.slice(0, 4) ?? []
  return (
    <section className="pan-scorte vetro" data-blocco aria-label="Running low">
      <div className="pan-testa">
        <div>
          <h2>Running low</h2>
          <p>At or under the reorder point</p>
        </div>
        <Link to="/magazzino" className="pan-testo-collegamento">Inventory</Link>
      </div>
      {voci.length ? voci.map((s) => <RigaScorta key={s.id} scorta={s} azienda={azienda} puoChiedere={puoChiedere} />) : <Vuota testo={data ? "Everything is above its reorder point." : "Checking stock levels"} />}
    </section>
  )
}

export function AttivitaTeam({ dati }: { dati: NonNullable<PanoramicaAdmin["attivita"]> }) {
  const persone = dati.persone_oggi
  return (
    <section className="pan-team vetro" data-blocco aria-label="Team activity">
      <div className="pan-testa">
        <div>
          <h2>Team activity</h2>
          <p>{persone ? `${numero(persone)} ${persone === 1 ? "person" : "people"} on today` : "Nobody on today"}</p>
        </div>
      </div>
      {dati.voci.length ? (
        <ul>
          {dati.voci.map((v) => {
            const azione = v.azione.charAt(0).toLowerCase() + v.azione.slice(1)
            return (
              <li key={v.id} data-riga>
                <Avatar nome={v.chi} />
                <span>
                  <b>{v.chi}</b> {v.a ? <Link to={v.a}>{azione}</Link> : azione}
                  <small>{fa(v.quando)}</small>
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <Vuota testo="What your team does in the panel appears here." />
      )}
    </section>
  )
}

export function Spunto({ dati, onPianifica }: { dati: { titolo: string; testo: string }; onPianifica?: () => void }) {
  return (
    <section className="pan-approva vetro" data-blocco aria-label="Insight">
      <span className="pan-approva__icona"><Lightbulb size={20} aria-hidden="true" /></span>
      <div>
        <small>Insight</small>
        <h3>{dati.titolo}</h3>
        <p>{dati.testo}</p>
      </div>
      {onPianifica ? <button type="button" className="primario" onClick={onPianifica}><Send size={18} aria-hidden="true" /> Plan a send</button> : null}
    </section>
  )
}

function usaInAttesa() {
  const prodotti = useQuery({ queryKey: ["panoramica", "revisione"], queryFn: () => api<{ count: number; products: { title: string }[] }>("/admin/products?status[]=proposed&limit=2&fields=id,title") })
  const modifiche = useQuery({ queryKey: ["panoramica", "modifiche"], queryFn: () => api<{ product_changes: { status: string }[] }>("/admin/product-changes?limit=100") })
  const quanti = prodotti.data?.count ?? 0
  return {
    quanti,
    esempi: prodotti.data?.products.map((p) => p.title).join(" and "),
    inAttesa: modifiche.data?.product_changes.filter((m) => m.status === "pending").length ?? 0,
    titolo: quanti ? `${numero(quanti)} ${quanti === 1 ? "product" : "products"} waiting for you` : "Nothing waiting for review",
  }
}

/** Con il blocco Insight al suo posto, i prodotti da approvare stanno in una striscia sotto. */
export function StrisciaApprovare() {
  const naviga = useNavigate()
  const { quanti, inAttesa, titolo } = usaInAttesa()
  if (!quanti && !inAttesa) return null
  return (
    <div className="pan-striscia vetro" data-blocco>
      <ClipboardCheck size={20} aria-hidden="true" />
      <span><b>{titolo}</b>{inAttesa ? ` · ${numero(inAttesa)} ${inAttesa === 1 ? "change" : "changes"} to approve as well` : ""}</span>
      <button type="button" className="pan-collegamento" onClick={() => naviga("/revisione")}><ShieldCheck size={16} aria-hidden="true" /> Open review</button>
    </div>
  )
}

/** Senza dati per il blocco Insight, quel posto va ai prodotti in attesa. */
export function DaApprovare() {
  const naviga = useNavigate()
  const { quanti, inAttesa, esempi, titolo } = usaInAttesa()
  const parti = [esempi ? `${esempi}${quanti > 2 ? " and more" : ""} from your companies.` : "New products from your companies appear here before they go on sale.", inAttesa ? `${numero(inAttesa)} ${inAttesa === 1 ? "change" : "changes"} to approve as well.` : ""]
  return (
    <section className="pan-approva vetro" data-blocco aria-label="To approve">
      <span className="pan-approva__icona"><ClipboardCheck size={20} aria-hidden="true" /></span>
      <div>
        <small>To approve</small>
        <h3>{titolo}</h3>
        <p>{parti.filter(Boolean).join(" ")}</p>
      </div>
      <button type="button" className="primario" onClick={() => naviga("/revisione")}>
        <ShieldCheck size={18} aria-hidden="true" /> Open review
      </button>
    </section>
  )
}

export function ProdottiInRevisione() {
  const naviga = useNavigate()
  const { data } = useQuery({ queryKey: ["panoramica", "miei-revisione"], queryFn: () => api<{ count: number }>("/vendor/products?limit=1&status[]=proposed&fields=id") })
  const quanti = data?.count ?? 0
  return (
    <section className="pan-approva vetro" data-blocco aria-label="In review">
      <span className="pan-approva__icona"><ClipboardCheck size={20} aria-hidden="true" /></span>
      <div>
        <small>In review</small>
        <h3>{quanti ? `${numero(quanti)} ${quanti === 1 ? "product" : "products"} in review` : "Nothing in review"}</h3>
        <p>Products you add stay here until the shop approves them.</p>
      </div>
      <button type="button" className="primario" onClick={() => naviga("/prodotti?nuovo=1")}>
        <Plus size={18} aria-hidden="true" /> New product
      </button>
    </section>
  )
}
