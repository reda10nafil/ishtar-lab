import { scorri, type Bordi } from "./pillola"

/**
 * Pillole automatiche: ogni `.selettore` e ogni `.schede` riceve da solo l'indicatore della voce attiva.
 * Le sezioni continuano a mettere la classe `attivo` (o `active` di NavLink) e non devono fare altro.
 * Nel pannello i segmenti scorrono; le schede sono rotte e l'indicatore arriva già al posto con la pagina nuova.
 */
type Regola = { gruppo: string; attivo: string; classe: string; raggio: number; margine: number; scorre: boolean }

const REGOLE: Regola[] = [
  { gruppo: ".selettore", attivo: "button.attivo", classe: "selettore__pillola", raggio: 9, margine: 3, scorre: true },
  { gruppo: ".schede", attivo: "a.active", classe: "schede__pillola", raggio: 11, margine: 4, scorre: false },
]

type Stato = { pillola: HTMLElement; bordi: Bordi | null; ferma: () => void; larghezza: number; spia: ResizeObserver }

const stati = new WeakMap<HTMLElement, Stato>()

function ritaglia(gruppo: HTMLElement, { pillola }: Stato, bordi: Bordi, regola: Regola) {
  const larghezza = gruppo.scrollWidth
  pillola.style.width = `${larghezza}px`
  pillola.style.clipPath = `inset(${regola.margine}px ${larghezza - bordi.fine}px ${regola.margine}px ${bordi.inizio}px round ${regola.raggio}px)`
}

function allinea(gruppo: HTMLElement, regola: Regola, conMovimento: boolean) {
  let stato = stati.get(gruppo)
  if (!stato) {
    const pillola = document.createElement("span")
    pillola.className = regola.classe
    pillola.setAttribute("aria-hidden", "true")
    gruppo.prepend(pillola)
    gruppo.dataset.pillola = "1"
    const nuovo: Stato = { pillola, bordi: null, ferma: () => undefined, larghezza: 0, spia: new ResizeObserver(() => allinea(gruppo, regola, false)) }
    nuovo.spia.observe(gruppo)
    stati.set(gruppo, nuovo)
    stato = nuovo
  }
  const attivo = gruppo.querySelector<HTMLElement>(regola.attivo)
  if (!attivo || !attivo.offsetWidth) {
    stato.pillola.style.visibility = "hidden"
    stato.bordi = null
    return
  }
  stato.pillola.style.visibility = ""
  const destino = { inizio: attivo.offsetLeft, fine: attivo.offsetLeft + attivo.offsetWidth }
  const partenza = stato.bordi
  if (partenza && partenza.inizio === destino.inizio && partenza.fine === destino.fine && stato.larghezza === gruppo.scrollWidth) return
  stato.larghezza = gruppo.scrollWidth
  stato.ferma()
  stato.bordi = destino
  const corrente = stato
  if (partenza && conMovimento && regola.scorre) {
    corrente.ferma = scorri(partenza, destino, (bordi) => ritaglia(gruppo, corrente, bordi, regola), { davanti: 340, dietro: 480 })
  } else {
    ritaglia(gruppo, corrente, destino, regola)
  }
}

function controlla() {
  for (const regola of REGOLE) {
    document.querySelectorAll<HTMLElement>(regola.gruppo).forEach((gruppo) => allinea(gruppo, regola, true))
  }
}

/** Una volta sola per tutta l'app: guarda anche i modali, che stanno fuori dal guscio. */
export function attivaSelettori() {
  controlla()
  const spia = new MutationObserver((voci) => {
    if (voci.some((v) => v.type === "childList" || (v.target instanceof Element && v.target.matches("button, a")))) controlla()
  })
  spia.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] })
  return () => spia.disconnect()
}
