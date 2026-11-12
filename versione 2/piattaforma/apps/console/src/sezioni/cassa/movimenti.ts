import { anima, CURVE, movimentoRidotto } from "../../movimenti"

const DURATA_VOLO = 550
const FOTOGRAMMI = 24
const CURVA_VOLO = 2.6
const SCALA_FINALE = 0.3
const OPACITA_FINALE = 0.2
const LATO_VOLO = 40
/** Punto di arrivo del volo, misurato dall'angolo del cestino. */
const ARRIVO = { x: 67, y: 79 }

const PASSO_SCHEDA = 20
const DURATA_SCHEDA = 640
const DURATA_COMPARSA = 340
const ROTAZIONE = 2.5

/** Spostamento misurato sul pannello: parte lento e accelera verso il cestino. */
function fotogrammiVolo(dx: number, dy: number) {
  return Array.from({ length: FOTOGRAMMI + 1 }, (_, indice) => {
    const avanzamento = Math.pow(indice / FOTOGRAMMI, CURVA_VOLO)
    const scala = 1 - (1 - SCALA_FINALE) * avanzamento
    return {
      transform: `translate(${dx * avanzamento}px, ${dy * avanzamento}px) scale(${scala})`,
      opacity: 1 - (1 - OPACITA_FINALE) * avanzamento,
    }
  })
}

/** Una copia della miniatura vola dalla scheda al cestino, poi sparisce. */
export function volaNelCestino(miniatura: Element | null, cestino: Element | null) {
  if (!miniatura || !cestino || movimentoRidotto()) return
  const da = miniatura.getBoundingClientRect()
  const a = cestino.getBoundingClientRect()
  const copia = miniatura.cloneNode(true) as HTMLElement
  copia.classList.add("cassa-volo")
  copia.style.left = `${da.left + (da.width - LATO_VOLO) / 2 + 13}px`
  copia.style.top = `${da.top + (da.height - LATO_VOLO) / 2 + 11}px`
  document.body.append(copia)
  const dx = a.left + ARRIVO.x - (da.left + da.width / 2 + 13)
  const dy = a.top + ARRIVO.y - (da.top + da.height / 2 + 11)
  anima(copia, fotogrammiVolo(dx, dy), { duration: DURATA_VOLO, easing: "linear" })?.finished.finally(() => copia.remove())
}

export function rimbalzo(elemento: Element | null) {
  if (!elemento) return
  anima(
    elemento,
    [
      { transform: "scale(0.93)", offset: 0, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" },
      { transform: "scale(1.075)", offset: 0.38, easing: "ease-in-out" },
      { transform: "scale(1)", offset: 1 },
    ],
    { duration: 520 }
  )
}

/** Il numero del passo sussulta di un pixel a ogni variazione. */
export function battito(elemento: Element | null) {
  if (!elemento) return
  anima(elemento, [{ transform: "translateY(0)" }, { transform: "translateY(-1px)" }, { transform: "translateY(0)" }], { duration: 180, easing: "ease-out" })
}

/** Il totale si accende dell'accento e torna al colore del testo. */
export function lampo(elemento: Element | null) {
  if (!elemento) return
  anima(elemento, [{ color: "var(--accento)" }, { color: "var(--testo)" }], { duration: 1000, easing: CURVE.fuori4 })
  anima(elemento, [{ transform: "scale(0.97)" }, { transform: "none" }], { duration: 320, easing: CURVE.modale })
}

/** Le schede salgono una dopo l'altra, un po' storte, a ogni filtro e all'apertura. */
export function entraSchede(griglia: Element | null) {
  if (!griglia) return
  Array.from(griglia.children).forEach((scheda, indice) => {
    const verso = indice % 2 ? 1 : -1
    const ritardo = indice * PASSO_SCHEDA
    anima(scheda, [{ transform: `translateY(40px) scale(0.95) rotate(${verso * ROTAZIONE}deg)` }, { transform: "none" }], { duration: DURATA_SCHEDA, delay: ritardo, easing: CURVE.modale })
    anima(scheda, [{ opacity: 0 }, { opacity: 1 }], { duration: DURATA_COMPARSA, delay: ritardo, easing: "ease-out" })
  })
}

/** La fila delle pillole scende e risale quando cambia il filtro. */
export function sussultoFiltri(fila: Element | null) {
  if (!fila) return
  anima(fila, [{ transform: "translateY(8px)" }, { transform: "none" }], { duration: 480, easing: CURVE.fuori3 })
}
