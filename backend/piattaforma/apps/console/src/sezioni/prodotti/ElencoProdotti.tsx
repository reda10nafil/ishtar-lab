import { Link, useLocation, useNavigate } from "react-router-dom"
import { Tabella, type Colonna } from "../../componenti"
import { numero, STATI_PRODOTTO, stato as leggiStato } from "../../lingua"
import { Etichetta } from "../../ui"
import { ChipScorte, FotoProdotto, prezzoDa } from "./comuni"
import type { ProdottoElenco } from "./tipi"

const IN_VENDITA = "published"

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

export function GrigliaProdotti({ prodotti, scelti, onScegli }: Proprieta) {
  const { search } = useLocation()
  return (
    <div className="griglia-prodotti">
      {prodotti.map((p) => {
        const stato = leggiStato(STATI_PRODOTTO, p.stato)
        return (
          <article key={p.id} className={`prodotto vetro${scelti.has(p.id) ? " prodotto--scelto" : ""}`}>
            {onScegli ? <span className="prodotto__scelta"><Scelta prodotto={p} scelti={scelti} onScegli={onScegli} /></span> : null}
            {p.stato === IN_VENDITA ? null : <span className="prodotto__stato"><Etichetta tono={stato.tono}>{stato.testo}</Etichetta></span>}
            <Link to={`/prodotti/catalogo/${p.id}${search}`} className="prodotto__apri">
              <FotoProdotto url={p.foto} titolo={p.titolo} classe="prodotto__foto" />
              <span className="prodotto__corpo">
                <strong>{p.titolo}</strong>
                <small>{[p.categorie[0]?.nome, quanteVarianti(p)].filter(Boolean).join(" · ")}</small>
                <small>{nomeAziende(p)}</small>
                <span className="prodotto__piede">
                  <span className="prodotto__prezzo">{prezzoDa(p.prezzo_min, p.prezzo_max)}</span>
                  <ChipScorte scorte={p.scorte} />
                </span>
              </span>
            </Link>
          </article>
        )
      })}
    </div>
  )
}

export function ElencoProdotti({ prodotti, scelti, onScegli }: Proprieta) {
  const naviga = useNavigate()
  const { search } = useLocation()
  const colonne: Colonna<ProdottoElenco>[] = [
    {
      titolo: "Product",
      cella: (p) => (
        <span className="prodotto-riga">
          {onScegli ? <Scelta prodotto={p} scelti={scelti} onScegli={onScegli} /> : null}
          <FotoProdotto url={p.foto} titolo={p.titolo} classe="prodotto-riga__foto" />
          <strong>{p.titolo}</strong>
        </span>
      ),
    },
    {
      titolo: "Status",
      cella: (p) => {
        const stato = leggiStato(STATI_PRODOTTO, p.stato)
        return <Etichetta tono={stato.tono}>{stato.testo}</Etichetta>
      },
    },
    { titolo: "Company", cella: nomeAziende },
    { titolo: "Category", cella: (p) => p.categorie[0]?.nome ?? "–" },
    { titolo: "Variants", cella: (p) => numero(p.varianti), destra: true },
    { titolo: "Stock", cella: (p) => <ChipScorte scorte={p.scorte} />, destra: true },
    { titolo: "Price", cella: (p) => <span className="senza-a-capo">{prezzoDa(p.prezzo_min, p.prezzo_max)}</span>, destra: true },
  ]
  return <Tabella colonne={colonne} righe={prodotti} chiave={(p) => p.id} etichetta="Product list" onApri={(p) => naviga(`/prodotti/catalogo/${p.id}${search}`)} />
}
