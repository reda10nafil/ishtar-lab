export const movimentoRidotto = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Avvia un'animazione del browser; con il movimento ridotto non fa nulla e restituisce null. */
export function anima(elemento: Element, fotogrammi: Keyframe[], opzioni: KeyframeAnimationOptions) {
  if (movimentoRidotto()) return null
  return elemento.animate(fotogrammi, { fill: "backwards", ...opzioni })
}

/** Ultimo gesto dell'utente: distingue un filtro appena cambiato da un aggiornamento automatico dei dati. */
let ultimoGesto = -Infinity

const segna = () => {
  ultimoGesto = performance.now()
}

window.addEventListener("pointerdown", segna, { capture: true, passive: true })
window.addEventListener("keydown", segna, { capture: true, passive: true })

export const gestoRecente = (entro = 1200) => performance.now() - ultimoGesto < entro
