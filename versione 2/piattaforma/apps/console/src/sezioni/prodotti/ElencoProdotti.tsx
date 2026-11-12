import { useLayoutEffect, useRef } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Tabella, type Colonna } from "../../componenti"
import { numero } from "../../lingua"
import { entraRighe } from "../../movimenti"
import { ChipScorte, FotoProdotto, prezzoBreve } from "./comuni"
import { useGrigliaViva } from "./griglia"
import type { ProdottoElenco } from "./tipi"

type Proprieta = {
  prodotti: ProdottoElenco[]
  scelti: Set<string>
  /** Assente per chi non può modificare: niente caselle di selezione. */
  onScegli?: (id: string, attivo: boolean) => void
}

const nomeAziende = (p: ProdottoElenco) => {
  const [prima, ...altre] = p.aziende
  if (!prima) return "No company"
  return altre.length ? `${prima.nome} +${numero(altre.length)}` : prima.nome
}

const quanteVarianti = (p: ProdottoElenco) => `${numero(p.varianti)} ${p.varianti === 1 ? "variant" : "variants"}`

const Scelta = ({ prodotto, scelti, onScegli }: { prodotto: ProdottoElenco; scelti: Set<string>; onScegli: (id: string, attivo: boolean) => void }) => (
  <input
    type="checkbox"
    className="casella"
    aria-label={`Select ${prodotto.titolo}`}
    checked={scelti.has(prodotto.id)}
    onClick={(e) => e.stopPropagation()}
    onChange={(e) => onScegli(prodotto.id, e.target.checked)}
  />
)

export function GrigliaProdotti({ prodotti, categoria, scelti, onScegli }: Proprieta & { categoria: string }) {
  const { search } = useLocation()
  const griglia = useRef<HTMLDivElement>(null)
  const mostrati = useGrigliaViva(prodotti, categoria, griglia)
  return (
    <div className={`griglia-prodotti${scelti.size ? " griglia-prodotti--selezione" : ""}`} data-fermo="" ref={griglia}>
      {mostrati.map((p) => (
        <article key={p.id} className={`prodotto vetro${scelti.has(p.id) ? " prodotto--scelto" : ""}`} data-id={p.id}>
          {onScegli ? <span className="prodotto__scelta"><Scelta prodotto={p} scelti={scelti} onScegli={onScegli} /></span> : null}
          <Link to={`/prodotti/catalogo/${p.id}${search}`} className="prodotto__apri">
            <FotoProdotto url={p.foto} titolo={p.titolo} tinta={p.tinta} classe="prodotto__foto" />
            <span className="prodotto__corpo">
              <span className="prodotto__testo">
                <b>{p.titolo}</b>
                <small>{[p.categorie[0]?.nome, quanteVarianti(p), nomeAziende(p)].filter(Boolean).join(" · ")}</small>
              </span>
              <span className="prodotto__piede">
                <b className="prodotto__prezzo">{prezzoBreve(p.prezzo_min, p.prezzo_max)}</b>
                <ChipScorte scorte={p.scorte} bassa={p.scorte_basse} />
              </span>
            </span>
          </Link>
        </article>
      ))}
    </div>
  )
}

export function ElencoProdotti({ prodotti, scelti, onScegli }: Proprieta) {
  const naviga = useNavigate()
  const { search } = useLocation()
  const involucro = useRef<HTMLDivElement>(null)
  // Passando dalle carte all'elenco le righe entrano in sequenza: la tabella reagisce solo ai cambi di dati.
  useLayoutEffect(() => {
    if (involucro.current) entraRighe(involucro.current)
  }, [])
  const colonne: Colonna<ProdottoElenco>[] = [
    {
      titolo: "Product",
      cella: (p) => (
        <span className="prodotto-riga">
          {onScegli ? <Scelta prodotto={p} scelti={scelti} onScegli={onScegli} /> : null}
          <FotoProdotto url={p.foto} titolo={p.titolo} tinta={p.tinta} classe="prodotto-riga__foto" />
          <span className="prodotto-riga__testo">
            <b>{p.titolo}</b>
            <small>{p.sku ?? "No SKU"}</small>
          </span>
        </span>
      ),
    },
    { titolo: "Type", cella: (p) => <span className="testo-cella">{p.categorie[0]?.nome ?? "–"}</span> },
    { titolo: "Company", cella: (p) => <span className="testo-cella">{nomeAziende(p)}</span> },
    { titolo: "Stock", cella: (p) => <ChipScorte scorte={p.scorte} bassa={p.scorte_basse} /> },
    { titolo: "Sold · 30d", cella: (p) => <b>{numero(p.venduti_30)}</b>, destra: true },
    { titolo: "Price", cella: (p) => <b className="senza-a-capo">{prezzoBreve(p.prezzo_min, p.prezzo_max)}</b>, destra: true },
  ]
  return (
    <div className="elenco-prodotti" ref={involucro}>
      <Tabella colonne={colonne} righe={prodotti} chiave={(p) => p.id} etichetta="Product list" onApri={(p) => naviga(`/prodotti/catalogo/${p.id}${search}`)} />
    </div>
  )
}
