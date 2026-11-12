import { Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { numero } from "../../lingua"
import { Cifra } from "../../movimenti"
import { euro } from "../../ui"
import { importoBreve, iniziali } from "./dati"
import { entraSchede, sussultoFiltri } from "./movimenti"
import type { Prodotto, RigaCestino, StatoCassa } from "./tipi"

const TUTTO = "tutto"

type Proprieta = {
  stato: StatoCassa
  righe: RigaCestino[]
  onScegli: (prodotto: Prodotto, scheda: HTMLElement) => void
}

function categorieDi(prodotti: Prodotto[]) {
  const voci = new Map<string, string>()
  for (const prodotto of prodotti) for (const categoria of prodotto.categorie) voci.set(categoria.id, categoria.nome)
  return [...voci].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "en"))
}

/** Le tinte vengono dal titolo: lo stesso prodotto ha sempre lo stesso colore. */
const tintaDi = (titolo: string) => [...titolo].reduce((somma, lettera) => somma + lettera.charCodeAt(0), 0) % 5

export function Miniatura({ titolo, foto, classe }: { titolo: string; foto: string | null; classe: string }) {
  const [rotta, setRotta] = useState(false)
  return (
    <span className={`cassa-miniatura ${classe}`} data-tinta={tintaDi(titolo)}>
      <b>{iniziali(titolo)}</b>
      <i aria-hidden="true" />
      {foto && !rotta ? <img src={foto} alt="" loading="lazy" onError={() => setRotta(true)} /> : null}
    </span>
  )
}

function Scheda({ prodotto, nelCestino, onScegli }: { prodotto: Prodotto; nelCestino: number; onScegli: Proprieta["onScegli"] }) {
  const esaurito = prodotto.disponibili <= 0
  const variabile = prodotto.prezzo_min !== prodotto.prezzo_max
  return (
    <button
      type="button"
      className={`cassa-scheda${esaurito ? " cassa-scheda--esaurita" : ""}`}
      disabled={esaurito}
      aria-label={`Add ${prodotto.titolo}, ${euro(prodotto.prezzo_min)}`}
      onClick={(evento) => onScegli(prodotto, evento.currentTarget)}
    >
      <Miniatura titolo={prodotto.titolo} foto={prodotto.foto} classe="cassa-miniatura--grande" />
      <span className="cassa-scheda__nome">{prodotto.titolo}</span>
      <span className="cassa-scheda__piede">
        <b>{variabile ? `From ${euro(prodotto.prezzo_min)}` : euro(prodotto.prezzo_min)}</b>
        <small>{esaurito ? "Sold out" : `${numero(prodotto.disponibili)} left`}</small>
      </span>
      {nelCestino ? <span className="cassa-scheda__conta">{nelCestino}</span> : null}
    </button>
  )
}

/** Griglia dei prodotti in vendita, con ricerca e pillole di categoria. */
export function Scaffale({ stato, righe, onScegli }: Proprieta) {
  const [cerca, setCerca] = useState("")
  const [categoria, setCategoria] = useState(TUTTO)
  const categorie = useMemo(() => categorieDi(stato.prodotti), [stato.prodotti])

  const testo = cerca.trim().toLowerCase()
  const visibili = stato.prodotti.filter(
    (p) => (categoria === TUTTO || p.categorie.some((c) => c.id === categoria)) && (!testo || p.titolo.toLowerCase().includes(testo))
  )
  const griglia = useRef<HTMLDivElement>(null)
  const fila = useRef<HTMLDivElement>(null)
  const firma = visibili.map((p) => p.id).join(",")
  const filtro = useRef(categoria)
  useEffect(() => {
    entraSchede(griglia.current)
    if (filtro.current !== categoria) sussultoFiltri(fila.current)
    filtro.current = categoria
  }, [firma, categoria])

  const nelCestino = (id: string) => righe.filter((r) => r.prodotto_id === id).reduce((totale, r) => totale + r.quantita, 0)

  return (
    <section className="cassa__scaffale vetro" aria-label="Products">
      <div className="cassa__barra-filtri">
        <label className="cassa-cerca">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={cerca} placeholder="Find a product" aria-label="Find a product" onChange={(e) => setCerca(e.target.value)} />
        </label>
        <div className="cassa__oggi">
          <span>Today on the till</span>
          <b><Cifra valore={stato.oggi.incassato} formato={importoBreve} /></b>
          <span>· {numero(stato.oggi.vendite)} {stato.oggi.vendite === 1 ? "sale" : "sales"}</span>
        </div>
      </div>

      <div className="filtri cassa__categorie" role="group" aria-label="Filter by category" ref={fila}>
        <button type="button" className={categoria === TUTTO ? "attivo" : undefined} aria-pressed={categoria === TUTTO} onClick={() => setCategoria(TUTTO)}>Everything</button>
        {categorie.map((c) => (
          <button key={c.id} type="button" className={categoria === c.id ? "attivo" : undefined} aria-pressed={categoria === c.id} onClick={() => setCategoria(c.id)}>{c.nome}</button>
        ))}
      </div>

      {visibili.length ? (
        <div className="cassa__griglia" ref={griglia}>
          {visibili.map((prodotto) => (
            <Scheda key={prodotto.id} prodotto={prodotto} nelCestino={nelCestino(prodotto.id)} onScegli={onScegli} />
          ))}
        </div>
      ) : (
        <p className="cassa__nulla">{stato.prodotti.length ? "Nothing matches" : "Nothing is on sale yet: publish a product with a price and stock to sell it here."}</p>
      )}
    </section>
  )
}
