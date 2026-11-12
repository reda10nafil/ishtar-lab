import { CircleAlert, CircleCheck } from "lucide-react"
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type Context, type ReactNode } from "react"
import { anima, CURVE, movimentoRidotto } from "../movimenti"

type Azione = { etichetta: string; esegui: () => void }
type Avviso = { id: number; testo: string; errore: boolean; azione?: Azione }
type Contesto = { avvisa: (testo: string, azione?: Azione) => void; segnalaErrore: (errore: unknown) => void }

// In sviluppo, mentre si salvano i file, Vite può caricare due copie di questo modulo: il contesto deve restare uno solo.
const memoria = window as unknown as { __contestoAvvisi?: Context<Contesto | null> }
const ContestoAvvisi = (memoria.__contestoAvvisi ??= createContext<Contesto | null>(null))
const DURATA = 3200

function RigaAvviso({ avviso, onFine }: { avviso: Avviso; onFine: (id: number) => void }) {
  const nodo = useRef<HTMLParagraphElement>(null)
  useLayoutEffect(() => {
    const elemento = nodo.current
    if (!elemento) return
    anima(elemento, [{ opacity: 0, transform: "translateY(30px) scale(0.94)" }, { opacity: 1, transform: "none" }], { duration: 480, easing: CURVE.avviso })
    const attesa = setTimeout(() => {
      if (movimentoRidotto()) return onFine(avviso.id)
      const uscita = anima(elemento, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(16px)" }], { duration: 250, easing: CURVE.dentro2, fill: "forwards" })
      void uscita?.finished.finally(() => onFine(avviso.id))
    }, DURATA)
    return () => clearTimeout(attesa)
  }, [avviso.id, onFine])
  const Icona = avviso.errore ? CircleAlert : CircleCheck
  return (
    <p ref={nodo} className={avviso.errore ? "avviso--errore" : undefined}>
      <Icona size={18} aria-hidden="true" />
      <span>{avviso.testo}</span>
      {avviso.azione ? (
        <button
          type="button"
          onClick={() => {
            avviso.azione?.esegui()
            onFine(avviso.id)
          }}
        >
          {avviso.azione.etichetta}
        </button>
      ) : null}
    </p>
  )
}

export function ProviderAvvisi({ children }: { children: ReactNode }) {
  const [avvisi, setAvvisi] = useState<Avviso[]>([])

  const togli = useCallback((id: number) => setAvvisi((attuali) => attuali.filter((a) => a.id !== id)), [])
  const mostra = useCallback((testo: string, errore: boolean, azione?: Azione) => {
    const id = Date.now() + Math.random()
    setAvvisi((attuali) => [...attuali, { id, testo, errore, azione }])
  }, [])

  const valore = useMemo<Contesto>(
    () => ({
      avvisa: (testo, azione) => mostra(testo, false, azione),
      segnalaErrore: (errore) => mostra(errore instanceof Error ? errore.message : "Something went wrong", true),
    }),
    [mostra]
  )

  return (
    <ContestoAvvisi.Provider value={valore}>
      {children}
      <div className="avvisi" aria-live="polite">
        {avvisi.map((a) => <RigaAvviso key={a.id} avviso={a} onFine={togli} />)}
      </div>
    </ContestoAvvisi.Provider>
  )
}

/** Conferma breve dopo un'azione: `avvisa("Saved")`, con annullamento `avvisa("Packed", { etichetta: "Undo", esegui })`, `segnalaErrore(errore)`. */
export function useAvvisi() {
  const contesto = useContext(ContestoAvvisi)
  if (!contesto) throw new Error("useAvvisi richiede ProviderAvvisi")
  return contesto
}
