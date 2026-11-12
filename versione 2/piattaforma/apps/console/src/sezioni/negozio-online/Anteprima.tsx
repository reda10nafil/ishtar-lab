import { useQuery } from "@tanstack/react-query"
import { ShoppingBag } from "lucide-react"
import { useEffect, useRef } from "react"
import { anima, CURVE } from "../../movimenti"
import { api } from "../../api/client"
import { euro } from "../../ui"
import { iniziali } from "../cassa/dati"
import type { DatiVetrina, PaginaNegozio, ProdottoVetrina } from "./tipi"

/** Finestra finta del sito: testi e pagine salvati, prodotti veri in vendita. */
export function Anteprima({ vetrina, pagine }: { vetrina: DatiVetrina; pagine: PaginaNegozio[] }) {
  const finestra = useRef<HTMLDivElement>(null)
  const { data } = useQuery({
    queryKey: ["negozio-online", "vetrina"],
    queryFn: () => api<{ prodotti: ProdottoVetrina[]; conteggio: number }>("/admin/negozio-online/vetrina"),
  })

  // Quando cambia il colore la finestra fa un piccolo sussulto.
  const primo = useRef(true)
  useEffect(() => {
    if (primo.current) {
      primo.current = false
      return
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    finestra.current?.animate([{ transform: "scale(1)" }, { transform: "scale(0.9965)", offset: 0.25 }, { transform: "scale(1.002)", offset: 0.55 }, { transform: "scale(1)" }], { duration: 480, easing: "ease-in-out" })
  }, [vetrina.accento])

  const voci = pagine.filter((p) => p.visibile).map((p) => p.titolo)
  const prodotti = data?.prodotti ?? []

  // I prodotti saltano fuori uno alla volta quando arrivano.
  const griglia = useRef<HTMLDivElement>(null)
  const quanti = prodotti.length
  useEffect(() => {
    Array.from(griglia.current?.children ?? []).forEach((prodotto, indice) => {
      anima(prodotto, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 240 + indice * 70, easing: CURVE.modale })
    })
  }, [quanti])

  return (
    <div className="sito" data-accento={vetrina.accento} ref={finestra}>
      <div className="sito__cornice">
        <i /><i /><i />
        <span>No address yet</span>
      </div>
      <div className="sito__annuncio">{vetrina.annuncio || "Your announcement shows here"}</div>
      <div className="sito__menu">
        <b>{vetrina.testata || "Your shop"}</b>
        <span>{voci.length ? voci.join(" · ") : "No pages showing"}</span>
        <ShoppingBag size={16} aria-hidden="true" />
      </div>
      <div className="sito__apertura">
        <small>{vetrina.testata || "Your shop"}</small>
        <h3 className={vetrina.messaggio ? undefined : "sito__segnaposto"}>{vetrina.messaggio || "Your message goes here"}</h3>
        <span className="sito__invito">Shop now</span>
      </div>
      {prodotti.length ? (
        <div className="sito__prodotti" ref={griglia}>
          {prodotti.map((p) => (
            <div className="sito__prodotto" key={p.id}>
              <span className="sito__foto">{iniziali(p.titolo)}{p.foto ? <img src={p.foto} alt="" /> : null}</span>
              <b>{p.titolo}</b>
              <small>{euro(p.prezzo_min)}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="sito__nulla">{data ? "Products on sale will show here." : "Loading products..."}</p>
      )}
    </div>
  )
}
