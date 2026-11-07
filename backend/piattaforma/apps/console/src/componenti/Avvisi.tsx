import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

type Avviso = { id: number; testo: string; errore: boolean }
type Contesto = { avvisa: (testo: string) => void; segnalaErrore: (errore: unknown) => void }

const ContestoAvvisi = createContext<Contesto | null>(null)
const DURATA = 4500

export function ProviderAvvisi({ children }: { children: ReactNode }) {
  const [avvisi, setAvvisi] = useState<Avviso[]>([])

  const mostra = useCallback((testo: string, errore: boolean) => {
    const id = Date.now() + Math.random()
    setAvvisi((attuali) => [...attuali, { id, testo, errore }])
    setTimeout(() => setAvvisi((attuali) => attuali.filter((a) => a.id !== id)), DURATA)
  }, [])

  const valore = useMemo<Contesto>(
    () => ({
      avvisa: (testo) => mostra(testo, false),
      segnalaErrore: (errore) => mostra(errore instanceof Error ? errore.message : "Something went wrong", true),
    }),
    [mostra]
  )

  return (
    <ContestoAvvisi.Provider value={valore}>
      {children}
      <div className="avvisi" aria-live="polite">
        {avvisi.map((a) => (
          <p key={a.id} className={a.errore ? "avviso--errore" : undefined}>{a.testo}</p>
        ))}
      </div>
    </ContestoAvvisi.Provider>
  )
}

/** Conferma breve dopo un'azione: `avvisa("Salvato")`, `segnalaErrore(errore)`. */
export function useAvvisi() {
  const contesto = useContext(ContestoAvvisi)
  if (!contesto) throw new Error("useAvvisi richiede ProviderAvvisi")
  return contesto
}
