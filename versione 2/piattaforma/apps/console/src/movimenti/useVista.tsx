import { startTransition, useLayoutEffect, useRef, useState } from "react"
import { UNSAFE_LocationContext as ContestoPosizione, useLocation, useNavigationType, useOutlet } from "react-router-dom"
import { movimentoRidotto } from "./anima"
import { TEMPI } from "./curve"
import { entraApertura, entraVista, esciVista } from "./vista"

/**
 * Tiene ferma la pagina vecchia per il tempo dell'uscita, poi mostra quella nuova e la fa entrare.
 * Menu e testata vedono subito il nuovo indirizzo; i reindirizzamenti (`replace`) non rifanno il movimento.
 */
export function useVista() {
  const posizione = useLocation()
  const tipo = useNavigationType()
  const uscita = useOutlet()
  const radice = useRef<HTMLDivElement>(null)
  const [mostrata, setMostrata] = useState(posizione.pathname)
  const ferma = useRef({ posizione, uscita })
  const ultima = useRef(posizione.pathname)
  const inUscita = useRef<{ annulla: () => void; timer: ReturnType<typeof setTimeout> } | null>(null)
  const entrata = useRef<{ ferma: () => void } | null>(null)
  const entrataDi = useRef<string | null>(null)

  ultima.current = posizione.pathname
  const aspetta = posizione.pathname !== mostrata
  if (!aspetta) ferma.current = { posizione, uscita }
  const scena = aspetta ? ferma.current : { posizione, uscita }

  useLayoutEffect(() => {
    if (!aspetta) {
      if (inUscita.current) {
        clearTimeout(inUscita.current.timer)
        inUscita.current.annulla()
        inUscita.current = null
      }
      return
    }
    if (inUscita.current) return
    if (tipo === "REPLACE" || movimentoRidotto() || !radice.current) {
      setMostrata(posizione.pathname)
      return
    }
    const { annulla } = esciVista(radice.current)
    // In transizione: la pagina vecchia, già uscita, resta finché la nuova non è pronta, poi l'entrata parte nello stesso istante.
    inUscita.current = { annulla, timer: setTimeout(() => startTransition(() => setMostrata(ultima.current)), TEMPI.uscitaVista) }
  }, [aspetta, posizione.pathname, tipo])

  useLayoutEffect(() => {
    const elemento = radice.current
    if (!elemento) return
    inUscita.current?.annulla()
    inUscita.current = null
    // In sviluppo React esegue due volte lo stesso effetto: l'entrata parte una volta sola.
    if (entrataDi.current === mostrata) return
    const prima = entrataDi.current === null
    entrataDi.current = mostrata
    if (prima) {
      entrata.current = entraApertura(elemento)
      return
    }
    // Un reindirizzamento appena arrivato prosegue la stessa entrata: i blocchi nuovi si accodano da soli.
    if (tipo === "REPLACE") return
    window.scrollTo(0, 0)
    entrata.current?.ferma()
    entrata.current = entraVista(elemento)
  }, [mostrata]) // eslint-disable-line react-hooks/exhaustive-deps

  const contenuto = (
    <ContestoPosizione.Provider value={{ location: scena.posizione, navigationType: tipo }}>{scena.uscita}</ContestoPosizione.Provider>
  )
  return { radice, contenuto, chiave: mostrata }
}
