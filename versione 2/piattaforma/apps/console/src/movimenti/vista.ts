import { anima, gestoRecente, movimentoRidotto } from "./anima"
import { CURVE, TEMPI } from "./curve"

const BLOCCO = ".vetro, [data-blocco]"
const RIGA = "tbody tr, [data-riga]"
const LETTERE = ".titolo-lettere"
const ESCLUSI = ".velo, [data-fermo]"
const SPOSTAMENTO_INIZIALE = "translateY(26px) scale(0.985)"
const MASSIMO_PASSI = 16
const MASSIMO_RIGHE = 30
/** Per quanto tempo un blocco che arriva con i dati entra ancora in sequenza. */
const FINESTRA = 4000
const QUIETE = 1500

type Passi = { ritardo: number; passo: number; durata: number; curva: string; ritardoLettere: number }

const blocchiDi = (radice: Element) =>
  [...radice.querySelectorAll<HTMLElement>(BLOCCO)].filter((e) => !e.closest(ESCLUSI) && !e.parentElement?.closest(BLOCCO))

/** Le lettere del titolo salgono da sotto la riga, una dopo l'altra. */
function entraLettere(titolo: Element, ritardo: number) {
  titolo.querySelectorAll(".lettera").forEach((lettera, indice) => {
    anima(lettera, [{ transform: "translateY(45px) rotate(6deg)" }, { transform: "none" }], {
      duration: TEMPI.lettera,
      delay: ritardo + indice * TEMPI.passoLettera,
      easing: CURVE.fuori4,
    })
  })
}

function entraRiga(riga: Element, ritardo: number) {
  anima(riga, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
    duration: TEMPI.entrataRiga,
    delay: ritardo,
    easing: CURVE.fuori3,
  })
}

/** Fa entrare ciò che c'è e ciò che arriva con i dati, una volta sola: i dati aggiornati non rifanno le entrate. */
function sequenza(radice: HTMLElement, { ritardo, passo, durata, curva, ritardoLettere }: Passi) {
  const visti = new WeakSet<Element>()
  const inizio = performance.now()
  let prossimoBlocco = inizio + ritardo
  let prossimaRiga = inizio + ritardo
  let righe = 0
  let attesa: ReturnType<typeof setTimeout>

  const processa = () => {
    const adesso = performance.now()
    let nuovi = false
    radice.querySelectorAll(LETTERE).forEach((titolo) => {
      if (visti.has(titolo)) return
      visti.add(titolo)
      entraLettere(titolo, Math.max(0, inizio + ritardoLettere - adesso))
    })
    for (const blocco of blocchiDi(radice)) {
      if (visti.has(blocco)) continue
      visti.add(blocco)
      nuovi = true
      prossimoBlocco = Math.max(prossimoBlocco, adesso)
      anima(blocco, [{ opacity: 0, transform: SPOSTAMENTO_INIZIALE }, { opacity: 1, transform: "none" }], {
        duration: durata,
        delay: Math.min(prossimoBlocco - adesso, passo * MASSIMO_PASSI),
        easing: curva,
      })
      prossimoBlocco += passo
    }
    radice.querySelectorAll(RIGA).forEach((riga) => {
      if (visti.has(riga) || riga.closest(ESCLUSI)) return
      visti.add(riga)
      nuovi = true
      if (righe++ >= MASSIMO_RIGHE) return
      prossimaRiga = Math.max(prossimaRiga, adesso)
      entraRiga(riga, prossimaRiga - adesso)
      prossimaRiga += TEMPI.passoRiga
    })
    return nuovi
  }

  const spia = new MutationObserver(() => {
    if (processa()) rinvia()
  })
  const ferma = () => {
    clearTimeout(attesa)
    spia.disconnect()
  }
  const rinvia = () => {
    clearTimeout(attesa)
    attesa = setTimeout(ferma, Math.min(QUIETE, Math.max(0, inizio + FINESTRA - performance.now())))
  }

  processa()
  spia.observe(radice, { childList: true, subtree: true })
  attesa = setTimeout(ferma, FINESTRA)
  return { ferma }
}

const NIENTE = { ferma: () => undefined }

export function entraVista(radice: HTMLElement) {
  if (movimentoRidotto()) return NIENTE
  anima(radice, [{ transform: "translateX(24px)" }, { transform: "none" }], { duration: TEMPI.entrataVista, easing: CURVE.entrata })
  return sequenza(radice, { ritardo: 0, ritardoLettere: 0, passo: TEMPI.passoBlocco, durata: TEMPI.entrataBlocco, curva: CURVE.entrata })
}

/** Prima apertura dell'app: i blocchi partono dopo barra laterale e testata. */
export function entraApertura(radice: HTMLElement) {
  if (movimentoRidotto()) return NIENTE
  return sequenza(radice, { ritardo: 330, ritardoLettere: 360, passo: TEMPI.passoAperturaBlocco, durata: TEMPI.aperturaBlocco, curva: CURVE.apertura })
}

/** Uscita della pagina: restituisce l'annullamento, da chiamare quando arriva la pagina nuova. */
export function esciVista(radice: HTMLElement) {
  const animazioni: (Animation | null)[] = [
    anima(radice, [{ transform: "none" }, { transform: "translateX(-16px)" }], { duration: TEMPI.uscitaVista, easing: CURVE.dentro2, fill: "both" }),
  ]
  const blocchi = blocchiDi(radice)
  for (const blocco of blocchi) {
    animazioni.push(
      anima(blocco, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(8px) scale(0.985)" }], {
        duration: TEMPI.uscitaVista,
        easing: CURVE.dentro2,
        fill: "both",
      })
    )
  }
  radice.querySelectorAll(".pagina > *").forEach((parte) => {
    if (blocchi.some((blocco) => parte.contains(blocco))) return
    animazioni.push(
      anima(parte, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px)" }], {
        duration: TEMPI.uscitaTesta,
        easing: CURVE.dentro1,
        fill: "both",
      })
    )
  })
  return { annulla: () => animazioni.forEach((a) => a?.cancel()) }
}

/** Rifà entrare le righe dopo un filtro o un ordinamento scelto dall'utente; un aggiornamento automatico non le tocca. */
export function entraRighe(radice: Element, forza = false) {
  if (!forza && !gestoRecente()) return
  radice.querySelectorAll(RIGA).forEach((riga, indice) => {
    if (indice < MASSIMO_RIGHE) entraRiga(riga, indice * TEMPI.passoRiga)
  })
}
