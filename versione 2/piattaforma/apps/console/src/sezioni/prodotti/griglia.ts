import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { anima, CURVE, gestoRecente, movimentoRidotto } from "../../movimenti"

/** Tempi misurati a schermo sul pannello, fotogramma per fotogramma. */
const USCITA = 170
const SPOSTAMENTO = 640
const ENTRATA = 450
const PASSO_ENTRATA = 30
const DURATA_MOLLA = 1100
const PASSO_MOLLA = 38
const MASSIMO_PASSI = 20
const PUNTI_MOLLA = 48
/** Il filtro parte da un clic ma i dati arrivano dopo: il gesto resta valido per qualche secondo. */
const GESTO_VALIDO = 4000

const SCALA = 0.94

/** Molla smorzata: supera l'arrivo del 7% e rientra. Il tempo è in secondi. */
const molla = (t: number) => 1 - Math.exp(-5 * t) * (Math.cos(5.93 * t) + 0.843 * Math.sin(5.93 * t))

const CURVA_MOLLA = `linear(${Array.from({ length: PUNTI_MOLLA + 1 }, (_, i) => (i === PUNTI_MOLLA ? 1 : Number(molla(((i / PUNTI_MOLLA) * DURATA_MOLLA) / 1000).toFixed(4)))).join(", ")})`

const carteDi = (griglia: HTMLElement | null) => [...(griglia?.children ?? [])] as HTMLElement[]

/** Ogni griglia nuova entra a molla, con una lieve rotazione alternata. */
export function entraAMolla(griglia: HTMLElement | null) {
  carteDi(griglia).forEach((carta, indice) => {
    const rotazione = indice % 2 ? 2.5 : -2.5
    anima(carta, [
      { opacity: 0, transform: `translateY(40px) scale(0.95) rotate(${rotazione}deg)` },
      { opacity: 1, transform: "translateY(0) scale(1) rotate(0deg)" },
    ], { duration: DURATA_MOLLA, delay: Math.min(indice, MASSIMO_PASSI) * PASSO_MOLLA, easing: CURVA_MOLLA })
  })
}

/**
 * Elenco che la griglia mostra davvero. Cambiando categoria le carte tolte svaniscono, poi quelle che restano
 * scivolano al nuovo posto e le nuove entrano in sequenza. La ricerca e gli aggiornamenti cambiano le carte all'istante.
 */
export function useGrigliaViva<T extends { id: string }>(voci: T[], categoria: string, griglia: RefObject<HTMLElement>) {
  const [mostrate, setMostrate] = useState(voci)
  const categoriaMostrata = useRef(categoria)
  const partenze = useRef<Map<string, DOMRect> | null>(null)

  useLayoutEffect(() => entraAMolla(griglia.current), [griglia])

  useEffect(() => {
    const altra = categoriaMostrata.current !== categoria
    categoriaMostrata.current = categoria
    const carte = carteDi(griglia.current)
    if (!altra || !carte.length || !gestoRecente(GESTO_VALIDO) || movimentoRidotto()) {
      setMostrate(voci)
      return
    }
    partenze.current = new Map(carte.map((carta) => [carta.dataset.id ?? "", carta.getBoundingClientRect()]))
    const restano = new Set(voci.map((voce) => voce.id))
    const uscite = carte
      .filter((carta) => !restano.has(carta.dataset.id ?? ""))
      .map((carta) => anima(carta, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `scale(${SCALA})` }], { duration: USCITA, easing: CURVE.dentro2, fill: "forwards" }))
    const attesa = setTimeout(() => setMostrate(voci), USCITA)
    return () => {
      clearTimeout(attesa)
      uscite.forEach((uscita) => uscita?.cancel())
    }
    // La griglia reagisce ai dati arrivati: la categoria da sola non basta, l'elenco nuovo non c'è ancora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voci])

  useLayoutEffect(() => {
    const inizio = partenze.current
    if (!inizio) return
    partenze.current = null
    let nuove = 0
    for (const carta of carteDi(griglia.current)) {
      const da = inizio.get(carta.dataset.id ?? "")
      if (!da) {
        anima(carta, [{ opacity: 0, transform: `scale(${SCALA})` }, { opacity: 1, transform: "none" }], { duration: ENTRATA, delay: nuove * PASSO_ENTRATA, easing: CURVE.fuori3 })
        nuove += 1
        continue
      }
      const a = carta.getBoundingClientRect()
      if (da.left !== a.left || da.top !== a.top) anima(carta, [{ transform: `translate(${da.left - a.left}px, ${da.top - a.top}px)` }, { transform: "none" }], { duration: SPOSTAMENTO, easing: CURVE.fuori4 })
    }
  }, [griglia, mostrate])

  return mostrate
}
