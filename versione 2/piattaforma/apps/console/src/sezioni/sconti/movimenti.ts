import { useLayoutEffect, useRef, type RefObject } from "react"
import { anima, CURVE, movimentoRidotto } from "../../movimenti"

/** Salita con piccolo rimbalzo finale di carte e trattative: tempi e ampiezze misurati fotogramma per fotogramma. */
const MOLLA: Keyframe[] = [
  { offset: 0, opacity: 0, transform: "translateY(40px) scale(0.949)" },
  { offset: 0.044, opacity: 0.21, transform: "translateY(31.7px) scale(0.96)" },
  { offset: 0.155, opacity: 0.57, transform: "translateY(17.3px) scale(0.978)" },
  { offset: 0.245, opacity: 0.77, transform: "translateY(9px) scale(0.989)" },
  { offset: 0.345, opacity: 0.93, transform: "translateY(2.8px) scale(0.996)" },
  { offset: 0.44, opacity: 1, transform: "translateY(-0.8px) scale(1.001)" },
  { offset: 0.585, opacity: 1, transform: "translateY(-2.8px) scale(1.004)" },
  { offset: 0.78, opacity: 1, transform: "translateY(-1.7px) scale(1.002)" },
  { offset: 1, opacity: 1, transform: "none" },
]

const TENUE = 0.8

export function entraCarte(carte: Iterable<Element>, ritardo = 0, passo = 70) {
  ;[...carte].forEach((carta, i) => {
    // La carta spenta arriva alla sua opacità, senza scatto a fine salita.
    const fotogrammi = carta.classList.contains("sc-carta--spenta") ? MOLLA.map((f) => ({ ...f, opacity: Number(f.opacity) * TENUE })) : MOLLA
    anima(carta, fotogrammi, { duration: 840, delay: ritardo + i * passo, easing: "linear", fill: "backwards" })
  })
}

export function riempiBarre(barre: Iterable<Element>, ritardo = 200) {
  for (const barra of barre) anima(barra, [{ transform: "scaleX(0)" }, { transform: "none" }], { duration: 1100, delay: ritardo, easing: CURVE.entrata, fill: "backwards" })
}

/** Il blocco di dati si ricompone quando l'utente cambia filtro. */
export function ricomponiBlocco(blocco: Element) {
  anima(blocco, [{ opacity: 0, transform: "translateY(26px) scale(0.985)" }, { opacity: 1, transform: "none" }], { duration: 650, easing: CURVE.entrata })
}

/** Fotografa le posizioni prima di un cambio: dopo il cambio ogni elemento scivola al nuovo posto. */
export function useRiordino(radice: RefObject<HTMLElement>, selettore: string) {
  const prima = useRef<Map<string, DOMRect> | null>(null)

  const fotografa = () => {
    const posti = new Map<string, DOMRect>()
    radice.current?.querySelectorAll<HTMLElement>(selettore).forEach((e) => posti.set(e.dataset.id ?? "", e.getBoundingClientRect()))
    prima.current = posti
  }

  useLayoutEffect(() => {
    const posti = prima.current
    if (!posti || movimentoRidotto()) return
    prima.current = null
    radice.current?.querySelectorAll<HTMLElement>(selettore).forEach((e) => {
      const vecchio = posti.get(e.dataset.id ?? "")
      if (!vecchio) return
      const nuovo = e.getBoundingClientRect()
      const x = vecchio.left - nuovo.left
      const y = vecchio.top - nuovo.top
      if (Math.abs(x) < 1 && Math.abs(y) < 1) return
      anima(e, [{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }], { duration: 420, easing: CURVE.entrata })
    })
  })

  return fotografa
}
