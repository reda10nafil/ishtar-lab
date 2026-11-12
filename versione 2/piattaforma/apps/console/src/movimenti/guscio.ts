import { anima, movimentoRidotto } from "./anima"
import { CURVE } from "./curve"

/** Prima apertura: entrano barra laterale, marchio, voci del menu e testata, in quest'ordine. */
export function entraGuscio(radice: HTMLElement) {
  const laterale = radice.querySelector(".laterale")
  const testata = radice.querySelector(".testata")
  if (laterale && getComputedStyle(laterale).position !== "fixed") {
    anima(laterale, [{ opacity: 0, transform: "translateX(-40px)" }, { opacity: 1, transform: "none" }], { duration: 740, easing: CURVE.entrata })
  }
  const marchio = radice.querySelector(".marchio__link")
  if (marchio) {
    anima(marchio, [{ opacity: 0, transform: "translateX(-12px)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: 86, easing: CURVE.fuori3 })
  }
  radice.querySelectorAll(".laterale .voce").forEach((voce, indice) => {
    anima(voce, [{ opacity: 0, transform: "translateX(-12px)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: 168 + indice * 24, easing: CURVE.fuori3 })
  })
  if (testata) {
    anima(testata, [{ opacity: 0, transform: "translateY(-20px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 132, easing: CURVE.entrata })
  }
}

/** Le sotto-voci compaiono scivolando appena la sezione si apre. */
export function entraSottovoci(contenitore: Element) {
  contenitore.querySelectorAll(".sottovoce").forEach((voce, indice) => {
    anima(voce, [{ opacity: 0, transform: "translateX(-8px)" }, { opacity: 1, transform: "none" }], { duration: 370, delay: 90 + indice * 40, easing: CURVE.fuori3 })
  })
}

const AGGANCI = ".pagina__testa button.primario, .testata__nuovo"

/** I pulsanti principali seguono un poco il puntatore e tornano a posto quando lo perdono. */
export function attivaMagnete() {
  if (movimentoRidotto() || !window.matchMedia("(hover: hover)").matches) return () => undefined
  let agganciato: HTMLButtonElement | null = null
  const libera = () => {
    if (agganciato) agganciato.style.translate = ""
    agganciato = null
  }
  const muovi = (e: PointerEvent) => {
    const bersaglio = e.target instanceof Element ? e.target.closest<HTMLButtonElement>(AGGANCI) : null
    if (bersaglio !== agganciato) libera()
    if (!bersaglio || bersaglio.disabled) return
    agganciato = bersaglio
    const riquadro = bersaglio.getBoundingClientRect()
    const giaSpostato = new DOMMatrixReadOnly(getComputedStyle(bersaglio).translate === "none" ? "" : `translate(${getComputedStyle(bersaglio).translate.split(" ").join(",")})`)
    const x = e.clientX - (riquadro.left - giaSpostato.e + riquadro.width / 2)
    const y = e.clientY - (riquadro.top - giaSpostato.f + riquadro.height / 2)
    bersaglio.style.translate = `${(x * 0.2).toFixed(2)}px ${(y * 0.28).toFixed(2)}px`
  }
  document.addEventListener("pointermove", muovi, { passive: true })
  document.addEventListener("pointerleave", libera)
  return () => {
    libera()
    document.removeEventListener("pointermove", muovi)
    document.removeEventListener("pointerleave", libera)
  }
}
